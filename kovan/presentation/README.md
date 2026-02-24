# Sunum (Presentation)

HackMETU yarışması için hazırlanmış interaktif web tabanlı sunum uygulamasıdır. Proje tanıtımı, mimari diyagramlar ve teknik detaylar bu uygulama üzerinden sunulur.

## Teknolojiler

- **Kütüphane:** React
- **Derleme Aracı:** Vite
- **Dil:** TypeScript

## Temel Bileşenler

- `src/App.tsx` — Sunum akışı, slaytlar ve geçiş mantığı
- `src/ParticleNetwork.tsx` — Arka plan parçacık animasyonu
- `src/styles.css` — Sunum stilleri
- `src/diagrams/` — Mimari ve akış diyagramları

## Kurulum ve Çalıştırma

```bash
cd presentation
pnpm install

# Geliştirme sunucusu
pnpm run dev

# Üretim derlemesi (çıktı: dist/)
pnpm run build
```

## Not

Bu uygulama Kovan sisteminin işlevsel bir parçası değildir. Yalnızca projenin tanıtımı ve sunumu amacıyla geliştirilmiştir.
