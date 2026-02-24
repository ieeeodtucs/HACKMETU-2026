#!/bin/bash

echo "====================================================="
echo "        LiderAhenk ML Uyum Yonetimi Baslatiliyor      "
echo "                (Hackathon Demo)                     "
echo "====================================================="

# Dizin kontrolü
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Backend (Evidence Service) başlat
echo "[1/3] Evidence Service (Python FastAPI) baslatiliyor..."
cd "$SCRIPT_DIR/evidence-service" || exit

if [ ! -d "venv" ]; then
    echo "Sanal ortam (venv) bulunamadi. Olusturuluyor..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    python3 seed_data.py
else
    source venv/bin/activate
fi

# Eski 5000 portunu temizle
fuser -k 5000/tcp 2>/dev/null
sleep 1
nohup uvicorn app:app --host 0.0.0.0 --port 5000 > evidence_dashboard.log 2>&1 &
echo "      -> Evidence Service 5000 portunda arka planda baslatildi."

# Frontend (Vue.js LiderUI) başlat
echo "[2/3] LiderUI Frontend (Vue.js) baslatiliyor..."
cd "$SCRIPT_DIR/liderui" || exit

# Port 8081 bos mu kontrol et
fuser -k 8081/tcp 2>/dev/null

echo "      -> Vue development server 8081 portunda ayaga kalkiyor..."
echo "[3/3] Demo hazir! Sisteme http://localhost:8081 altindan (Uyum Yonetimi sekmesinden) ulasabilirsiniz."
echo "      (Durdurmak icin bu terminal ekraninda 'Ctrl + C' tuslarina basiniz.)"

# Frontend'i on planda çalıştır (kapatıldığında backend de kapansın diye trap ekliyoruz)
trap "echo 'Kapatiliyor...'; fuser -k 5000/tcp 2>/dev/null; exit" INT TERM
npm run serve
