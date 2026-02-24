# Pardus USB & Anomaly Detector

Pardus USB & Anomaly Detector, sisteme bağlanan blok cihazlarını (diskler, USB bellekler vb.) analiz ederek yapay zeka (İzolasyon Ormanı - Isolation Forest) destekli anomali tespiti yapan ve sonuçları şifreli bir API üzerinden sunan güvenlik tabanlı bir sistemdir. Bu proje, özel USB kontrol eklentisi (plugin) olarak çalışacak şekilde tasarlanmıştır.

## Özellikler

*   **Veri Toplama:** Pardus/Linux sistemlerindeki tüm blok cihazlarını `lsblk` komutunu kullanarak bulur ve analiz eder (SATA, USB, Loop, ROM).
*   **USB Saptama:** Cihazların bağlantı türü (tran="usb"), çıkarılabilir olup olmaması (rm=1) ve bağlama noktası yapılarını analiz ederek USB bağlantılarını diğer disklerden ayırt eder.
*   **Yapay Zeka Destekli Anomali Tespiti:**
    *   **Isolation Forest** makine öğrenmesi modeli kullanılır.
    *   Cihazların boyutu, okunabilirlik durumu, taşınabilirliği ve USB formatında olup olmaması gibi 4 temel özellik (Feature Extraction) modele parametre olarak verilir.
    *   Model, cihazları analiz ederek çoğunluktan farklı olan, sistemde "anormal" duran aygıtları tespit edip eksi (-1) puan ile işaretler.
    *   **Güvenlik Filtresi:** Sistem, yapay zekanın yanılma payını sıfıra indirmek için *yalnızca USB* özelliğine sahip olan aygıtların "Anormal (Anomalous)" olarak işaretlenmesine izin verir. İşletim sisteminin sanal CD-ROM'u veya sabit diskleri, model yüksek anomali puanı verse bile her zaman "Güvenli (Safe)" kabul edilir.
*   **Şifreli Backend:** FastAPI üzerinden sunulan sistem verileri JSON formatından **Fernet (AES) simetrik şifreleme** algoritmasına sokularak `/scan` endpoint'inde şifreli bir şekilde dış dünyaya sunulur.
*   **İstemci Uygulaması (Client):** API'ye bağlanan istemci script, veriyi çeker, kendi şifre anahtarıyla çözer ve terminal üzerinde anomali durumunu anlaşılır şekilde (`[❌ ANOMALOUS] / [✅ SAFE]`) anlık olarak raporlar.

## Gereksinimler

Sunucu tarafının sorunsuz çalışabilmesi için:

*   Python 3.8+
*   `uv` (veya `pip`)
*   Linux İşletim Sistemi (Tercihen Pardus/Debian tabanlı - `lsblk` komutunu kullandığı için)

### Bağımlılıklar
*   `fastapi`
*   `uvicorn`
*   `cryptography`
*   `scikit-learn`
*   `numpy`
*   `requests`

*(Bu paketler `pyproject.toml` içerisinden `uv sync` veya `uv pip install ...` komutlarıyla kurulabilir)*

## Nasıl Çalıştırılır?

### 1. Sunucu (Backend - `main.py`)

Sunucu, sisteminizdeki donanım verilerini okuyan ve şifreleyerek dış dışarıya sunan ana modüldür. Pardus makinenizde (veya Linux sunucunuzda) terminali açıp şu komutla başlatın:

```bash
# Tüm ağdan erişilebilmesi için host 0.0.0.0 olmalıdır!
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```


### 2. İstemci (Client - `client.py`)

İstemci uygulaması, sunucu tarafındaki API'den düzenli olarak (her 5 saniyede bir) şifrelenmiş verileri çeken, şifreyi çözen ve terminale yansıtan bileşendir. İşletim sistemi fark etmeksizin (Windows dahil) çalışabilir.

**Önemli:** İstemciyi çalıştırmadan önce, eğer istemciyi farklı bir bilgisayardan veya dış ağdan çalıştırıyorsanız, `client.py` dosyası içindeki `PARDUS_URL` değişkenini sunucunun çalıştığı Pardus makinesinin gerçek IP adresiyle değiştirmelisiniz.

```python
# client.py dosyasının başlarındaki URL'i Pardus IP'si ile değiştirin:
PARDUS_URL = "http://192.168.1.50:8000/scan" 
```

Ardından istemciyi çalıştırın:
```bash
uv run python client.py
```

Başarılı bağlantı durumunda çıktı şu şekilde olacaktır:
```text
==================================================
          🛡️  PARDUS USB ANOMALY SCAN  🛡️
==================================================
[✅ SAFE] 💻 INTERNAL TRAY | Name: SDA     | Type: disk   | ML Score: 0.1524
[❌ ANOMALOUS] 🔌 USB DEVICE | Name: SDB     | Type: disk   | ML Score: -0.045
==================================================
```

## Sık Karşılaşılan Sorunlar (Troubleshooting)

Eğer istemciniz sunucuya (Pardus makinesine) bağlanamıyorsa sırasıyla şunları kontrol edin:

1.  **Ağ ve VM (Sanal Makine) Ayarları:** Eğer Pardus bir VMWare / VirtualBox sanal makinede çalışıyorsa, Sanal Makinenin ağ ayarı (Network Adapter) "NAT" değil **"Bridged (Köprü)"** olmalıdır. Aksi halde ağdaki diğer cihazlar Pardus'un IP adresine ulaşamazlar.
2.  **Uvicorn Dışarıya Kapalı Olabilir:** Sunucuyu `uv run uvicorn main:app --port 8000` şeklinde yalın çalıştırırsanız, FastAPI varsayılan olarak sadece o makinenin içinden (`127.0.0.1`) gelen isteklere yanıt verir. Başka cihazların bağlanabilmesi için uvicorn komutuna mutlaka `--host 0.0.0.0` eklenmelidir.
3.  **Güvenlik Duvarı:** Windows veya Linux güvenlik duvarında **8000 (TCP)** portunun dışarıdan gelen (Inbound) isteklere açık olduğundan emin olun.

## Şifreleme ve Güvenlik Altyapısı
Uygulama istemci-sunucu arasındaki iletişimi korumak için `cryptography` kütüphanesini kullanır. Haberleşen iki kodun `main.py` ve `client.py` içinde ortak bir `SECRET_KEY` (Fernet) bulunur. Sunucu JSON üretip AES tabanlı Fernet ile veriyi karıştırıp yollar, istemci aynı simetrik anahtarla açıp doğrular. Üretim ortamlarında bu şifrelerin hardcoded olmaktan çıkarılıp .env dosyaları ile yalıtılması önerilmektedir.
