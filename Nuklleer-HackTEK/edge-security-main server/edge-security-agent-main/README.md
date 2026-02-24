# Edge Security Agent
  &emsp;LiderAhenk merkezi yönetim sistemi ile uyumlu çalışan bu proje, "Uçta Bilişim (Edge Computing)" mimarisini benimseyen akıllı bir uçbirim ve hibrit telemetri ajanı prototipidir. Mevcut izleme sistemlerinin yarattığı ağ darboğazı ve sunucu G/Ç yükü sorunlarını, veriyi kaynağında işleyerek sunucu yükünü minimize eder.

---

# Problem
  &emsp;Mevcut telemetri sistemleri, uçbirimlerden gelen tüm ham veriyi (stabil CPU/RAM bilgileri, rutin loglar vb.) sürekli olarak merkeze iletir. Bu durum;

* Gereksiz ağ trafiği (Ağ Darboğazı),

- Sunucu tarafında veri yığınları ve donanım ihtiyacında artış,

+ Kritik güvenlik ihlallerinin gürültü arasında kaybolması riskini yaratır.

# Çözüm
  &emsp;Geliştirdiğimiz hibrit mimari ile veri, uçbirimde analiz edilir. Rutin veriler filtrelenir ve paketlenirken, kritik güvenlik ihlalleri "bypass" kanalıyla anında merkeze raporlanır.

## Sistem Mimarisi
<p align="center">
<img width="750" height="671" alt="sistem_mimarisi" src="https://github.com/user-attachments/assets/dea0f8b0-9e00-4024-86b2-6231b3e71584" />
</p>

<p align="center">
Şema-1: Sistem mimarisi.
</p>




  &emsp;Projemiz, verinin toplanmasından sunucuya yazılmasına kadar olan süreci optimize eden hibrit bir akışa sahiptir.

__Ham Veri Toplama:__ Pardus donanım ve işletim sistemi seviyesinde telemetri verileri toplanır.

**Uçta Analiz & Gürültü Eleme:** Stabil durumdaki veriler elenir. Sadece anlamlı değişimler işleme alınır.

**Dinamik Önceliklendirme:** Bu aşamada veriler iki gruba ayrılır

  &emsp; 1. Kritik Veri (Bypass): Anormal CPU ve RAM kullanımı, anormal disk yazma hızı, USB ihlalleri, yetkisiz girişler, yetkisiz port kullanımı gibi kritik hatalar anında iletilir.

  &emsp; 2. Rutin Veri (Batch): Periyodik loglar zlib ile sıkıştırılarak paketler halinde gönderilir.

**Ağ Farkındalığı:** Ajan, ağ yoğunluğunu analiz ederek gönderim zamanlamasını otonom olarak ayarlar (geliştirilmektedir).

<p align="center">

  ![WhatsApp Image 2026-02-22 at 09 24 21](https://github.com/user-attachments/assets/de24913d-8dec-4acd-b110-28704c3a21bd)

</p>

<p align="center">
Görsel-1: Sunucu arayüzü.
</p>

## Öne Çıkan Teknik Özellikler

**Asenkron Motor:** Python asyncio altyapısı sayesinde, veri gönderimi yapılırken sistem takibi kesintisiz devam eder.

**Veri Optimizasyonu:** Gürültü engelleme(geliştirilmektedir.), JSON paketleme ve zlib sıkıştırma ile ham veriye oranla %90'a varan bant genişliği tasarrufu sağlanır.

**Offline Resilience**: Ağ bağlantısı koptuğunda veriler yerel SQLite veritabanında depolanır (buffering). Ağ bağlantısı sağlandığında ağ darboğazına sebep olmamak için, veri maksimum 50'li paketler halinde sunucuya iletilir.

**Disk Odaklı Çalışma Prensibi**: Sunucu bağlatısının kesildiği durumlarda veri kaybını önlemek için uçbirim tarafından veriler RAM yerine diske kaydedilir. Bu sayede uçbirimin donanımsal yükü azalırken veri kaybı olmaz.

**Çoklu Cihaz Uyumu**: Verileri uçbirim ID'leri ile birlikte depolar ve analiz eder. Bu sayede sunucu monitoründe ağdaki istenilen ajan kolaylıkla yönetilebilir.,



## Performans Kıyaslaması

| Metrik | Geleneksel Mimari | Nükleer HackTEK | Kazanım |
| :--- | :--- | :--- | :--- |
| **Hatalı Alarm Oranı** | Yüksek (Filtresiz) | Çok Düşük (Akıllı Filtre) | **Yüksek Doğruluk** |
| **İletişim Kanalı** | Tek Hat (Sürekli) | Hibrit (Bypass + Batch) | **Dinamik Öncelik** |


# Kurulum ve Çalıştırma

`edge-security-agent`'ı yerel ortamınızda veya sunucunuzda çalıştırmak için aşağıdaki adımları takip edin.

## 1. Ön Koşullar
Sisteminizde aşağıdaki araçların yüklü olduğundan emin olun:
* **Python 3.8+**
* **pip**
* **Git**

## 2. Depoyu Klonlayın
Öncelikle projeyi bilgisayarınıza indirin ve proje dizinine gidin:
  ``bash
  git clone [https://github.com/Nukleer-HackTEK/edge-security-agent.git](https://github.com/Nukleer-HackTEK/edge-security-agent.git)
  cd edge-security-agent``

## 3. Çalıştırma
Bütün dosyalar yüklendikten sonra terminali açıp baslatici.py dosyasını çalıştırın.

# Güvenlik ve Gizlilik 

Nükleer HackTEK, sadece ağı izlemekle kalmaz, topladığı verinin ve kendi sisteminin güvenliğini de **Sıfır Güven (Zero-Trust)** ve **Mahremiyet Odaklı Tasarım (Privacy by Design)** prensipleriyle sağlar:

* **Kriptografik Doğrulama:** USB erişim denetimleri sadece seri no (ID_SERIAL) ile değil, şifreli anahtarlar ile donanımsal olarak yapılır. Hiçbir şifre veya sunucu adresi koda gömülmez. (Mevcut programda seri no ile çalışan bu sistem geliştirilmektedir)
* **Yetkisiz Port Koruması**: Tanımlanan güvenli portlar dışında uçbirim sisteminde bilinmeyen port açılması durumunda lideri uyararak olası tehditleri bildirir.
* **Anormal Log Takibi**: Özelleştirilebilen mesai saatleri dışında uçbirim tarafından sisteme giriş denemelerinin fark edilip raporlanması.
* **Veri Maskeleme ve Anonimleştirme:** Uçbirimdeki güvenlik logları lidere iletilmeden önce uçta (edge) filtrelenir. Filtrelemede logların içine sızabilecek personelin kişisel verileri maskelenerek kurum içi mahremiyet korunur. (geliştirilmektedir.)

# Takım & Lisans
Bu proje Nüküleer HackTEK Takımı tarafından geliştirilmiştir
MIT
