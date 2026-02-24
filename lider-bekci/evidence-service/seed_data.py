"""
Seed data — populate the database with demo data matching the frontend mock data
"""
from datetime import datetime
from models import Client, PolicyDefinition, EvidenceLog
from database import SessionLocal, init_db


def seed():
    """Insert demo data if the DB is empty"""
    init_db()
    db = SessionLocal()

    # Only seed if empty
    if db.query(Client).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return

    # ── Clients ───────────────────────────────────────────────
    clients = [
        Client(id=1, hostname="pardus-pc-001", ip="192.168.1.10", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 25),
               compliance_status="compliant", compliance_score=100, online=True),
        Client(id=2, hostname="pardus-pc-002", ip="192.168.1.11", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 28),
               compliance_status="compliant", compliance_score=100, online=True),
        Client(id=3, hostname="pardus-pc-003", ip="192.168.1.12", os="Pardus 21",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 18, 45),
               compliance_status="non_compliant", compliance_score=60, online=True,
               violations='["SSH root erişimi açık", "Firewall devre dışı"]'),
        Client(id=4, hostname="pardus-pc-004", ip="192.168.1.13", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 30),
               compliance_status="compliant", compliance_score=95, online=True),
        Client(id=5, hostname="pardus-pc-005", ip="192.168.1.14", os="Pardus 23",
               plugin_status="not_installed", last_check=None,
               compliance_status="pending", compliance_score=0, online=True),
        Client(id=6, hostname="pardus-pc-006", ip="192.168.1.15", os="Pardus 21",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 17, 10),
               compliance_status="non_compliant", compliance_score=45, online=False,
               violations='["Parola politikası uyumsuz", "USB kısıtlaması yok", "NTP yapılandırılmamış"]'),
        Client(id=7, hostname="pardus-pc-007", ip="192.168.1.16", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 20),
               compliance_status="compliant", compliance_score=100, online=True),
        Client(id=8, hostname="pardus-pc-008", ip="192.168.1.17", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 15),
               compliance_status="compliant", compliance_score=90, online=True),
        Client(id=9, hostname="pardus-pc-009", ip="192.168.1.18", os="Pardus 21",
               plugin_status="not_installed", last_check=None,
               compliance_status="pending", compliance_score=0, online=False),
        Client(id=10, hostname="pardus-pc-010", ip="192.168.1.19", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 16, 50),
               compliance_status="non_compliant", compliance_score=70, online=True,
               violations='["Güncel olmayan paketler"]'),
        Client(id=11, hostname="pardus-pc-011", ip="192.168.1.20", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 29),
               compliance_status="compliant", compliance_score=100, online=True),
        Client(id=12, hostname="pardus-pc-012", ip="192.168.1.21", os="Pardus 23",
               plugin_status="installed", last_check=datetime(2026, 2, 21, 19, 0),
               compliance_status="compliant", compliance_score=85, online=False),
    ]
    db.add_all(clients)

    # ── Policy Definitions ────────────────────────────────────
    policies = [
        PolicyDefinition(id=1, policy_name="SSH Güvenlik Politikası",
                         description="Root SSH girişi kapatılmalı, anahtar tabanlı kimlik doğrulama zorunlu",
                         total_checked=43, compliant=38, non_compliant=5,
                         compliance_rate=88.4, severity="critical", category="security"),
        PolicyDefinition(id=2, policy_name="Firewall Politikası",
                         description="UFW/iptables aktif olmalı, sadece izin verilen portlar açık",
                         total_checked=43, compliant=40, non_compliant=3,
                         compliance_rate=93.0, severity="critical", category="security"),
        PolicyDefinition(id=3, policy_name="Parola Politikası",
                         description="Minimum 12 karakter, büyük-küçük harf, rakam ve özel karakter zorunlu",
                         total_checked=43, compliant=35, non_compliant=8,
                         compliance_rate=81.4, severity="high", category="authentication"),
        PolicyDefinition(id=4, policy_name="USB Kısıtlama Politikası",
                         description="Yetkisiz USB cihazları engellenmeli",
                         total_checked=43, compliant=41, non_compliant=2,
                         compliance_rate=95.3, severity="medium", category="device"),
        PolicyDefinition(id=5, policy_name="NTP Senkronizasyonu",
                         description="Sistem saati NTP sunucusu ile senkronize olmalı",
                         total_checked=43, compliant=39, non_compliant=4,
                         compliance_rate=90.7, severity="low", category="configuration"),
        PolicyDefinition(id=6, policy_name="Paket Güncellik Politikası",
                         description="Güvenlik güncellemeleri 7 gün içinde uygulanmalı",
                         total_checked=43, compliant=30, non_compliant=13,
                         compliance_rate=69.8, severity="high", category="update"),
        PolicyDefinition(id=7, policy_name="Disk Şifreleme Politikası",
                         description="LUKS disk şifreleme aktif olmalı",
                         total_checked=43, compliant=42, non_compliant=1,
                         compliance_rate=97.7, severity="critical", category="security"),
        PolicyDefinition(id=8, policy_name="Log Yönetimi Politikası",
                         description="rsyslog aktif olmalı, loglar merkezi sunucuya iletilmeli",
                         total_checked=43, compliant=37, non_compliant=6,
                         compliance_rate=86.0, severity="medium", category="monitoring"),
    ]
    db.add_all(policies)

    # ── Evidence Logs ─────────────────────────────────────────
    logs = [
        EvidenceLog(id=1, timestamp=datetime(2026, 2, 21, 19, 30), client="pardus-pc-003",
                    policy="SSH Güvenlik Politikası", result="non_compliant",
                    detail="Root SSH girişi aktif durumda. /etc/ssh/sshd_config dosyasında PermitRootLogin=yes"),
        EvidenceLog(id=2, timestamp=datetime(2026, 2, 21, 19, 28), client="pardus-pc-002",
                    policy="Firewall Politikası", result="compliant",
                    detail="UFW aktif. Sadece 22, 80, 443 portları açık."),
        EvidenceLog(id=3, timestamp=datetime(2026, 2, 21, 19, 25), client="pardus-pc-001",
                    policy="Parola Politikası", result="compliant",
                    detail="PAM konfigürasyonu uyumlu. Minimum 12 karakter, karmaşıklık kuralları aktif."),
        EvidenceLog(id=4, timestamp=datetime(2026, 2, 21, 19, 20), client="pardus-pc-006",
                    policy="USB Kısıtlama Politikası", result="non_compliant",
                    detail="USB kısıtlama kuralı tanımlı değil. udev kuralları eksik."),
        EvidenceLog(id=5, timestamp=datetime(2026, 2, 21, 19, 15), client="pardus-pc-008",
                    policy="NTP Senkronizasyonu", result="compliant",
                    detail="chrony servisi aktif. Sunucu: ntp.pardus.org.tr ile senkronize."),
        EvidenceLog(id=6, timestamp=datetime(2026, 2, 21, 19, 10), client="pardus-pc-010",
                    policy="Paket Güncellik Politikası", result="non_compliant",
                    detail="15 adet güvenlik güncellemesi beklemede. Son güncelleme: 12 gün önce."),
        EvidenceLog(id=7, timestamp=datetime(2026, 2, 21, 19, 5), client="pardus-pc-006",
                    policy="Parola Politikası", result="non_compliant",
                    detail="PAM konfigürasyonunda minimum karakter sayısı 8 olarak ayarlı. Beklenen: 12"),
        EvidenceLog(id=8, timestamp=datetime(2026, 2, 21, 19, 0), client="pardus-pc-004",
                    policy="Disk Şifreleme Politikası", result="compliant",
                    detail="LUKS şifreleme aktif. /dev/sda2 şifreli bölüm."),
        EvidenceLog(id=9, timestamp=datetime(2026, 2, 21, 18, 55), client="pardus-pc-003",
                    policy="Firewall Politikası", result="non_compliant",
                    detail="UFW devre dışı. Tüm portlar açık durumda."),
        EvidenceLog(id=10, timestamp=datetime(2026, 2, 21, 18, 50), client="pardus-pc-007",
                    policy="Log Yönetimi Politikası", result="compliant",
                    detail="rsyslog aktif. Merkezi log sunucusu: 192.168.1.100:514"),
        EvidenceLog(id=11, timestamp=datetime(2026, 2, 21, 18, 45), client="pardus-pc-006",
                    policy="NTP Senkronizasyonu", result="non_compliant",
                    detail="chrony servisi yüklü değil. Sistem saati 3 dakika geride."),
        EvidenceLog(id=12, timestamp=datetime(2026, 2, 21, 18, 40), client="pardus-pc-011",
                    policy="SSH Güvenlik Politikası", result="compliant",
                    detail="Root SSH girişi kapalı. Anahtar tabanlı kimlik doğrulama aktif."),
    ]
    db.add_all(logs)

    db.commit()
    db.close()
    print("✅ Database seeded with demo data.")


if __name__ == "__main__":
    seed()
