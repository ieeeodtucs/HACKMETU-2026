//go:build windows

package main

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"
)

var (
	ptyMu      sync.Mutex
	ptyCmd     *exec.Cmd
	ptyStdin   io.WriteCloser
	ptyActive  bool
	ptyStopCh  chan struct{}
)

// startPTY spawns a cmd.exe process with piped I/O (Windows fallback - no real PTY)
func startPTY(data map[string]interface{}) {
	ptyMu.Lock()
	defer ptyMu.Unlock()

	if ptyActive {
		log.Println("[PTY] Zaten aktif, önce durduruluyor...")
		stopPTYLocked()
	}

	shell := "cmd.exe"
	if ps, err := exec.LookPath("powershell.exe"); err == nil {
		shell = ps
	}

	rows := 24
	cols := 80
	if v, ok := data["rows"].(float64); ok && v > 0 {
		rows = int(v)
	}
	if v, ok := data["cols"].(float64); ok && v > 0 {
		cols = int(v)
	}

	log.Printf("[PTY] Başlatılıyor (Windows pipe): shell=%s rows=%d cols=%d", shell, rows, cols)

	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	stdin, err := cmd.StdinPipe()
	if err != nil {
		log.Printf("[PTY] StdinPipe hatası: %v", err)
		sendPTYError(err.Error())
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[PTY] StdoutPipe hatası: %v", err)
		sendPTYError(err.Error())
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		log.Printf("[PTY] StderrPipe hatası: %v", err)
		sendPTYError(err.Error())
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("[PTY] Başlatma hatası: %v", err)
		sendPTYError(err.Error())
		return
	}

	ptyCmd = cmd
	ptyStdin = stdin
	ptyActive = true
	ptyStopCh = make(chan struct{})
	stopCh := ptyStopCh

	sendMessage(map[string]interface{}{
		"type":    "pty_started",
		"agentId": agentID,
		"data": map[string]interface{}{
			"shell": shell,
			"rows":  rows,
			"cols":  cols,
		},
	})

	// Read stdout
	go func() {
		buf := make([]byte, 4096)
		for {
			select {
			case <-stopCh:
				return
			default:
			}
			n, err := stdout.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				sendMessage(map[string]interface{}{
					"type":    "pty_output",
					"agentId": agentID,
					"data": map[string]interface{}{
						"output": string(buf[:n]),
					},
				})
			}
		}
	}()

	// Read stderr
	go func() {
		buf := make([]byte, 4096)
		for {
			select {
			case <-stopCh:
				return
			default:
			}
			n, err := stderr.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				sendMessage(map[string]interface{}{
					"type":    "pty_output",
					"agentId": agentID,
					"data": map[string]interface{}{
						"output": string(buf[:n]),
					},
				})
			}
		}
	}()

	// Wait for process exit
	go func() {
		err := cmd.Wait()
		log.Printf("[PTY] Shell kapandı: %v", err)

		ptyMu.Lock()
		defer ptyMu.Unlock()
		if ptyActive {
			sendMessage(map[string]interface{}{
				"type":    "pty_exit",
				"agentId": agentID,
				"data": map[string]interface{}{
					"reason": "Shell kapandı",
				},
			})
			stopPTYLocked()
		}
	}()
}

func sendPTYError(msg string) {
	sendMessage(map[string]interface{}{
		"type":    "pty_error",
		"agentId": agentID,
		"data": map[string]interface{}{
			"error": msg,
		},
	})
}

// writePTY writes input to the PTY stdin
func writePTY(data map[string]interface{}) {
	ptyMu.Lock()
	defer ptyMu.Unlock()

	if !ptyActive || ptyStdin == nil {
		return
	}

	input, ok := data["input"].(string)
	if !ok || input == "" {
		return
	}

	_, err := ptyStdin.Write([]byte(input))
	if err != nil {
		log.Printf("[PTY] Yazma hatası: %v", err)
	}
}

// resizePTY is a no-op on Windows (no real PTY)
func resizePTY(data map[string]interface{}) {
	// Windows piped I/O doesn't support resize
	log.Println("[PTY] Resize Windows'ta desteklenmiyor")
}

// stopPTY stops the PTY session
func stopPTY() {
	ptyMu.Lock()
	defer ptyMu.Unlock()
	stopPTYLocked()
}

func stopPTYLocked() {
	if ptyStopCh != nil {
		select {
		case <-ptyStopCh:
		default:
			close(ptyStopCh)
		}
		ptyStopCh = nil
	}

	if ptyStdin != nil {
		ptyStdin.Close()
		ptyStdin = nil
	}

	if ptyCmd != nil && ptyCmd.Process != nil {
		done := make(chan struct{})
		go func() {
			ptyCmd.Process.Kill()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
		}
		ptyCmd = nil
	}

	if ptyActive {
		ptyActive = false
		sendMessage(map[string]interface{}{
			"type":    "pty_stopped",
			"agentId": agentID,
		})
		log.Println("[PTY] Durduruldu")
	}
}

var _ = json.Marshal
