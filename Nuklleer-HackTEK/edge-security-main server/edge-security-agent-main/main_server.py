import uvicorn
from fastapi import FastAPI, Request
import zlib
import json
import bulk_db 
from contextlib import asynccontextmanager
import aiosqlite 
from datetime import datetime
import time
@asynccontextmanager
async def lifespan(app: FastAPI):
    await bulk_db.init_db()
    yield

app = FastAPI(lifespan=lifespan)


def get_safe_time(val):
    """Her türlü zaman formatını (ISO, Unix, Metin) HH:MM:SS formatına çevirir."""
    try:
        s = str(val)
        if 'T' in s: return s.split('T')[1][:8]  
        if ' ' in s: return s.split(' ')[1][:8] 
        return datetime.fromtimestamp(float(val)).strftime("%H:%M:%S")
    except:
        return datetime.now().strftime("%H:%M:%S")

STATS = {
    "alinan_kritik_olay": 0,
    "islenen_rutin_paket": 0,
    "toplam_rutin_kayit": 0,
    "orijinal_boyut_byte": 0,
    "sikistirilmis_boyut_byte": 0,
    "son_bulk_yazma_suresi_ms": 0.0,
    "son_cpu_kullanimi": 0.0,  
    "son_ram_kullanimi": 0.0,  
    "son_kritik_mesaj": "-",   
    "aktif_ajanlar": {},  
    "ajan_zaman_damgasi": {},
    "ajan_son_gorulme_ts": {}  
}

@app.post("/api/telemetry/status")
async def handle_status(data: dict):
    device = data.get("device_id", "Bilinmeyen_Cihaz")
    durum = data.get("status", "offline")
    ts_suan = datetime.now().timestamp() 
    ts_eski = STATS["ajan_son_gorulme_ts"].get(device, 0) 

    if (ts_suan - ts_eski) > 60:
        STATS["ajan_zaman_damgasi"][device] = datetime.now().strftime("%H:%M:%S")
    
    STATS["aktif_ajanlar"][device] = "online"
    STATS["ajan_son_gorulme_ts"][device] = ts_suan
    if STATS["aktif_ajanlar"].get(device) != durum:
        gercek_saat = get_safe_time(data.get("timestamp"))
        STATS["aktif_ajanlar"][device] = durum
        STATS["ajan_zaman_damgasi"][device] = gercek_saat
    # -----------------------------
    print(f" [DURUM BİLDİRİMİ] {device} cihazı şu an {durum.upper()}")
    print(f" [DURUM BİLDİRİMİ] {device} cihazı şu an {durum.upper()}")
    return {"status": "success", "device": device, "state": durum}

@app.post("/api/telemetry/critical")
async def handle_critical(data: dict):
    STATS["alinan_kritik_olay"] += 1
    device = data.get("device_id", "Bilinmeyen_Cihaz")
    ts_suan = datetime.now().timestamp() 
    ts_eski = STATS["ajan_son_gorulme_ts"].get(device, 0) 
    if (ts_suan - ts_eski) > 60:
        STATS["ajan_zaman_damgasi"][device] = datetime.now().strftime("%H:%M:%S")
    
    STATS["aktif_ajanlar"][device] = "online"
    STATS["ajan_son_gorulme_ts"][device] = ts_suan

    if STATS["aktif_ajanlar"].get(device) != "online":

        gercek_saat = get_safe_time(data.get("timestamp"))
        STATS["aktif_ajanlar"][device] = "online"
        STATS["ajan_zaman_damgasi"][device] = gercek_saat

    if "cpu" in data: STATS["son_cpu_kullanimi"] = round(data["cpu"], 1)
    if "ram" in data: STATS["son_ram_kullanimi"] = round(data["ram"], 1)

    try:
        write_time = await bulk_db.bulk_insert_async([data])
        STATS["son_bulk_yazma_suresi_ms"] = write_time
    except Exception as e:
        print(f"DB Yazma Hatası: {e}")

    olay_tipi = data.get("type", "")
    
    if olay_tipi == "yeni_port_acildi": mesaj = f"YENİ PORT AÇILDI ({data.get('detected_port')})"
    elif olay_tipi == "yetkisiz_usb": mesaj = "YETKİSİZ USB TAKILDI"
    elif olay_tipi == "hatali_sifre": mesaj = "HATALI ŞİFRE DENEMESİ"
    elif olay_tipi == "yuksek_cpu": mesaj = f"AŞIRI CPU YÜKÜ (%{data.get('cpu')})"
    elif olay_tipi == "yuksek_ram": mesaj = f"AŞIRI RAM KULLANIMI (%{data.get('ram')})"
    else: mesaj = f"BİLİNMEYEN OLAY ({olay_tipi})"

    final_log = f"[{device}] -> {mesaj}"
    STATS["son_kritik_mesaj"] = final_log

    print(f" [KRİTİK] {final_log}")
    return {"status": "success", "alert": mesaj}

@app.post("/api/telemetry/routine")
async def handle_routine(request: Request):
    compressed_data = await request.body()
    compressed_size = len(compressed_data)
    try:
        decompressed_data = zlib.decompress(compressed_data)
        payload = json.loads(decompressed_data.decode('utf-8'))

        if len(payload) > 0:
            device = payload[0].get("device_id", "Bilinmeyen_Cihaz")
            
            ts_suan = time.time()
            ts_eski = STATS["ajan_son_gorulme_ts"].get(device, 0)
            if (ts_suan - ts_eski) > 60:
                STATS["ajan_zaman_damgasi"][device] = datetime.now().strftime("%H:%M:%S")
            
            STATS["aktif_ajanlar"][device] = "online"
            STATS["ajan_son_gorulme_ts"][device] = ts_suan
         
            original_size = len(decompressed_data)
            STATS["orijinal_boyut_byte"] += original_size
            STATS["sikistirilmis_boyut_byte"] += compressed_size
            STATS["islenen_rutin_paket"] += 1
            STATS["toplam_rutin_kayit"] += len(payload)
            
            write_time = await bulk_db.bulk_insert_async(payload)
            STATS["son_bulk_yazma_suresi_ms"] = write_time
            
            print(f" TOPLU PAKET: {len(payload)} kayıt | DB Yazma: {write_time:.2f}ms")
            return {"status": "success", "saved_bytes": original_size - compressed_size}
            
    except Exception as e:
        print(f" Hata: {str(e)}")
        return {"status": "error"}

@app.get("/stats")
async def get_stats():
    suan_ts = datetime.now().timestamp()
    
    for device in list(STATS["aktif_ajanlar"].keys()):
        son_ts = STATS["ajan_son_gorulme_ts"].get(device, 0)
        
        if (suan_ts - son_ts) > 60:
            if STATS["aktif_ajanlar"][device] == "online":
                STATS["aktif_ajanlar"][device] = "offline"
                STATS["ajan_zaman_damgasi"][device] = datetime.fromtimestamp(son_ts).strftime("%H:%M:%S")
                print(f" [TIMEOUT] {device} ajanı 1 dakikadır veri göndermedi, OFFLINE yapıldı.")
                
    return STATS

@app.get("/api/agent/{device_id}")
async def get_agent_data(device_id: str):
    """Belirli bir ajanın güncel CPU/RAM bilgisini ve geçmiş KRİTİK olaylarını saatleriyle getirir."""
    try:
        async with aiosqlite.connect("lider_telemetry.db") as db:
            db.row_factory = aiosqlite.Row
            
            cursor_genel = await db.execute(
                "SELECT cpu, ram FROM telemetry WHERE device_id = ? ORDER BY id DESC LIMIT 1", 
                (device_id,)
            )
            row_genel = await cursor_genel.fetchone()
            
            cursor_kritik = await db.execute(
                "SELECT olay_tipi, zaman FROM telemetry WHERE device_id = ? AND olay_tipi != 'rutin' ORDER BY id DESC LIMIT 10", 
                (device_id,)
            )
            rows_kritik = await cursor_kritik.fetchall()
            
            ori = STATS["orijinal_boyut_byte"]
            sik = STATS["sikistirilmis_boyut_byte"]

            if row_genel:
                cpu = row_genel["cpu"]
                ram = row_genel["ram"]
                
                olaylar = []
                for r in rows_kritik:
                    olaylar.append({"tip": r["olay_tipi"], "zaman": r["zaman"]})
                
                return {
                    "status": "success", 
                    "cpu": cpu, 
                    "ram": ram, 
                    "olaylar": olaylar,
                    "ori_byte": ori,
                    "sik_byte": sik
                }
            else:
                return {
                    "status": "not_found", 
                    "cpu": 0, 
                    "ram": 0, 
                    "olaylar": [],
                    "ori_byte": ori,
                    "sik_byte": sik
                }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    print(" Nükleer HackTEK Sunucusu Başlatılıyor... (10.46.138.49:8000)")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info", access_log=False)
