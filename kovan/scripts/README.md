# Yardımcı Betikler (Scripts)

Geliştirme ve analiz sürecinde kullanılan otomasyon betiklerini barındırır. Bu betikler ana uygulama mantığının parçası değildir; yardımcı araçlar olarak ihtiyaç duyulduğunda çalıştırılır.

## Betikler

### analyze-pardus.ts / analyze-pardus.mjs

Pardus işletim sistemindeki paket listesini analiz eder. Kurulu paketlerin bilgilerini çıkarır ve CVE veritabanı ile eşleştirme için hazırlar. TypeScript ve JavaScript sürümleri mevcuttur.

```bash
bun run analyze-pardus.ts
```

### screenshot-all.ts

Ön yüz arayüzünün farklı sayfalarını ve durumlarını otomatik olarak ekran görüntüsüne alır. Alınan görüntüler `screenshots/` klasörüne kaydedilir. Sunum ve belgeleme amacıyla kullanılır.

```bash
bun run screenshot-all.ts
```

### pardus-analysis/

Pardus paket analiz sonuçlarının saklandığı alt klasördür. `analyze-pardus` betiğinin çıktıları burada tutulur.
