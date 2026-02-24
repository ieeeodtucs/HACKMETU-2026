import os
import json
import base64
import subprocess
import numpy as np
from contextlib import asynccontextmanager
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest

# Hardcoded Sabit Sifreleme Anahtari (Bunu hicbir zaman degistirmiyoruz)
ENCRYPTION_KEY_BYTES = b"vXoGkL4ZPOZVRfzgO4PU1234567890abcdefghijklm="

cipher_suite = Fernet(ENCRYPTION_KEY_BYTES)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bu kisim uygulama baslarken bir kez calisir
    print("=" * 60)
    print("PARDUS USB & ANOMALY DETECTOR STARTED")
    print("To access the application from a browser: http://<PARDUS_IP_ADDRESS>:8000")
    print("Local access: http://localhost:8000")
    print(f"ENCRYPTION KEY (STATIC): {ENCRYPTION_KEY_BYTES.decode('utf-8')}")
    print("=" * 60)
    yield
    # Bu kisim uygulama kapanirken calisir
    print("PARDUS USB & ANOMALY DETECTOR STOPPED.")

app = FastAPI(title="Pardus USB & Anomaly Detector Secure API", version="1.0.1", lifespan=lifespan)

class EncryptedResponse(BaseModel):
    data: str

def parse_size(size_str: str) -> float:
    """Convert string size like '10G', '500M' to float in Megabytes for ML feature extraction."""
    if not size_str:
        return 0.0
    size_str = str(size_str).upper().strip()
    try:
        if size_str.endswith('T'):
            return float(size_str[:-1]) * 1024 * 1024
        elif size_str.endswith('G'):
            return float(size_str[:-1]) * 1024
        elif size_str.endswith('M'):
            return float(size_str[:-1])
        elif size_str.endswith('K'):
            return float(size_str[:-1]) / 1024
        elif size_str.endswith('B'):
            return float(size_str[:-1]) / (1024 * 1024)
        else:
            return float(size_str)
    except:
        return 0.0

def get_block_devices():
    """Run lsblk to get block device info in a Debian/Pardus system."""
    try:
        result = subprocess.run(
            ['lsblk', '-J', '-o', 'NAME,TYPE,MOUNTPOINT,RM,SIZE,RO,TRAN'],
            capture_output=True, text=True, check=True
        )
        data = json.loads(result.stdout)
        return data.get('blockdevices', [])
    except Exception as e:
        # Fallback empty list if lsblk fails or not running on Linux
        print(f"Error reading block devices: {e}")
        return []

def flatten_devices(devices):
    flat_list = []
    for dev in devices:
        flat_list.append(dev)
        if 'children' in dev:
            flat_list.extend(flatten_devices(dev['children']))
    return flat_list

@app.get("/scan", response_model=EncryptedResponse)
def scan_devices():
    devices = flatten_devices(get_block_devices())
    
    if not devices:
        # Dummy data fallback (for testing on non-Linux dev env like Windows)
        devices = [
            {"name": "sda", "type": "disk", "mountpoint": None, "rm": False, "size": "500G", "ro": False, "tran": "sata"},
            {"name": "sdb", "type": "disk", "mountpoint": "/media/usb", "rm": True, "size": "16G", "ro": False, "tran": "usb"},
            {"name": "loop0", "type": "loop", "mountpoint": "/snap/core/1", "rm": False, "size": "55M", "ro": True, "tran": None}
        ]

    processed_devices = []
    features = []

    for dev in devices:
        # Pardus/Debian typically marks USBs natively with TRAN="usb" or RM=1 (removable)
        # Using a mix of transport type or removable flag to classify USB
        tran = str(dev.get('tran', '')).lower()
        rm = bool(dev.get('rm', False))
        mountpoint = dev.get('mountpoint')
        
        is_usb = False
        if tran == 'usb':
            is_usb = True
        elif rm and mountpoint and ('/media' in mountpoint or '/mnt' in mountpoint):
            is_usb = True
        elif rm and tran == '':
            is_usb = True # Fallback heuristic
            
        size_mb = parse_size(dev.get('size', '0'))
        is_ro = bool(dev.get('ro', False))

        # Feature Extraction for ML (Size, Removable, ReadOnly, is_usb encoded)
        features.append([
            size_mb,
            1.0 if rm else 0.0,
            1.0 if is_ro else 0.0,
            1.0 if is_usb else 0.0
        ])

        processed_devices.append({
            "name": dev.get('name', 'unknown'),
            "type": dev.get('type', 'unknown'),
            "mountpoint": mountpoint,
            "removable": rm,
            "size": dev.get('size', '0'),
            "read_only": is_ro,
            "is_usb": is_usb,
            "anomaly_score": 0.0,
            "is_anomalous": False
        })

    # Machine Learning Layer: Anomaly Detection using Isolation Forest
    # This acts as our "lightweight ML anomaly detection" for marketing in the competition.
    if len(features) > 1:
        X = np.array(features)
        
        # Configure IsolationForest: contamination defines the expected proportion of outliers.
        # We set an automatic threshold for anomalies.
        clf = IsolationForest(contamination='auto', random_state=42)
        
        # Fit the model and predict anomalies (-1 means anomalous, 1 means normal)
        predictions = clf.fit_predict(X)
        
        # Get anomaly scores (lower is more anomalous)
        scores = clf.decision_function(X)
        
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            processed_devices[i]['anomaly_score'] = round(float(score), 4)
            # Modeli sadece USB'ler icin guncelledik. ROM veya internal diskler anomaly sayilmayacak.
            if processed_devices[i]['is_usb']:
                processed_devices[i]['is_anomalous'] = bool(pred == -1)
            else:
                processed_devices[i]['is_anomalous'] = False
    elif len(features) == 1:
        processed_devices[0]['anomaly_score'] = 1.0
        processed_devices[0]['is_anomalous'] = False

    # Convert mapping list to JSON string
    json_payload = json.dumps(processed_devices)
    
    # Encrypt the payload using our Fernet cipher
    encrypted_payload_bytes = cipher_suite.encrypt(json_payload.encode('utf-8'))
    encrypted_payload_string = encrypted_payload_bytes.decode('utf-8')

    return {"data": encrypted_payload_string}

@app.get("/")
def read_root():
    return {
        "message": "Pardus USB & Anomaly Detector API is running.",
        "endpoints": {
            "GET /scan": "Scan system block devices, detect USBs, and run ML anomaly detection."
        }
    }

if __name__ == "__main__":
    import uvicorn
    # 0.0.0.0 yapmak disaridan (Windows vb.) Pardus'a HTTP istegi atilabilmesini saglar
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

