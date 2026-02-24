# Ön Yüz (Frontend)

Kovan sisteminin web tabanlı yönetim panelidir. Kullanıcılar bu arayüz üzerinden agentları görüntüler, komut gönderir ve sistem durumunu takip eder.

## Teknolojiler

- **Kütüphane:** React 18
- **Derleme Aracı:** Vite
- **Durum Yönetimi:** Zustand
- **Yönlendirme:** React Router
- **Kimlik Doğrulama İstemcisi:** better-auth React eklentisi
- **Dil:** TypeScript

## Temel Sorumluluklar

- Kullanıcı girişi ve kayıt işlemleri
- Agent listesi, arama ve filtreleme (grup bazlı dahil)
- Agent detay görünümü (makine bilgileri, durum, grup, takma ad)
- Terminal arayüzü ile komut gönderme ve çıktı görüntüleme
- Admin paneli: kullanıcı yönetimi, rol ataması, agent izinleri
- Keylogger başlatma/durdurma ve tuş vuruşlarını görüntüleme
- Agent yeniden adlandırma (takma ad) ve gruplama
- Grup bazlı toplu komut gönderimi (broadcast)
- Harita ve ayarlar sayfaları

## Sayfa Yapısı

- `/login` — Giriş sayfası (yalnızca oturum açmamış kullanıcılar)
- `/register` — Kayıt sayfası (yalnızca oturum açmamış kullanıcılar)
- `/` — Ana gösterge paneli: agent kartları, arama, terminal
- `/admin` — Yönetici paneli: kullanıcı tablosu, izin yönetimi (yalnızca admin)

## CSS Düzeni

Stiller `src/styles/` altında ayrı dosyalara bölünmüştür:

- `base.css` — Sıfırlama, CSS değişkenleri, genel düzen, kaydırma çubuğu
- `header.css` — Üst başlık çubuğu, istatistikler, kullanıcı bölümü
- `terminal.css` — Terminal arayüzü, komut blokları, giriş çubuğu
- `machine-control.css` — Makine bilgi kartı, eylem düğmeleri, eylem günlüğü
- `dashboard.css` — Gösterge paneli ızgarası, istatistik ve agent kartları
- `auth.css` — Giriş/kayıt sayfaları, form alanları
- `admin.css` — Yönetici paneli, kullanıcı tablosu, rol rozetleri
- `keylogger.css` — Keylogger çekmece arayüzü

## Kurulum ve Çalıştırma

```bash
cd frontend
pnpm install

# Geliştirme sunucusu (localhost:5173, API proxy etkin)
pnpm run dev

# Üretim derlemesi (çıktı: dist/)
pnpm run build
```

Üretim derlemesi sonrası `dist/` klasörü sunucu tarafından otomatik olarak statik dosya şeklinde sunulur.

## API İletişimi

`src/api.ts` dosyası sunucu ile tüm HTTP iletişimini yönetir. `fetchAgents`, `sendCommand`, `renameAgent` gibi sarmalayıcı fonksiyonlar burada tanımlıdır. Geliştirme modunda Vite proxy ayarı sayesinde istekler otomatik olarak `localhost:4444` adresine yönlendirilir.
