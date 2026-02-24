import sys
import time
import json
import requests
from cryptography.fernet import Fernet
from datetime import datetime

# Lider Arayuzu / Evidence Service'in çalıştığı IP (Lider sunucusunda çalıştığı için localhost kalır)
EVIDENCE_URL = "http://127.0.0.1:5000/api/compliance/report"

HOST_IPS = {
    "pardus@pardus": "10.36.133.13",
    "demo-ali@pardus": "10.36.133.246"
}

SECRET_KEY = b"vXoGkL4ZPOZVRfzgO4PU1234567890abcdefghijklm="
cipher_suite = Fernet(SECRET_KEY)

def report_to_lider(hostname, detail, is_anomalous=False):
    payload = {
        "hostname": hostname,
        "username": "system",
        "policy": "USB Anomaly Scan",
        "result": "non_compliant" if is_anomalous else "compliant",
        "detail": detail
    }
    try:
        requests.post(EVIDENCE_URL, json=payload, timeout=2)
    except Exception as e:
        print(f"Error reporting to Lider: {e}")

def fetch_and_decrypt(hostname):
    ip = HOST_IPS.get(hostname, "127.0.0.1")
    pardus_url = f"http://{ip}:8000/scan"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to Pardus server at {pardus_url}...")
    try:
        response = requests.get(pardus_url, timeout=5)
        response.raise_for_status()

        encrypted_payload = response.json().get("data")
        
        if not encrypted_payload:
            report_to_lider(hostname, "Server returned empty data.", True)
            return

        decrypted_bytes = cipher_suite.decrypt(encrypted_payload.encode('utf-8'))
        raw_json_string = decrypted_bytes.decode('utf-8')
        
        try:
            if raw_json_string.startswith('"') and raw_json_string.endswith('"'):
                raw_json_string = raw_json_string[1:-1].replace('\\"', '"')
            devices = json.loads(raw_json_string)
        except json.JSONDecodeError as e:
            report_to_lider(hostname, f"Failed to parse JSON! {e}", True)
            devices = []

        if isinstance(devices, str):
            try:
                devices = json.loads(devices)
            except:
                pass

        if not isinstance(devices, list):
            report_to_lider(hostname, "Veri formati gecersiz. Liste bekleniyordu.", True)
            return

        for dev in devices:
            if not isinstance(dev, dict):
                continue
            name = dev.get('name', 'N/A')
            dev_type = dev.get('type', 'N/A')
            is_usb = dev.get('is_usb', False)
            anomalous = dev.get('is_anomalous', False)
            score = dev.get('anomaly_score', 0.0)
            
            status_icon = "❌ ANOMALOUS" if anomalous else "✅ SAFE"
            usb_icon = "🔌 USB" if is_usb else "💻 INTERNAL"

            detail_msg = f"{status_icon} | {usb_icon} | Name: {name.upper()[:10]:<10} | Type: {dev_type:<6} | ML Score: {score}"
            report_to_lider(hostname, detail_msg, anomalous)
            print(detail_msg)

    except requests.exceptions.ConnectionError:
        err_msg = f"Error: Could not connect to the Pardus ML server at {pardus_url}. Is the API running?"
        report_to_lider(hostname, err_msg, True)
        print(err_msg)
    except Exception as e:
        err_msg = f"Decryption or parsing error: {e}"
        report_to_lider(hostname, err_msg, True)
        print(err_msg)

if __name__ == "__main__":
    hostnames = sys.argv[1:] if len(sys.argv) > 1 else list(HOST_IPS.keys())
    
    for host in hostnames:
        print(f"Starting Liderahenk Remote Decryption Client for {host}...\n")
        report_to_lider(host, "USB Anomaly ML Ajanı Başlatıldı! Pardus sunucusuna bağlanılıyor...", False)
    
    # Hakaton demosu için sonsuz döngü yerine 10 iterasyon yapıyoruz (30 saniye sürer)
    for _ in range(10):
        for host in hostnames:
            fetch_and_decrypt(host)
        time.sleep(3)
        
    for host in hostnames:
        report_to_lider(host, "USB Anomaly ML Ajanı taramayı tamamladı.", False)
