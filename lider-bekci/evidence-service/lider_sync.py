"""
Lider MySQL Sync — Pulls real user/agent/policy data from the Lider MySQL database
and populates the compliance SQLite database.
"""
import pymysql
from datetime import datetime
from models import Client, PolicyDefinition, EvidenceLog
from database import SessionLocal, init_db

# Lider MySQL connection
LIDER_DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "compliance",
    "password": "compliance123",
    "database": "lidermysdb",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}


def sync_agents_from_lider():
    """
    Read real users (from session table) + agents from Lider MySQL
    and upsert them into the compliance SQLite database.
    
    Pulls data from:
    - c_agent: hostname, IP, status
    - c_agent_user_session: username, last session
    - c_policy: real policy definitions
    """
    init_db()
    db = SessionLocal()

    try:
        conn = pymysql.connect(**LIDER_DB_CONFIG)
        cursor = conn.cursor()

        # ── Pull users with their agent (client machine) info ──
        cursor.execute("""
            SELECT 
                s.username,
                a.HOSTNAME,
                a.IP_ADDRESSES,
                a.AGENT_STATUS,
                MAX(s.create_date) as last_session,
                MAX(CASE WHEN s.session_event = 1 THEN 1 ELSE 0 END) as is_logged_in
            FROM c_agent_user_session s
            JOIN c_agent a ON s.agent_id = a.AGENT_ID
            WHERE (a.IS_DELETED IS NULL OR a.IS_DELETED = 0)
            GROUP BY s.username, a.HOSTNAME, a.IP_ADDRESSES, a.AGENT_STATUS
            ORDER BY last_session DESC
        """)
        users = cursor.fetchall()

        # ── Pull real policies ──
        cursor.execute("""
            SELECT policy_id, label, description, active, create_date
            FROM c_policy
            WHERE deleted IS NULL OR deleted = 0
            ORDER BY policy_id
        """)
        policies = cursor.fetchall()

        conn.close()

        if not users:
            print("⚠️  Lider MySQL'de kullanıcı/session bulunamadı.")
            db.close()
            return 0

        # Clear existing clients and re-populate from Lider
        db.query(Client).delete()
        db.commit()

        count = 0
        for idx, user in enumerate(users, 1):
            ip_raw = user.get("IP_ADDRESSES", "")
            ip = ip_raw.strip("'\"[] ") if ip_raw else "N/A"

            username = user.get("username", "unknown")
            hostname = user.get("HOSTNAME", "unknown")
            last_session = user.get("last_session")

            # Determine online status: logged in within the last 10 minutes
            is_online = False
            if last_session:
                diff = (datetime.now() - last_session).total_seconds()
                is_online = diff < 600  # 10 minutes

            client = Client(
                id=idx,
                hostname=f"{username}@{hostname}",
                ip=ip,
                os=f"Pardus ({hostname})",
                plugin_status="installed",
                last_check=last_session,
                compliance_status="pending",
                compliance_score=0,
                online=is_online,
                violations=None,
            )
            db.add(client)
            count += 1

        # ── Sync real policies ──
        db.query(PolicyDefinition).delete()
        db.commit()

        for pol in policies:
            policy = PolicyDefinition(
                id=pol["policy_id"],
                policy_name=pol.get("label", "Bilinmeyen Politika"),
                description=pol.get("description", "") or "",
                total_checked=count,  # all users
                compliant=0,
                non_compliant=0,
                compliance_rate=0,
                severity="medium",
                category="security",
                active=bool(pol.get("active")),
            )
            db.add(policy)

        db.commit()
        print(f"✅ Lider MySQL'den {count} kullanıcı ve {len(policies)} politika senkronize edildi.")
        db.close()
        return count

    except pymysql.err.OperationalError as e:
        print(f"⚠️  Lider MySQL'e bağlanılamadı: {e}")
        print("    Seed verileri kullanılacak.")
        db.close()
        return -1
    except Exception as e:
        print(f"❌ Beklenmeyen hata: {e}")
        import traceback
        traceback.print_exc()
        db.close()
        return -1


def ensure_policies_exist():
    """Ensure default policy definitions exist if Lider sync didn't provide any"""
    db = SessionLocal()
    if db.query(PolicyDefinition).count() == 0:
        policies = [
            PolicyDefinition(id=1, policy_name="SSH Güvenlik Politikası",
                             description="Root SSH girişi kapatılmalı, anahtar tabanlı kimlik doğrulama zorunlu",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="critical", category="security"),
            PolicyDefinition(id=2, policy_name="Firewall Politikası",
                             description="UFW/iptables aktif olmalı, sadece izin verilen portlar açık",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="critical", category="security"),
            PolicyDefinition(id=3, policy_name="Parola Politikası",
                             description="Minimum 12 karakter, büyük-küçük harf, rakam ve özel karakter zorunlu",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="high", category="authentication"),
            PolicyDefinition(id=4, policy_name="USB Kısıtlama Politikası",
                             description="Yetkisiz USB cihazları engellenmeli",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="medium", category="device"),
            PolicyDefinition(id=5, policy_name="NTP Senkronizasyonu",
                             description="Sistem saati NTP sunucusu ile senkronize olmalı",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="low", category="configuration"),
            PolicyDefinition(id=6, policy_name="Paket Güncellik Politikası",
                             description="Güvenlik güncellemeleri 7 gün içinde uygulanmalı",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="high", category="update"),
            PolicyDefinition(id=7, policy_name="Disk Şifreleme Politikası",
                             description="LUKS disk şifreleme aktif olmalı",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="critical", category="security"),
            PolicyDefinition(id=8, policy_name="Log Yönetimi Politikası",
                             description="rsyslog aktif olmalı, loglar merkezi sunucuya iletilmeli",
                             total_checked=0, compliant=0, non_compliant=0,
                             compliance_rate=0, severity="medium", category="monitoring"),
        ]
        db.add_all(policies)
        db.commit()
        print("✅ Varsayılan politika tanımları oluşturuldu.")
    db.close()


if __name__ == "__main__":
    result = sync_agents_from_lider()
    if result <= 0:
        ensure_policies_exist()
        print("Seed veriler kullanılıyor...")
        from seed_data import seed
        seed()
