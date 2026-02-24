import aiosqlite
import asyncio
import time

DB_NAME = "lider_telemetry.db"

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT,
                cpu REAL,
                ram REAL,
                olay_tipi TEXT,
                zaman REAL
            )
        ''')
        await db.commit()

async def bulk_insert_async(data_list):
    start_time = time.perf_counter()
    async with aiosqlite.connect(DB_NAME) as db:
        veri_tuples = [
            (
                d.get('device_id', 'Bilinmeyen'), 
                d.get('cpu', 0), 
                d.get('ram', 0), 
                d.get('type', 'rutin'), 
                d.get('timestamp', 0)
            ) 
            for d in data_list
        ]
        
        await db.executemany(
            'INSERT INTO telemetry (device_id, cpu, ram, olay_tipi, zaman) VALUES (?, ?, ?, ?, ?)', 
            veri_tuples
        )
        await db.commit()
    
    return (time.perf_counter() - start_time) * 1000
