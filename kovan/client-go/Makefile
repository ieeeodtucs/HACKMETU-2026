APP_NAME = pardus-agent
VERSION = 2.0.0

# Default: build for current platform
build:
	go build -ldflags="-s -w" -o $(APP_NAME) .

# Linux AMD64 (Pardus/Debian)
linux:
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o $(APP_NAME)-linux-amd64 .

# Linux ARM64
linux-arm:
	GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o $(APP_NAME)-linux-arm64 .

# Windows AMD64
windows:
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o $(APP_NAME)-windows-amd64.exe .

# All platforms
all: linux linux-arm windows

# Run locally
run:
	go run . $(ARGS)

# Clean
clean:
	rm -f $(APP_NAME) $(APP_NAME)-linux-* $(APP_NAME)-windows-*

.PHONY: build linux linux-arm windows all run clean
