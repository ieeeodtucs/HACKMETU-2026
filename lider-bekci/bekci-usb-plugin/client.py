import time
import json
import requests
from cryptography.fernet import Fernet
from datetime import datetime

# ===================================================================
# PARDUS API SERVER CONFIGURATION
# ===================================================================
# Bu adresi Pardus makinenin gercek IP'si ile degistirebilirsiniz.
# Ayni makinede deniyorsaniz http://127.0.0.1:8000/scan kalabilir.
PARDUS_URL = "http://127.0.0.1:8000/scan"

# Bu sifre, Pardus tarafindaki main.py icerisine gomulu olan sabit sifredir.
# Kesinlikle degistirmeyin. Aksi taktirde veriler cozumlenemez!
SECRET_KEY = b"vXoGkL4ZPOZVRfzgO4PU1234567890abcdefghijklm="

cipher_suite = Fernet(SECRET_KEY)

def fetch_and_decrypt():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to Pardus server at {PARDUS_URL}...")
    try:
        # 1. Sunucuya veriyi getirmesi icin istek at
        response = requests.get(PARDUS_URL, timeout=5)
        response.raise_for_status()

        # 2. Yanittan sadece sifreli payload "data" kismini al
        encrypted_payload = response.json().get("data")
        
        if not encrypted_payload:
            print("Server returned empty data.")
            return

        # 3. Sifreyi coz (AES Decryption)
        decrypted_bytes = cipher_suite.decrypt(encrypted_payload.encode('utf-8'))
        
        # 4. JSON formatina cevirip ekrana bas (FastAPI + json.dumps cift parse gerektiriyor olabilir)
        raw_json_string = decrypted_bytes.decode('utf-8')
        
        try:
            # Gelen string'in en distaki tirnaklarini kaldirip parse ediyoruz
            if raw_json_string.startswith('"') and raw_json_string.endswith('"'):
                raw_json_string = raw_json_string[1:-1].replace('\\"', '"')
            
            devices = json.loads(raw_json_string)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON! {e}")
            devices = []
            
        print("\n" + "="*50)
        print("          🛡️  PARDUS USB ANOMALY SCAN  🛡️")
        print("="*50)

        if isinstance(devices, str):
            try:
                devices = json.loads(devices)
            except:
                pass

        if not isinstance(devices, list):
            print("Veri formati gecersiz. Liste bekleniyordu.")
            devices = []

        for dev in devices:
            if not isinstance(dev, dict):
                continue
            name = dev.get('name', 'N/A')
            dev_type = dev.get('type', 'N/A')
            is_usb = dev.get('is_usb', False)
            anomalous = dev.get('is_anomalous', False)
            score = dev.get('anomaly_score', 0.0)
            
            # Anomaly UI vurgusu
            status_icon = "❌ ANOMALOUS" if anomalous else "✅ SAFE"
            usb_icon = "🔌 USB DEVICE" if is_usb else "💻 INTERNAL TRAY"

            print(f"[{status_icon}] {usb_icon} | Name: {name.upper():<7} | Type: {dev_type:<6} | ML Score: {score}")

        print("="*50 + "\n")

    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the Pardus server. Is the API running?")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
    except Exception as e:
        print(f"Decryption or parsing error: {e}")

if __name__ == "__main__":
    # Konsolu temizle ve donguye gir. 5 Saniyede bir kontrol et.
    print("Starting Liderahenk Remote Decryption Client...\n")
    while True:
        fetch_and_decrypt()
        time.sleep(5)
