# ATTDAP — Anomali Tespit Modülü

Makine öğrenmesi tabanlı ağ trafiği anomali tespit servisidir. Ağ akış (flow) verilerini analiz ederek şüpheli etkinlikleri puanlar ve risk seviyesi belirler.

## Teknolojiler

- **Dil:** Python 3
- **API Çerçevesi:** FastAPI
- **Makine Öğrenmesi:** scikit-learn, PyTorch
- **Modeller:** Isolation Forest, Denoising Autoencoder, Gaussian Mixture Model (GMM)
- **Veritabanı (opsiyonel):** TimescaleDB

## Yaklaşım

Üç farklı model bir topluluk (ensemble) olarak birlikte çalışır:

1. **Isolation Forest** — İzolasyon tabanlı anomali algılama
2. **Denoising Autoencoder** — PyTorch ile gürültü giderici oto-kodlayıcı
3. **Gaussian Mixture Model** — Olasılıksal kümeleme modeli

Hibrit puanlama yöntemi, modellerin ağırlıklı çıktılarını (IF: 0.10, GMM: 0.90) birleştirerek 0-100 arasında bir risk puanı üretir.

## Performans Metrikleri

- F1 Skoru: 0.7995
- AUC-ROC: 0.9088
- Kesinlik (Precision): 0.8836
- Duyarlılık (Recall): 0.7300

## Risk Seviyeleri

| Puan Aralığı | Seviye |
|--------------|--------|
| 0 — 29 | Düşük |
| 30 — 49 | Orta |
| 50 — 74 | Yüksek |
| 75 — 100 | Kritik |

## Eğitim Verileri

CICIDS2017 ve UNSW-NB15 veri setleri kullanılır. İki veri seti arasındaki ortak 26 ağ akış özniteliği (feature) eğitim ve değerlendirme için seçilmiştir.

## API Uç Noktaları

- `GET /health` — Servis sağlık kontrolü ve model durumu
- `POST /score` — Tek bir ağ akış olayını puanlama
- `POST /batch-score` — Toplu puanlama (istek başına en fazla 10.000 olay)
- `GET /model-info` — Model yapılandırması, eğitim metrikleri ve öznitelik listesi

## Kurulum ve Çalıştırma

```bash
cd anomaly-model

# Sanal ortam oluşturma ve bağımlılıkları kurma
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Veri setlerini indirme
python -m data.download_datasets

# Modelleri eğitme (çıktı: models/saved/)
python -m pipeline.train

# API sunucusunu başlatma
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

## Python İçe Aktarımı

Servis dışında doğrudan Python kodu içinden de kullanılabilir:

```python
from attdap import AnomalyDetector

detector = AnomalyDetector()
sonuc = detector.score({"feature1": 0.5, "feature2": 1.2, ...})
```

## Klasör Düzeni Hakkında

- `api/` — FastAPI uygulama tanımı ve rota dosyaları
- `config/` — Yapılandırma ayarları (yollar, model parametreleri, eşik değerleri)
- `data/` — Veri seti indirme betiği ve işlenmiş/ham veri dizinleri
- `models/` — Model sarmalayıcıları ve eğitilmiş model dosyaları
- `pipeline/` — Eğitim hattı (veri yükleme, öznitelik mühendisliği, eğitim, değerlendirme)
- `db/` — TimescaleDB şeması ve sorguları (opsiyonel)
