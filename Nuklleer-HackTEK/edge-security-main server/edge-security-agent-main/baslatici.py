import subprocess
import sys
import time
import atexit
import os

def main():
    print(" Nükleer HackTEK Başlatıcı Devrede...")
    
    # Başlatıcının bulunduğu gerçek klasör yolunu otomatik bul
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    print(f"[*] Çalışma Dizini Doğrulandı: {BASE_DIR}")
    
    # 1. Sunucuyu (API) arka planda başlat
    print("[*] Veritabanı ve arka plan sunucusu ayaklandırılıyor...")
    # cwd=BASE_DIR parametresi, sunucunun doğru klasörde çalışmasını ve DB'yi oraya kurmasını sağlar
    server_process = subprocess.Popen([sys.executable, "main_server.py"], cwd=BASE_DIR)

    # Sunucunun portu açıp hazır hale gelmesi için 2 saniye bekle
    time.sleep(2)

    # 2. Kullanıcı arayüzünü (GUI) başlat
    print("[*] Merkezi Yönetim Paneli açılıyor...")
    gui_process = subprocess.Popen([sys.executable, "gui_server.py"], cwd=BASE_DIR)

    # 3. Kapatma Güvenliği
    def temizle():
        print(" Sistem kapatılıyor, arka plan servisleri durduruluyor...")
        server_process.terminate()

    # Python kapanırken temizle fonksiyonunu çalıştır
    atexit.register(temizle)

    # Arayüz kapanana kadar başlatıcıyı açık tut
    gui_process.wait()

if __name__ == "__main__":
    main()
