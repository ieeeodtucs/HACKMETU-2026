#!/usr/bin/env python3
"""
Session Watcher — Lider kullanıcı oturumlarını izler ve
aktif oturumlara healthcheck verisi gönderir.

- MySQL'den c_agent_user_session tablosunu takip eder
- Aktif oturumları tespit eder (session_event=1 = login, 2 = logout)
- Her aktif kullanıcı için compliance kontrollerini çalıştırır
- Sonuçları Evidence Service'e bildirir

Kullanım:
    python3 session_watcher.py                       # tek sefer kontrol
    python3 session_watcher.py --watch               # sürekli izle (30 sn)
    python3 session_watcher.py --watch --interval 10 # 10 sn arayla
    python3 session_watcher.py --user ali             # sadece ali'yi izle
"""

import pymysql
import requests
import time
import argparse
import subprocess
import os
from datetime import datetime

# ── Ayarlar ──────────────────────────────────────────────────
EVIDENCE_SERVICE_URL = "http://127.0.0.1:5000"
REPORT_URL = f"{EVIDENCE_SERVICE_URL}/api/compliance/report"

LIDER_DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "compliance",
    "password": "compliance123",
    "database": "lidermysdb",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}


# ── Healthcheck Kontrolleri ──────────────────────────────────

def run_cmd(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.returncode
    except:
        return "", -1


def get_system_health(hostname, ip):
    """Bir istemci için sistem sağlık kontrollerini çalıştır"""
    checks = []

    # 1. Ping kontrolü — istemci erişilebilir mi?
    _, rc = run_cmd(f"ping -c 1 -W 2 {ip} 2>/dev/null")
    checks.append({
        "name": "Ağ Erişimi",
        "status": "up" if rc == 0 else "down",
        "detail": f"{ip} {'erişilebilir' if rc == 0 else 'erişilemiyor'}"
    })

    # 2. SSH port kontrolü
    _, rc = run_cmd(f"timeout 2 bash -c '</dev/tcp/{ip}/22' 2>/dev/null")
    checks.append({
        "name": "SSH Servisi",
        "status": "up" if rc == 0 else "down",
        "detail": f"Port 22 {'açık' if rc == 0 else 'kapalı'}"
    })

    # 3. XMPP bağlantı kontrolü (Ahenk aktif mi?)
    _, rc = run_cmd(f"timeout 2 bash -c '</dev/tcp/{ip}/5222' 2>/dev/null")
    checks.append({
        "name": "Ahenk Servisi",
        "status": "up" if rc == 0 else "down",
        "detail": f"XMPP (5222) {'yanıt veriyor' if rc == 0 else 'yanıt vermiyor'}"
    })

    # 4. Disk kullanımı (lokal makine için)
    if hostname == os.uname().nodename or ip == "127.0.0.1":
        out, _ = run_cmd("df -h / | tail -1 | awk '{print $5}'")
        usage = out.replace("%", "")
        try:
            usage_int = int(usage)
            checks.append({
                "name": "Disk Kullanımı",
                "status": "warning" if usage_int > 80 else "up",
                "detail": f"Root disk: %{usage_int} kullanımda"
            })
        except:
            pass

        # 5. RAM kullanımı
        out, _ = run_cmd("free -m | awk 'NR==2{printf \"%d/%dMB (%.0f%%)\", $3, $2, $3*100/$2}'")
        checks.append({
            "name": "Bellek Kullanımı",
            "status": "up",
            "detail": f"RAM: {out}"
        })

        # 6. CPU yükü
        out, _ = run_cmd("uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ','")
        try:
            load = float(out)
            cpu_count_str, _ = run_cmd("nproc")
            cpu_count = int(cpu_count_str) if cpu_count_str else 1
            checks.append({
                "name": "CPU Yükü",
                "status": "warning" if load > cpu_count else "up",
                "detail": f"Load: {load:.1f} ({cpu_count} çekirdek)"
            })
        except:
            pass

        # 7. Aktif servisler
        out, _ = run_cmd("systemctl list-units --type=service --state=failed --no-pager --no-legend 2>/dev/null | wc -l")
        failed = int(out.strip() or "0")
        checks.append({
            "name": "Servis Durumu",
            "status": "down" if failed > 0 else "up",
            "detail": f"{failed} başarısız servis" if failed > 0 else "Tüm servisler çalışıyor"
        })

        # 8. Son login
        out, _ = run_cmd("last -1 -R | head -1")
        checks.append({
            "name": "Son Oturum",
            "status": "up",
            "detail": out[:80] if out else "Bilgi alınamadı"
        })

    return checks


# ── MySQL Oturum Sorgulama ───────────────────────────────────

def get_active_sessions(username_filter=None):
    """MySQL'den aktif kullanıcı oturumlarını getir"""
    try:
        conn = pymysql.connect(**LIDER_DB_CONFIG)
        cursor = conn.cursor()

        # Her kullanıcı+agent çifti için son oturum olayını bul
        query = """
            SELECT s1.username, s1.session_event, s1.create_date,
                   a.HOSTNAME, a.IP_ADDRESSES, a.AGENT_ID
            FROM c_agent_user_session s1
            JOIN c_agent a ON s1.agent_id = a.AGENT_ID
            WHERE s1.create_date = (
                SELECT MAX(s2.create_date)
                FROM c_agent_user_session s2
                WHERE s2.username = s1.username AND s2.agent_id = s1.agent_id
            )
            AND (a.IS_DELETED IS NULL OR a.IS_DELETED = 0)
        """
        if username_filter:
            query += f" AND s1.username = '{username_filter}'"

        query += " ORDER BY s1.create_date DESC"
        cursor.execute(query)
        sessions = cursor.fetchall()
        conn.close()

        # Sadece aktif oturumları filtrele (session_event=1 = login)
        active = []
        for s in sessions:
            ip = s["IP_ADDRESSES"].strip("'\"[] ") if s["IP_ADDRESSES"] else "N/A"
            active.append({
                "username": s["username"],
                "hostname": s["HOSTNAME"],
                "ip": ip,
                "is_online": s["session_event"] == 1,
                "last_event": "login" if s["session_event"] == 1 else "logout",
                "event_time": s["create_date"],
            })
        return active

    except Exception as e:
        print(f"  ⚠️  MySQL bağlantı hatası: {e}")
        return []


# ── Healthcheck Rapor Gönderme ───────────────────────────────

def send_healthcheck(username, hostname, ip, checks):
    """Healthcheck sonuçlarını Evidence Service'e gönder"""
    client_id = f"{username}@{hostname}"

    # Her check için ayrı rapor gönder
    all_ok = True
    for check in checks:
        is_ok = check["status"] in ("up",)
        if not is_ok:
            all_ok = False

        payload = {
            "hostname": client_id,
            "policy": f"Sistem Sağlığı: {check['name']}",
            "result": "compliant" if is_ok else "non_compliant",
            "detail": check["detail"],
        }
        try:
            requests.post(REPORT_URL, json=payload, timeout=5)
        except Exception as e:
            print(f"    ⚠️  Rapor gönderilemedi: {e}")

    return all_ok


# ── Ana Döngü ────────────────────────────────────────────────

def run_check(username_filter=None):
    """Tek sefer kontrol çalıştır"""
    now = datetime.now().strftime("%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"👁️  Oturum İzleme — {now}")
    print(f"{'='*60}")

    sessions = get_active_sessions(username_filter)

    if not sessions:
        print("  ℹ️  Aktif oturum bulunamadı.")
        return

    for session in sessions:
        user = session["username"]
        host = session["hostname"]
        ip = session["ip"]
        status_icon = "🟢" if session["is_online"] else "🔴"
        event = "GİRİŞ" if session["is_online"] else "ÇIKIŞ"

        print(f"\n  {status_icon} {user}@{host} ({ip}) — {event} [{session['event_time']}]")

        if session["is_online"]:
            print(f"    📋 Sağlık kontrolü yapılıyor...")
            checks = get_system_health(host, ip)

            for check in checks:
                icon = "✅" if check["status"] == "up" else ("⚠️" if check["status"] == "warning" else "❌")
                print(f"    {icon} {check['name']}: {check['detail']}")

            send_healthcheck(user, host, ip, checks)
            print(f"    📤 Sonuçlar Evidence Service'e gönderildi.")
        else:
            print(f"    ⏸️  Kullanıcı çevrimdışı, kontrol atlandı.")

    print(f"\n{'='*60}")
    print(f"✅ İzleme tamamlandı. {len(sessions)} oturum kontrol edildi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Session Watcher — Oturum bazlı healthcheck")
    parser.add_argument("--watch", action="store_true", help="Sürekli izle")
    parser.add_argument("--interval", type=int, default=30, help="Kontrol aralığı (saniye)")
    parser.add_argument("--user", type=str, default=None, help="Sadece belirli kullanıcıyı izle")
    args = parser.parse_args()

    if args.watch:
        print(f"👁️  Sürekli izleme modu — Her {args.interval} sn'de bir kontrol")
        if args.user:
            print(f"   Filtre: sadece '{args.user}' kullanıcısı")
        while True:
            run_check(args.user)
            time.sleep(args.interval)
    else:
        run_check(args.user)
