package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	serviceName = "kovan-agent"
	displayName = "Kovan Agent"

	// Linux paths
	linuxInstallDir  = "/opt/kovan"
	linuxBinaryPath  = linuxInstallDir + "/pardus-agent"
	linuxServicePath = "/etc/systemd/system/" + serviceName + ".service"
	linuxEnvPath     = linuxInstallDir + "/agent.env"

	// Windows
	winTaskName = "PardusC2Agent"
)

var (
	winInstallDir = filepath.Join(getWinProgramData(), "PardusC2")
	winBinaryPath = filepath.Join(winInstallDir, "pardus-agent.exe")
)

func getWinProgramData() string {
	if v := os.Getenv("ProgramData"); v != "" {
		return v
	}
	return `C:\ProgramData`
}

func execCmd(name string, args ...string) string {
	out, _ := exec.Command(name, args...).CombinedOutput()
	return strings.TrimSpace(string(out))
}

func execLoud(name string, args ...string) {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
}

func isRoot() bool {
	if isWindows {
		err := exec.Command("net", "session").Run()
		return err == nil
	}
	return os.Getuid() == 0
}

func installerParseServerURL(args []string) string {
	for i, arg := range args {
		if arg == "--server" && i+1 < len(args) {
			return args[i+1]
		}
	}
	if v := os.Getenv("C2_SERVER"); v != "" {
		return v
	}
	return "ws://localhost:4444/ws/agent"
}

func copyBinary(src, dst string) error {
	absSrc, _ := filepath.Abs(src)
	absDst, _ := filepath.Abs(dst)
	if absSrc == absDst {
		fmt.Printf("  :: binary zaten yerinde: %s\n", dst)
		return nil
	}

	fmt.Printf("  :: binary kopyalaniyor: %s -> %s\n", src, dst)
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// ═══════════════════════════════════════════
//  LINUX (systemd)
// ═══════════════════════════════════════════

func generateServiceFile(serverURL string) string {
	return fmt.Sprintf(`[Unit]
Description=%s
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=%s
EnvironmentFile=%s
Restart=always
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=%s
NoNewPrivileges=false
WorkingDirectory=%s

[Install]
WantedBy=multi-user.target
`, displayName, linuxBinaryPath, linuxEnvPath, serviceName, linuxInstallDir)
}

func linuxInstall(serverURL string) {
	fmt.Println(":: linux/pardus -- systemd servisi kuruluyor")
	fmt.Println()

	fmt.Printf("  :: dizin: %s\n", linuxInstallDir)
	os.MkdirAll(linuxInstallDir, 0755)

	exe, _ := os.Executable()
	if err := copyBinary(exe, linuxBinaryPath); err != nil {
		fmt.Printf("  :: HATA: binary kopyalanamadi: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("  :: ortam degiskenleri: %s\n", linuxEnvPath)
	os.WriteFile(linuxEnvPath, []byte(fmt.Sprintf("C2_SERVER=%s\nNODE_TLS_REJECT_UNAUTHORIZED=0\n", serverURL)), 0600)

	fmt.Printf("  :: service dosyasi: %s\n", linuxServicePath)
	os.WriteFile(linuxServicePath, []byte(generateServiceFile(serverURL)), 0644)

	fmt.Println("  :: systemd yeniden yukleniyor...")
	execLoud("systemctl", "daemon-reload")

	fmt.Println("  :: servis etkinlestiriliyor...")
	execLoud("systemctl", "enable", serviceName)

	fmt.Println("  :: servis baslatiliyor...")
	execLoud("systemctl", "start", serviceName)

	fmt.Printf(`
  :: KURULUM TAMAMLANDI
  :: ─────────────────────────────────────
  :: binary:  %s
  :: config:  %s
  :: service: %s
  :: server:  %s
  :: ─────────────────────────────────────
  :: yonetim komutlari:
  ::   systemctl status  %s
  ::   systemctl stop    %s
  ::   systemctl restart %s
  ::   journalctl -u %s -f

`, linuxBinaryPath, linuxEnvPath, linuxServicePath, serverURL,
		serviceName, serviceName, serviceName, serviceName)
}

func linuxUninstall() {
	fmt.Println(":: linux/pardus -- servis kaldiriliyor")
	fmt.Println()

	fmt.Println("  :: servis durduruluyor...")
	execCmd("systemctl", "stop", serviceName)

	fmt.Println("  :: servis devre disi birakiliyor...")
	execCmd("systemctl", "disable", serviceName)

	for _, f := range []string{linuxServicePath, linuxBinaryPath, linuxEnvPath} {
		if _, err := os.Stat(f); err == nil {
			fmt.Printf("  :: siliniyor: %s\n", f)
			os.Remove(f)
		}
	}

	fmt.Println("  :: systemd yeniden yukleniyor...")
	execLoud("systemctl", "daemon-reload")

	os.Remove(linuxInstallDir)
	fmt.Println()
	fmt.Println("  :: servis tamamen kaldirildi")
}

func linuxStatus() {
	fmt.Println(":: linux/pardus -- servis durumu")
	fmt.Println()

	binaryExists := fileExists(linuxBinaryPath)
	serviceExists := fileExists(linuxServicePath)

	fmt.Printf("  :: binary:  %s (%s)\n", statusText(binaryExists), linuxBinaryPath)
	fmt.Printf("  :: service: %s (%s)\n", statusText(serviceExists), linuxServicePath)

	if serviceExists {
		fmt.Println()
		execLoud("systemctl", "status", serviceName, "--no-pager")
	}

	if data, err := os.ReadFile(linuxEnvPath); err == nil {
		fmt.Printf("\n  :: config (%s):\n     %s\n", linuxEnvPath, strings.TrimSpace(string(data)))
	}
}

// ═══════════════════════════════════════════
//  WINDOWS (Scheduled Task)
// ═══════════════════════════════════════════

func generateTaskXML(batchPath string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>%s - Kovan Agent Daemon</Description>
    <URI>\%s</URI>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%s</Command>
      <WorkingDirectory>%s</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`, displayName, winTaskName, batchPath, winInstallDir)
}

func windowsInstall(serverURL string) {
	fmt.Println(":: windows -- scheduled task kuruluyor")
	fmt.Println()

	fmt.Printf("  :: dizin: %s\n", winInstallDir)
	os.MkdirAll(winInstallDir, 0755)

	exe, _ := os.Executable()
	if err := copyBinary(exe, winBinaryPath); err != nil {
		fmt.Printf("  :: HATA: binary kopyalanamadi: %v\n", err)
		os.Exit(1)
	}

	envBat := filepath.Join(winInstallDir, "env.bat")
	fmt.Printf("  :: config: %s\n", envBat)
	os.WriteFile(envBat, []byte(fmt.Sprintf("set C2_SERVER=%s\r\n", serverURL)), 0644)

	wrapperBat := filepath.Join(winInstallDir, "start-agent.bat")
	os.WriteFile(wrapperBat, []byte(fmt.Sprintf("@echo off\r\ncall \"%s\"\r\n\"%s\"\r\n", envBat, winBinaryPath)), 0644)

	taskXmlPath := filepath.Join(winInstallDir, "task.xml")
	xmlContent := generateTaskXML(wrapperBat)
	f, _ := os.Create(taskXmlPath)
	f.Write([]byte{0xFF, 0xFE}) // BOM
	for _, r := range xmlContent {
		f.Write([]byte{byte(r), byte(r >> 8)})
	}
	f.Close()

	fmt.Printf("  :: scheduled task olusturuluyor: %s\n", winTaskName)
	execCmd("schtasks", "/Delete", "/TN", winTaskName, "/F")
	execLoud("schtasks", "/Create", "/TN", winTaskName, "/XML", taskXmlPath, "/F")

	fmt.Println("  :: task baslatiliyor...")
	exec.Command("schtasks", "/Run", "/TN", winTaskName).Run()

	fmt.Printf(`
  :: KURULUM TAMAMLANDI
  :: ─────────────────────────────────────
  :: binary:  %s
  :: config:  %s
  :: task:    %s
  :: server:  %s
  :: ─────────────────────────────────────
  :: yonetim komutlari (admin cmd):
  ::   schtasks /Query /TN "%s" /V
  ::   schtasks /Run   /TN "%s"
  ::   schtasks /End   /TN "%s"

`, winBinaryPath, envBat, winTaskName, serverURL,
		winTaskName, winTaskName, winTaskName)
}

func windowsUninstall() {
	fmt.Println(":: windows -- scheduled task kaldiriliyor")
	fmt.Println()

	fmt.Printf("  :: task durduruluyor: %s\n", winTaskName)
	execCmd("schtasks", "/End", "/TN", winTaskName)

	fmt.Println("  :: process sonlandiriliyor...")
	time.Sleep(2 * time.Second)

	fmt.Printf("  :: task siliniyor: %s\n", winTaskName)
	execCmd("schtasks", "/Delete", "/TN", winTaskName, "/F")

	execCmd("taskkill", "/F", "/IM", "pardus-agent.exe")
	time.Sleep(1 * time.Second)

	for _, f := range []string{
		winBinaryPath,
		filepath.Join(winInstallDir, "env.bat"),
		filepath.Join(winInstallDir, "start-agent.bat"),
		filepath.Join(winInstallDir, "task.xml"),
	} {
		if fileExists(f) {
			if err := os.Remove(f); err == nil {
				fmt.Printf("  :: silindi: %s\n", f)
			} else {
				fmt.Printf("  :: silinemedi: %s\n", f)
			}
		}
	}

	os.Remove(winInstallDir)
	fmt.Println()
	fmt.Println("  :: tamamen kaldirildi")
}

func windowsStatus() {
	fmt.Println(":: windows -- task durumu")
	fmt.Println()

	fmt.Printf("  :: binary:  %s (%s)\n", statusText(fileExists(winBinaryPath)), winBinaryPath)
	fmt.Printf("  :: task:    %s\n\n", winTaskName)

	out := execCmd("schtasks", "/Query", "/TN", winTaskName, "/FO", "LIST", "/V")
	if out != "" && !strings.Contains(out, "ERROR") {
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			for _, kw := range []string{"Status", "Durum", "Last Run", "Son", "Next Run", "State", "Run As User"} {
				if strings.Contains(line, kw) {
					fmt.Printf("  :: %s\n", line)
					break
				}
			}
		}
	} else {
		fmt.Println("  :: task bulunamadi -- kurulum yapilmamis")
	}

	envBat := filepath.Join(winInstallDir, "env.bat")
	if data, err := os.ReadFile(envBat); err == nil {
		fmt.Printf("\n  :: config (%s):\n     %s\n", envBat, strings.TrimSpace(string(data)))
	}
}

// ═══════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func statusText(exists bool) string {
	if exists {
		return "kurulu"
	}
	return "bulunamadi"
}

func printHelp() {
	fmt.Println(`
  :: KOVAN AGENT -- Daemon Yoneticisi (Go)
  :: ──────────────────────────────────────────────

  :: kullanim:
  ::   pardus-agent install  [--server ws://IP:PORT/ws/agent]
  ::   pardus-agent uninstall
  ::   pardus-agent status
  ::   pardus-agent                         (direkt calistir)

  :: ornekler:
  ::   sudo ./pardus-agent install
  ::   sudo ./pardus-agent install --server ws://10.0.0.5:4444
  ::   sudo ./pardus-agent uninstall

  :: platform:
  ::   linux/pardus -> systemd service
  ::   windows      -> scheduled task (SYSTEM, boot'ta baslar)

  :: not: install/uninstall root/admin yetkisi gerektirir`)
}

// handleDaemonCommand checks CLI args for install/uninstall/status/help.
// Returns true if a command was handled (caller should exit).
func handleDaemonCommand(args []string) bool {
	var command string
	for _, a := range args {
		switch a {
		case "install", "uninstall", "status", "help", "--help", "-h":
			command = a
		}
	}

	if command == "" {
		return false
	}

	if command == "help" || command == "--help" || command == "-h" {
		printHelp()
		return true
	}

	if (command == "install" || command == "uninstall") && !isRoot() {
		fmt.Println()
		fmt.Println("  :: HATA: bu islem icin yonetici yetkisi gerekli")
		if isWindows {
			fmt.Println("  :: CMD'yi \"Yonetici olarak calistir\" ile acin")
		} else {
			fmt.Println("  :: sudo ile calistirin: sudo ./pardus-agent install")
		}
		return true
	}

	serverURL := installerParseServerURL(args)

	switch command {
	case "install":
		if isWindows {
			windowsInstall(serverURL)
		} else {
			linuxInstall(serverURL)
		}
	case "uninstall":
		if isWindows {
			windowsUninstall()
		} else {
			linuxUninstall()
		}
	case "status":
		if isWindows {
			windowsStatus()
		} else {
			linuxStatus()
		}
	}

	return true
}
