# Liderahenk UI (Lider UI)

Liderahenk Merkezi Yönetim Sistemi için modern ve yetenekli web arayüzü. Bu proje Vue.js altyapısı üzerine kurulmuştur.

## 🚀 Yerel Geliştirme (Local Development)

Canlı sunucuda çalışan `backend` servisine (**Tomcat - port 8080**) müdahale etmeden arayüz geliştirmesi yapabilirsiniz. Vue'nun Proxy özelliği sayesinde, yerel geliştirme sunucunuz (port `8081`) tüm API isteklerini otomatik olarak arka plandaki canlı sunucuya iletir.

### 1- Bağımlılıkları Kurma
Projeyi ilk indirdiğinizde kütüphaneleri kurmak için:
```bash
yarn install
```

### 2- Geliştirme Sunucusunu Başlatma (Hot-Reload)
Canlı değişiklikleri anında görmek ve proxy ile backend'e bağlanmak için:
```bash
yarn serve
```
> Sunucu başladığında tarayıcınızdan **http://localhost:8081** (veya sunucu IP adresinizden, örn: http://10.36.133.178:8081) adresine giderek sistemi kullanabilirsiniz. API, WebSocket ve Tunnel istekleri otomatik proxy ile 8080'e yönlendirilir.

## 📦 Üretim İçin Derleme (Production Build)

Değişiklikleriniz bittiğinde, Tomcat/Backend içerisine gömülecek statik HTML/JS/CSS dosyalarını oluşturmak için:
```bash
yarn build
```
Bu komut sonucunda oluşan `dist/` klasöründeki dosyalar, backend projenizin (LiderAPI) `src/main/resources/static/` dizinine kopyalanarak veya mevcut WAR güncellenerek deploy edilebilir.

## 🧹 Kod Standartları (Linting)

Kodlarınızı temizlemek ve standartlara uydurmak için:
```bash
yarn lint
```

## ⚙️ Proxy Ayarları (vue.config.js)
Geliştirme aşamasında backend'in nerede olduğunu belirtmek için `vue.config.js` dosyası veya `.env.development` içerisindeki `BACKEND_URL` ayarı kullanılır. Varsayılan arka plan sunucusu `http://127.0.0.1:8080`'dir.
