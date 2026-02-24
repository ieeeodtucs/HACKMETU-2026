import asyncio
import httpx
import psutil
import json
import zlib
import re
import os
import socket
import sqlite3
import yaml
import logging
from datetime import datetime
from contextlib import suppress

# --- LOGLAMA YAPILANDIRMASI (Linux Standartları) ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("HackTEK-Agent")

class AsyncEdgeAgent:
    def __init__(self, config_path="agent_config.yaml"):
        # 1. KONFİGÜRASYON YÜKLEME
        self.config = self._load_config(config_path)
        self.device_id = socket.gethostname()
        
        # 2. AYARLARI ATAMA
        self.SERVER_URL = self.config.get("server_url", "http://10.145.251.49:8000/api/telemetry")
        self.KONTROL_PERIYODU = self.config.get("kontrol_periyodu", 0.5)
        self.BATCH_LIMIT = self.config.get("batch_limit", 10)
        self.KRITIK_CPU = self.config.get("thresholds", {}).get("cpu", 85.0)
        self.KRITIK_RAM = self.config.get("thresholds", {}).get("ram", 80.0)
        self.MESAI_BASLAMA = self.config.get("working_hours", {}).get("start", 8)
        self.MESAI_BITIS = self.config.get("working_hours", {}).get("end", 18)
        self.RISK_A = self.config.get("risk_limits", {}).get("A", 90)
        self.RISK_B = self.config.get("risk_limits", {}).get("B", 70)
        self.YETKILI_USB = self.config.get("whitelist", {}).get("usb", ["058f:6387"])
        self.YETKILI_PORT = set(self.config.get("whitelist", {}).get("ports", [22, 80, 443, 631]))

        # 3. SİSTEM DEĞİŞKENLERİ
        self.rutin_tampon = []
        self.journal_cursor = None
        self.eski_portlar_seti = set()
        self._son_disk_yazilan = psutil.disk_io_counters().write_bytes
        self._son_zaman = datetime.now().timestamp()
        
        # 4. HTTP VE DB BAĞLANTILARI
        self.client = httpx.AsyncClient(timeout=10, limits=httpx.Limits(max_keepalive_connections=5))
        self._init_db()

    def _load_config(self, path):
        """YAML dosyasından ayarları okur, yoksa varsayılanları döner."""
        if os.path.exists(path):
            with open(path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def _init_db(self):
        """Linux FHS standartlarına uygun yerel depolama."""
        # Veritabanını kullanıcı dizininde gizli bir klasöre taşır
        db_dir = os.path.expanduser("~/.local/share/hacktek")
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, f"agent_{self.device_id}.db")
        
        try:
            self.db_conn = sqlite3.connect(db_path, check_same_thread=False)
            self.db_conn.execute("PRAGMA journal_mode=WAL") # Eşzamanlı okuma/yazma desteği
            self.db_cursor = self.db_conn.cursor()
            self.db_cursor.execute("CREATE TABLE IF NOT EXISTS rutin_kuyruk (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT)")
            self.db_cursor.execute("CREATE TABLE IF NOT EXISTS kritik_kuyruk (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT)")
            self.db_conn.commit()
            logger.info(f"Yerel veritabanı hazır: {db_path}")
        except sqlite3.OperationalError as e:
            logger.error(f"DB İzin Hatası: {e}. Lütfen yazma yetkilerini kontrol edin.")
            raise

    # --- METRİK TOPLAMA VE ANALİZ ---

    def disk_hizi_hesapla(self):
        with suppress(Exception):
            guncel_yazilan = psutil.disk_io_counters().write_bytes
            guncel_zaman = datetime.now().timestamp()
            fark_byte = guncel_yazilan - self._son_disk_yazilan
            fark_zaman = guncel_zaman - self._son_zaman
            self._son_disk_yazilan, self._son_zaman = guncel_yazilan, guncel_zaman
            return round((fark_byte / fark_zaman) / (1024 * 1024), 2) if fark_zaman > 0 else 0.0
        return 0.0

    def mesai_disi_mi(self):
        now = datetime.now()
        if now.weekday() >= 5: return True
        return now.hour < self.MESAI_BASLAMA or now.hour >= self.MESAI_BITIS

    def tehdit_skoru_analizi(self, p_fail, u_fail, a_fail, cpu, ram, m_fail):
        skor = 0
        if p_fail: skor += 50
        if u_fail: skor += 40
        if a_fail: skor += 30
        if m_fail: skor += 25
        if cpu > 90: skor += 20
        if ram > 90: skor += 20
        return min(100, skor)

    async def port_tara(self):
        with suppress(Exception):
            current = {c.laddr.port for c in psutil.net_connections(kind='inet') if c.status == 'LISTEN'}
            if not hasattr(self, '_init_p'):
                self.eski_portlar_seti, self._init_p = current, True
                return False, None
            new_ports = current - self.eski_portlar_seti
            self.eski_portlar_seti = current
            for p in new_ports:
                if p not in self.YETKILI_PORT: return True, p
        return False, None

    async def log_dinle(self):
        auth, usb = False, False
        cmd = ["journalctl", "-q", "--show-cursor", "-n", "0" if not self.journal_cursor else "10"]
        if self.journal_cursor: cmd.extend(["--after-cursor", self.journal_cursor])
        
        with suppress(Exception):
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
            stdout, _ = await proc.communicate()
            if stdout:
                for line in stdout.decode('utf-8', errors='ignore').split('\n'):
                    if "cursor:" in line: self.journal_cursor = line.split("cursor:")[1].strip()
                    lower = line.lower()
                    if any(x in lower for x in ["failure", "incorrect password"]): auth = True
                    if "new usb device found" in lower:
                        m = re.search(r'idvendor=([0-9a-f]+).*?idproduct=([0-9a-f]+)', lower)
                        if m and f"{m.group(1)}:{m.group(2)}" not in self.YETKILI_USB: usb = True
        return auth, usb

    # --- İLETİŞİM VE OTOMASYON ---

    async def post_to_server(self, endpoint, data, binary=False):
        try:
            url = f"{self.SERVER_URL}/{endpoint}"
            if binary: res = await self.client.post(url, content=data)
            else: res = await self.client.post(url, json=data)
            return res.status_code == 200
        except Exception: return False

    async def kritik_olay_isleme(self, veri):
        logger.warning(f"Kritik Olay Tespit Edildi: {veri.get('type')}")
        if not await self.post_to_server("critical", veri):
            self.db_cursor.execute("INSERT INTO kritik_kuyruk (payload) VALUES (?)", (json.dumps(veri),))
            self.db_conn.commit()

    async def kuyruk_eritici(self):
        """Arka planda SQLite verilerini sunucuya taşır (Backpressure Management)."""
        while True:
            # 1. Kritikleri erit
            self.db_cursor.execute("SELECT id, payload FROM kritik_kuyruk LIMIT 5")
            for r_id, pay in self.db_cursor.fetchall():
                if await self.post_to_server("critical", json.loads(pay)):
                    self.db_cursor.execute("DELETE FROM kritik_kuyruk WHERE id = ?", (r_id,))
                    self.db_conn.commit()

            # 2. Rutinleri paketleyerek erit
            self.db_cursor.execute("SELECT id, payload FROM rutin_kuyruk LIMIT 50")
            rows = self.db_cursor.fetchall()
            if rows:
                ids = [r[0] for r in rows]
                pkt = [json.loads(r[1]) for r in rows]
                compressed = zlib.compress(json.dumps(pkt).encode())
                if await self.post_to_server("routine", compressed, binary=True):
                    self.db_cursor.execute(f"DELETE FROM rutin_kuyruk WHERE id IN ({','.join(['?']*len(ids))})", ids)
                    self.db_conn.commit()
                    logger.info(f"Offline Sync Tamamlandı: {len(pkt)} kayıt gönderildi.")
            
            await asyncio.sleep(5 if not rows else 1)

    async def calistir(self):
        logger.info(f"Nükleer HackTEK Agent Başlatıldı: {self.device_id}")
        await self.post_to_server("status", {"device_id": self.device_id, "status": "online"})
        
        asyncio.create_task(self.kuyruk_eritici())
        
        try:
            while True:
                is_auth, is_usb = await self.log_dinle()
                is_port, port_no = await self.port_tara()
                is_m = self.mesai_disi_mi()
                cpu, ram = psutil.cpu_percent(), psutil.virtual_memory().percent
                
                skor = self.tehdit_skoru_analizi(is_port, is_usb, is_auth, cpu, ram, is_m)
                
                # Temel veri paketi
                veri = {
                    "device_id": self.device_id, "timestamp": datetime.now().isoformat(),
                    "cpu": cpu, "ram": ram, "disk_write_mb_s": self.disk_hizi_hesapla(),
                    "auth_failure": is_auth, "unauthorized_usb": is_usb, "threat_score": skor, "type": "rutin"
                }

                # --- SOAR TEPKİ MEKANİZMASI ---
                if skor >= self.RISK_A:
                    veri["type"] = "ajan_kendini_kapatti"
                    await self.kritik_olay_isleme(veri)
                    logger.critical(f"FATAL RİSK (%{skor}): Ajan kendini kapatıyor!")
                    break 
                elif skor >= self.RISK_B:
                    veri["type"] = "buyuk_tehdit_uyarisi"
                    await self.kritik_olay_isleme(veri)

                # Münferit ihlaller
                if any([is_port, is_usb, is_auth, cpu > self.KRITIK_CPU]):
                    if is_port: veri.update({"type": "yeni_port_acildi", "detected_port": port_no})
                    elif is_usb: veri["type"] = "yetkisiz_usb"
                    elif is_auth: veri["type"] = "hatali_sifre"
                    elif cpu > self.KRITIK_CPU: veri["type"] = "yuksek_cpu"
                    asyncio.create_task(self.kritik_olay_isleme(veri))
                else:
                    self.rutin_tampon.append(veri)

                if len(self.rutin_tampon) >= self.BATCH_LIMIT:
                    self.db_cursor.executemany("INSERT INTO rutin_kuyruk (payload) VALUES (?)", [(json.dumps(x),) for x in self.rutin_tampon])
                    self.db_conn.commit()
                    self.rutin_tampon.clear()

                await asyncio.sleep(self.KONTROL_PERIYODU)
        finally:
            with suppress(Exception):
                await self.post_to_server("status", {"device_id": self.device_id, "status": "offline"})
                await self.client.aclose()
                self.db_conn.close()

if __name__ == "__main__":
    agent = AsyncEdgeAgent()
    with suppress(KeyboardInterrupt):
        asyncio.run(agent.calistir())
