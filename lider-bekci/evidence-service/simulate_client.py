"""
Ahenk Client Simulator — Demo amaçlı istemci simülatörü

Bu script, gerçek bir Ahenk istemcisi gibi davranarak
compliance kontrollerini çalıştırır ve sonuçları Evidence Service'e gönderir.

Kullanım:
    python3 simulate_client.py              # tek seferlik kontrol
    python3 simulate_client.py --loop       # 30 sn'de bir sürekli kontrol
"""
import requests
import random
import time
import sys
from datetime import datetime

EVIDENCE_SERVICE_URL = "http://localhost:5000"
REPORT_ENDPOINT = f"{EVIDENCE_SERVICE_URL}/api/compliance/report"

# Simüle edilecek istemciler
CLIENTS = [
    "pardus-pc-001", "pardus-pc-002", "pardus-pc-003",
    "pardus-pc-004", "pardus-pc-007", "pardus-pc-008",
    "pardus-pc-010", "pardus-pc-011", "pardus-pc-012",
]

# Politika kontrolleri ve olası sonuçlar
POLICY_CHECKS = [
    {
        "policy": "SSH Güvenlik Politikası",
        "compliant_detail": "Root SSH girişi kapalı. Anahtar tabanlı kimlik doğrulama aktif.",
        "non_compliant_detail": "Root SSH girişi aktif durumda. /etc/ssh/sshd_config dosyasında PermitRootLogin=yes",
        "compliance_probability": 0.85,
    },
    {
        "policy": "Firewall Politikası",
        "compliant_detail": "UFW aktif. Sadece 22, 80, 443 portları açık.",
        "non_compliant_detail": "UFW devre dışı. Tüm portlar açık durumda.",
        "compliance_probability": 0.90,
    },
    {
        "policy": "Parola Politikası",
        "compliant_detail": "PAM konfigürasyonu uyumlu. Minimum 12 karakter, karmaşıklık kuralları aktif.",
        "non_compliant_detail": "PAM konfigürasyonunda minimum karakter sayısı 8 olarak ayarlı. Beklenen: 12",
        "compliance_probability": 0.80,
    },
    {
        "policy": "NTP Senkronizasyonu",
        "compliant_detail": "chrony servisi aktif. Sunucu: ntp.pardus.org.tr ile senkronize.",
        "non_compliant_detail": "chrony servisi yüklü değil. Sistem saati senkronize değil.",
        "compliance_probability": 0.88,
    },
    {
        "policy": "Paket Güncellik Politikası",
        "compliant_detail": "Tüm güvenlik güncellemeleri uygulanmış. Son güncelleme: bugün.",
        "non_compliant_detail": "Güvenlik güncellemeleri beklemede. Son güncelleme: 10+ gün önce.",
        "compliance_probability": 0.70,
    },
    {
        "policy": "Log Yönetimi Politikası",
        "compliant_detail": "rsyslog aktif. Merkezi log sunucusu: 192.168.1.100:514",
        "non_compliant_detail": "rsyslog servisi çalışmıyor. Loglar merkezi sunucuya iletilemiyor.",
        "compliance_probability": 0.85,
    },
]


def run_check(client_hostname):
    """Bir istemci için rastgele bir politika kontrolü çalıştır"""
    check = random.choice(POLICY_CHECKS)
    is_compliant = random.random() < check["compliance_probability"]

    report = {
        "hostname": client_hostname,
        "policy": check["policy"],
        "result": "compliant" if is_compliant else "non_compliant",
        "detail": check["compliant_detail"] if is_compliant else check["non_compliant_detail"],
    }

    try:
        resp = requests.post(REPORT_ENDPOINT, json=report, timeout=5)
        status = "✅" if is_compliant else "❌"
        print(f"  {status} [{client_hostname}] {check['policy']}: {'UYUMLU' if is_compliant else 'UYUMSUZ'}")
        return resp.status_code == 200
    except requests.exceptions.ConnectionError:
        print(f"  ⚠️  Evidence Service'e bağlanılamadı! ({EVIDENCE_SERVICE_URL})")
        return False


def run_all_checks():
    """Tüm istemciler için kontrol çalıştır"""
    print(f"\n{'='*60}")
    print(f"🔍 Compliance Taraması — {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}")

    for client in CLIENTS:
        # Her istemci için 1-3 rastgele kontrol
        num_checks = random.randint(1, 3)
        for _ in range(num_checks):
            run_check(client)

    print(f"{'='*60}")
    print(f"✅ Tarama tamamlandı. {len(CLIENTS)} istemci kontrol edildi.")


if __name__ == "__main__":
    if "--loop" in sys.argv:
        print("🔄 Sürekli tarama modu (30 sn aralıkla). Durdurmak için Ctrl+C")
        while True:
            run_all_checks()
            time.sleep(30)
    else:
        run_all_checks()
