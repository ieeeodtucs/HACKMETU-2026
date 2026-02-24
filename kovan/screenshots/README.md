# Ekran Görüntüleri (Screenshots)

Ön yüz arayüzünün farklı sayfa ve durumlarına ait ekran görüntülerini barındırır. Sunum, belgeleme ve yarışma başvurusu amacıyla kullanılır.

## Alt Klasörler

- **admin/** — Yönetici paneli ekran görüntüleri (kullanıcı yönetimi, izin ataması, rol düzenleme)
- **dashboard/** — Ana gösterge paneli ekran görüntüleri (agent listesi, terminal, makine detayı)
- **guest/** — Oturum açmamış kullanıcı görünümleri (giriş ve kayıt sayfaları)
- **map/** — Harita görünümü ekran görüntüleri
- **settings/** — Ayarlar sayfası ekran görüntüleri

## Güncelleme

Ekran görüntüleri `scripts/screenshot-all.ts` betiği ile otomatik olarak yeniden alınabilir:

```bash
cd scripts
bun run screenshot-all.ts
```

Arayüzde görsel değişiklik yapıldığında ekran görüntülerinin güncellenmesi önerilir.
