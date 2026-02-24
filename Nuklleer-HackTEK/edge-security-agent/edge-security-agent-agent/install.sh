#!/bin/bash
# HackTEK Agent Otomatik Kurulum Betiği

echo "🚀 HackTEK İstemci Kurulumu Başlıyor..."

# 1. Gerekli Dizinleri Oluştur
sudo mkdir -p /opt/hacktek-agent
sudo mkdir -p /etc/hacktek-agent
sudo mkdir -p /var/lib/hacktek-agent

# 2. Sistem Bağımlılıklarını Yükle
sudo apt update
sudo apt install -y python3-pip python3-psutil
pip3 install httpx pyyaml --break-system-packages

# 3. Dosyaları Yerlerine Yerleştir
sudo cp agent.py /opt/hacktek-agent/
sudo cp config.yaml /etc/hacktek-agent/config.yaml

# 4. Systemd Servis Dosyasını Oluştur
# Bu kısım, ajanın bilgisayar açıldığında otomatik başlamasını sağlar.
sudo bash -c 'cat <<EOF > /etc/systemd/system/hacktek-agent.service
[Unit]
Description=HackTEK Güvenlik Ajanı
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/hacktek-agent/agent.py
WorkingDirectory=/opt/hacktek-agent
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF'

# 5. Servisi Aktifleştir ve Başlat
sudo systemctl daemon-reload
sudo systemctl enable hacktek-agent
sudo systemctl start hacktek-agent

echo "✅ Kurulum başarıyla tamamlandı!"
echo "📡 Ajan şu an arka planda çalışıyor."
echo "Durum kontrolü için: systemctl status hacktek-agent"