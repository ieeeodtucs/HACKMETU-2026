//go:build !windows

package main

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
)

var (
	ptyMu      sync.Mutex
	ptyFile    *os.File
	ptyCmd     *exec.Cmd
	ptyActive  bool
	ptyStopCh  chan struct{}
)

// startPTY spawns a PTY shell and starts streaming output
func startPTY(data map[string]interface{}) {
	ptyMu.Lock()
	defer ptyMu.Unlock()

	if ptyActive {
		log.Println("[PTY] Zaten aktif, önce durduruluyor...")
		stopPTYLocked()
	}

	// Determine shell
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
		if _, err := exec.LookPath(shell); err != nil {
			shell = "/bin/sh"
		}
	}

	// Get initial size
	rows := 24
	cols := 80
	if v, ok := data["rows"].(float64); ok && v > 0 {
		rows = int(v)
	}
	if v, ok := data["cols"].(float64); ok && v > 0 {
		cols = int(v)
	}

	log.Printf("[PTY] Başlatılıyor: shell=%s rows=%d cols=%d", shell, rows, cols)

	// Spawn PTY
	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
	)

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
	if err != nil {
		log.Printf("[PTY] Başlatma hatası: %v", err)
		sendMessage(map[string]interface{}{
			"type":    "pty_error",
			"agentId": agentID,
			"data": map[string]interface{}{
				"error": err.Error(),
			},
		})
		return
	}

	ptyFile = ptmx
	ptyCmd = cmd
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

	// Read PTY output and send to server
	go func() {
		buf := make([]byte, 4096)
		for {
			select {
			case <-stopCh:
				return
			default:
			}

			n, err := ptmx.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("[PTY] Okuma hatası: %v", err)
				}
				// Shell exited
				ptyMu.Lock()
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
				ptyMu.Unlock()
				return
			}

			if n > 0 {
				// Send output as base64 to avoid JSON encoding issues with binary data
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

	// Wait for process to exit
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
					"code":   cmd.ProcessState.ExitCode(),
				},
			})
			stopPTYLocked()
		}
	}()
}

// writePTY writes input data to the PTY
func writePTY(data map[string]interface{}) {
	ptyMu.Lock()
	defer ptyMu.Unlock()

	if !ptyActive || ptyFile == nil {
		return
	}

	input, ok := data["input"].(string)
	if !ok || input == "" {
		return
	}

	_, err := ptyFile.Write([]byte(input))
	if err != nil {
		log.Printf("[PTY] Yazma hatası: %v", err)
	}
}

// resizePTY resizes the PTY window
func resizePTY(data map[string]interface{}) {
	ptyMu.Lock()
	defer ptyMu.Unlock()

	if !ptyActive || ptyFile == nil {
		return
	}

	rows, _ := data["rows"].(float64)
	cols, _ := data["cols"].(float64)
	if rows <= 0 || cols <= 0 {
		return
	}

	err := pty.Setsize(ptyFile, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
	if err != nil {
		log.Printf("[PTY] Boyutlandırma hatası: %v", err)
	}
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
			// Already closed
		default:
			close(ptyStopCh)
		}
		ptyStopCh = nil
	}

	if ptyFile != nil {
		ptyFile.Close()
		ptyFile = nil
	}

	if ptyCmd != nil && ptyCmd.Process != nil {
		// Give it a moment then force kill
		done := make(chan struct{})
		go func() {
			ptyCmd.Process.Signal(os.Interrupt)
			time.Sleep(500 * time.Millisecond)
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(1 * time.Second):
		}
		ptyCmd.Process.Kill()
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

// Ensure JSON is imported (used by message handler in main.go)
var _ = json.Marshal
