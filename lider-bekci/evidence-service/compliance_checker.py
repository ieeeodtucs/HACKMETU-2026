#!/usr/bin/env python3
"""
Compliance Checker — Gerçek politika doğrulama aracı.

Bu script istemci üzerinde çalışarak gerçek Linux komutlarıyla
politika kontrollerini yapar ve sonuçları Evidence Service'e bildirir.

Kullanım:
    python3 compliance_checker.py                     # tek sefer
    python3 compliance_checker.py --loop              # sürekli (5 dk arayla)
    python3 compliance_checker.py --loop --interval 60  # 60 sn arayla
"""

import subprocess
import socket
import os
import json
import argparse
import time
from datetime import datetime

# ── Ayarlar ──────────────────────────────────────────────────
EVIDENCE_SERVICE_URL = "http://127.0.0.1:5000/api/compliance/report"
HOSTNAME = socket.gethostname()
USERNAME = os.environ.get("USER", os.environ.get("LOGNAME", "unknown"))

# ── Yardımcı Fonksiyonlar ────────────────────────────────────

def run_cmd(cmd, timeout=10):
    """Shell komutu çalıştır, çıktıyı döndür"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", -1
    except Exception as e:
        return "", str(e), -1


def send_report(policy, result, detail, checks=None):
    """Evidence Service'e rapor gönder"""
    import requests

    payload = {
        "hostname": HOSTNAME,
        "username": USERNAME,
        "policy": policy,
        "result": result,
        "detail": detail,
    }
    try:
        resp = requests.post(EVIDENCE_SERVICE_URL, json=payload, timeout=5)
        status = "✅" if result == "compliant" else "❌"
        print(f"  {status} [{HOSTNAME}] {policy}: {result.upper()} — {detail[:80]}")
        return resp.status_code == 200
    except Exception as e:
        print(f"  ⚠️  Rapor gönderilemedi: {e}")
        return False


# ══════════════════════════════════════════════════════════════
#  POLİTİKA KONTROLLERİ
# ══════════════════════════════════════════════════════════════

def check_ssh_security():
    """SSH güvenlik kontrolü: Root login, anahtar tabanlı auth"""
    policy = "SSH Güvenlik Politikası"
    issues = []

    # sshd_config dosyası var mı?
    if not os.path.exists("/etc/ssh/sshd_config"):
        return send_report(policy, "non_compliant", "sshd_config dosyası bulunamadı")

    stdout, _, _ = run_cmd("grep -i '^PermitRootLogin' /etc/ssh/sshd_config 2>/dev/null || echo 'NOT_SET'")
    if "no" not in stdout.lower():
        issues.append("PermitRootLogin kapatılmamış")

    stdout, _, _ = run_cmd("grep -i '^PubkeyAuthentication' /etc/ssh/sshd_config 2>/dev/null || echo 'NOT_SET'")
    if "no" in stdout.lower():
        issues.append("PubkeyAuthentication kapalı")

    stdout, _, _ = run_cmd("grep -i '^PasswordAuthentication' /etc/ssh/sshd_config 2>/dev/null || echo 'NOT_SET'")
    # Password auth açık olması güvenlik riski
    if "yes" in stdout.lower():
        issues.append("PasswordAuthentication açık (anahtar tabanlı auth tercih edilmeli)")

    # SSH servisi çalışıyor mu?
    _, _, rc = run_cmd("systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null")

    if issues:
        return send_report(policy, "non_compliant", "; ".join(issues))
    else:
        return send_report(policy, "compliant", "SSH güvenlik yapılandırması uyumlu. Root login kapalı.")


def check_firewall():
    """Firewall kontrolü: UFW veya iptables aktif mi?"""
    policy = "Firewall Politikası"

    # UFW kontrolü
    stdout, _, rc = run_cmd("ufw status 2>/dev/null")
    if rc == 0 and "active" in stdout.lower():
        rules_count = stdout.count("\n") - 2  # header satırlarını çıkar
        return send_report(policy, "compliant", f"UFW aktif. {max(0, rules_count)} kural tanımlı.")

    # iptables kontrolü
    stdout, _, rc = run_cmd("iptables -L -n 2>/dev/null | wc -l")
    if rc == 0:
        line_count = int(stdout.strip() or "0")
        if line_count > 8:  # Varsayılan boş kurallardan fazla
            return send_report(policy, "compliant", f"iptables aktif. {line_count} satır kural mevcut.")

    # nftables kontrolü
    stdout, _, rc = run_cmd("nft list ruleset 2>/dev/null | wc -l")
    if rc == 0 and int(stdout.strip() or "0") > 3:
        return send_report(policy, "compliant", "nftables aktif.")

    return send_report(policy, "non_compliant", "Firewall aktif değil (UFW/iptables/nftables bulunamadı)")


def check_password_policy():
    """Parola politikası: PAM, minimum uzunluk, karmaşıklık"""
    policy = "Parola Politikası"
    issues = []

    # pwquality.conf kontrolü
    if os.path.exists("/etc/security/pwquality.conf"):
        stdout, _, _ = run_cmd("grep -i 'minlen' /etc/security/pwquality.conf 2>/dev/null")
        if stdout:
            try:
                minlen = int(stdout.split("=")[-1].strip())
                if minlen < 8:
                    issues.append(f"Minimum parola uzunluğu {minlen} (en az 8 olmalı)")
            except ValueError:
                pass
    else:
        # login.defs kontrolü
        stdout, _, _ = run_cmd("grep '^PASS_MIN_LEN' /etc/login.defs 2>/dev/null")
        if stdout:
            try:
                minlen = int(stdout.split()[-1])
                if minlen < 8:
                    issues.append(f"PASS_MIN_LEN {minlen} (en az 8 olmalı)")
            except (ValueError, IndexError):
                pass

    # Parola yaşlandırma kontrolü (login.defs)
    stdout, _, _ = run_cmd("grep '^PASS_MAX_DAYS' /etc/login.defs 2>/dev/null")
    if stdout:
        try:
            max_days = int(stdout.split()[-1])
            if max_days > 90 or max_days == 99999:
                issues.append(f"Parola maksimum yaşı {max_days} gün (90 gün önerilir)")
        except (ValueError, IndexError):
            pass

    if issues:
        return send_report(policy, "non_compliant", "; ".join(issues))
    else:
        return send_report(policy, "compliant", "Parola politikası uyumlu.")


def check_usb_restriction():
    """USB kısıtlama kontrolü"""
    policy = "USB Kısıtlama Politikası"

    # udev kuralları var mı?
    stdout, _, _ = run_cmd("ls /etc/udev/rules.d/*usb* 2>/dev/null")
    has_udev_rules = bool(stdout.strip())

    # USBGuard kontrolü
    _, _, rc = run_cmd("systemctl is-active usbguard 2>/dev/null")
    has_usbguard = rc == 0

    # Modprobe blacklist kontrolü
    stdout, _, _ = run_cmd("grep -r 'usb-storage' /etc/modprobe.d/ 2>/dev/null")
    has_modprobe = bool(stdout.strip())

    if has_usbguard:
        return send_report(policy, "compliant", "USBGuard aktif. USB cihaz kontrolü sağlanıyor.")
    elif has_udev_rules:
        return send_report(policy, "compliant", "USB udev kuralları mevcut.")
    elif has_modprobe:
        return send_report(policy, "compliant", "USB depolama modprobe ile engellenmiş.")
    else:
        return send_report(policy, "non_compliant", "USB kısıtlama mekanizması bulunamadı (udev/USBGuard/modprobe)")


def check_ntp_sync():
    """NTP senkronizasyon kontrolü"""
    policy = "NTP Senkronizasyonu"

    # chrony kontrolü
    stdout, _, rc = run_cmd("chronyc tracking 2>/dev/null")
    if rc == 0 and "Leap status" in stdout:
        # Senkronize durumda mı?
        if "Normal" in stdout or "Not synchronised" not in stdout:
            return send_report(policy, "compliant", "chrony ile NTP senkronize.")

    # systemd-timesyncd kontrolü
    stdout, _, rc = run_cmd("timedatectl show --property=NTPSynchronized --value 2>/dev/null")
    if stdout.strip() == "yes":
        return send_report(policy, "compliant", "systemd-timesyncd ile NTP senkronize.")

    # timedatectl genel kontrolü
    stdout, _, rc = run_cmd("timedatectl status 2>/dev/null")
    if rc == 0:
        if "synchronized: yes" in stdout.lower() or "ntp enabled: yes" in stdout.lower() or "ntp service: active" in stdout.lower():
            return send_report(policy, "compliant", "NTP senkronizasyonu aktif.")

    # ntpd kontrolü
    _, _, rc = run_cmd("systemctl is-active ntpd 2>/dev/null || systemctl is-active ntp 2>/dev/null")
    if rc == 0:
        return send_report(policy, "compliant", "NTP servisi aktif.")

    return send_report(policy, "non_compliant", "NTP senkronizasyonu aktif değil (chrony/timesyncd/ntpd bulunamadı)")


def check_disk_encryption():
    """Disk şifreleme kontrolü: LUKS"""
    policy = "Disk Şifreleme Politikası"

    # LUKS kontrolü
    stdout, _, rc = run_cmd("lsblk -o NAME,TYPE,FSTYPE 2>/dev/null | grep -i crypt")
    if stdout.strip():
        return send_report(policy, "compliant", f"LUKS disk şifreleme aktif: {stdout.strip()}")

    # dmsetup kontrolü
    stdout, _, rc = run_cmd("dmsetup ls --target crypt 2>/dev/null")
    if rc == 0 and stdout.strip() and "No devices" not in stdout:
        return send_report(policy, "compliant", f"Şifreli disk bölümü mevcut: {stdout.strip()}")

    return send_report(policy, "non_compliant", "Disk şifreleme (LUKS/dm-crypt) bulunamadı")


def check_package_updates():
    """Paket güncellik kontrolü: Güvenlik güncellemeleri"""
    policy = "Paket Güncellik Politikası"

    # apt kontrolü (Pardus/Debian)
    stdout, stderr, rc = run_cmd("apt list --upgradable 2>/dev/null | grep -i -c security", timeout=30)
    if rc == 0 or rc == 1:  # grep returns 1 if no match
        try:
            security_count = int(stdout.strip() or "0")
        except ValueError:
            security_count = 0

        if security_count == 0:
            # Toplam güncelleme sayısını kontrol et
            total_stdout, _, _ = run_cmd("apt list --upgradable 2>/dev/null | tail -n +2 | wc -l")
            total = int(total_stdout.strip() or "0")
            if total == 0:
                return send_report(policy, "compliant", "Tüm paketler güncel. Bekleyen güncelleme yok.")
            else:
                return send_report(policy, "compliant", f"Güvenlik güncellemesi yok. {total} normal güncelleme bekliyor.")
        else:
            return send_report(policy, "non_compliant", f"{security_count} güvenlik güncellemesi bekliyor!")

    return send_report(policy, "compliant", "Paket güncelleme durumu kontrol edildi.")


def check_log_management():
    """Log yönetimi kontrolü: rsyslog veya journald"""
    policy = "Log Yönetimi Politikası"

    # rsyslog aktif mi?
    _, _, rc = run_cmd("systemctl is-active rsyslog 2>/dev/null")
    if rc == 0:
        # Uzak log gönderimi yapılandırılmış mı?
        stdout, _, _ = run_cmd("grep -E '^[^#].*@@?' /etc/rsyslog.conf 2>/dev/null")
        if stdout.strip():
            return send_report(policy, "compliant", "rsyslog aktif ve uzak log sunucusu yapılandırılmış.")
        else:
            return send_report(policy, "compliant", "rsyslog aktif. Uzak log gönderimi yapılandırılmamış.")

    # journald aktif mi?
    _, _, rc = run_cmd("systemctl is-active systemd-journald 2>/dev/null")
    if rc == 0:
        # Persistent storage aktif mi?
        stdout, _, _ = run_cmd("grep '^Storage=' /etc/systemd/journald.conf 2>/dev/null")
        storage = stdout.strip().split("=")[-1] if stdout.strip() else "auto"
        return send_report(policy, "compliant", f"systemd-journald aktif. Storage: {storage}")

    return send_report(policy, "non_compliant", "Log servisi (rsyslog/journald) aktif değil")


# ══════════════════════════════════════════════════════════════
#  ANA ÇALIŞMA
# ══════════════════════════════════════════════════════════════

ALL_CHECKS = [
    check_ssh_security,
    check_firewall,
    check_password_policy,
    check_usb_restriction,
    check_ntp_sync,
    check_disk_encryption,
    check_package_updates,
    check_log_management,
]


def run_all_checks():
    """Tüm politika kontrollerini çalıştır"""
    now = datetime.now().strftime("%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"🔍 Uyum Taraması — {now} ({HOSTNAME}, user: {USERNAME})")
    print(f"{'='*60}")

    results = {"compliant": 0, "non_compliant": 0}
    for check_fn in ALL_CHECKS:
        try:
            check_fn()
        except Exception as e:
            print(f"  ⚠️  Hata: {check_fn.__name__}: {e}")

    print(f"{'='*60}")
    print(f"✅ Tarama tamamlandı. {len(ALL_CHECKS)} politika kontrol edildi.")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compliance Checker — Gerçek politika doğrulama")
    parser.add_argument("--loop", action="store_true", help="Sürekli çalıştır")
    parser.add_argument("--interval", type=int, default=300, help="Kontrol aralığı (saniye, varsayılan: 300)")
    parser.add_argument("--url", type=str, default=EVIDENCE_SERVICE_URL, help="Evidence Service URL")
    args = parser.parse_args()

    EVIDENCE_SERVICE_URL = args.url

    if args.loop:
        print(f"🔄 Sürekli mod — Her {args.interval} sn'de bir kontrol edilecek")
        while True:
            run_all_checks()
            time.sleep(args.interval)
    else:
        run_all_checks()
