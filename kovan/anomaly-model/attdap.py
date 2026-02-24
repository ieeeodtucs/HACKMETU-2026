"""
ATTDAP Anomaly Detection - Tek dosya entegrasyon arayuzu.

Baska projeden kullanmak icin:

    from attdap import AnomalyDetector

    detector = AnomalyDetector()

    # Tek event skorla
    score = detector.score({
        "flow_duration": 120000,
        "total_fwd_packets": 1000,
        "syn_flag_count": 500,
        "flow_bytes_per_sec": 9999999,
    })
    print(score)
    # {'hybrid_score': 72.5, 'risk_level': 'high', 'if_score': 0.8, ...}

    # Batch skorla (DataFrame)
    import pandas as pd
    df = pd.DataFrame([...])
    results = detector.score_batch(df)

    # Sadece risk seviyesi
    level = detector.get_risk_level(event_dict)  # "low" | "medium" | "high" | "critical"
"""

import sys
from pathlib import Path

# Proje kokunu path'e ekle
_PROJECT_ROOT = Path(__file__).resolve().parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import numpy as np
import pandas as pd

from pipeline.feature_engineer import FeatureEngineer
from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.gmm_model import GMMModel
from models.hybrid_scorer import HybridScorer
from config.settings import COMMON_FEATURES


class AnomalyDetector:
    """
    ATTDAP Anomaly Detection - kullanima hazir API.

    3-model ensemble: Isolation Forest + Denoising Autoencoder + GMM
    Egitim metrikleri: F1=0.8311, AUC-ROC=0.9395, Precision=0.8413, Recall=0.8212
    """

    def __init__(self, models_dir: str | Path | None = None):
        """
        Args:
            models_dir: Model dosyalarinin bulundugu klasor.
                         None ise varsayilan 'models/saved/' kullanilir.
        """
        if models_dir is not None:
            import config.settings as settings
            settings.MODELS_SAVED_DIR = Path(models_dir)
            settings.IF_MODEL_PATH = settings.MODELS_SAVED_DIR / "isolation_forest.pkl"
            settings.AE_MODEL_PATH = settings.MODELS_SAVED_DIR / "autoencoder.pt"
            settings.GMM_MODEL_PATH = settings.MODELS_SAVED_DIR / "gmm_model.pkl"
            settings.FEATURE_SCALER_PATH = settings.MODELS_SAVED_DIR / "feature_scaler.pkl"
            settings.SELECTED_FEATURES_PATH = settings.MODELS_SAVED_DIR / "selected_features.json"
            settings.BEST_CONFIG_PATH = settings.MODELS_SAVED_DIR / "best_config.json"

        self.fe = FeatureEngineer()
        self.fe.load()

        self.if_model = IsolationForestModel()
        self.if_model.load()

        self.ae_model = AutoencoderModel(input_dim=self.fe.n_features)
        self.ae_model.load()

        self.gmm_model = GMMModel()
        self.gmm_model.load()

        self.scorer = HybridScorer(self.if_model, self.ae_model, self.gmm_model)

    @property
    def feature_names(self) -> list[str]:
        """Modelin beklediği 26 feature ismi."""
        return list(self.fe.feature_names)

    def score(self, event: dict) -> dict:
        """
        Tek bir network flow event'ini skorla.

        Args:
            event: Feature dict. Eksik feature'lar 0 kabul edilir.
                   Ornek: {"flow_duration": 120000, "syn_flag_count": 50, ...}

        Returns:
            {
                "hybrid_score": float (0-100),
                "risk_level": "low" | "medium" | "high" | "critical",
                "if_score": float (0-1),
                "ae_score": float (0-1),
                "gmm_score": float (0-1),
                "feature_contributions": {feature_name: weight, ...}
            }
        """
        X = self.fe.transform_single(event)
        return self.scorer.get_detailed_score(X, feature_names=self.fe.feature_names)

    def score_batch(self, data: pd.DataFrame | list[dict]) -> dict:
        """
        Birden fazla event'i skorla.

        Args:
            data: DataFrame veya dict listesi.

        Returns:
            {
                "hybrid_scores": np.ndarray (0-100),
                "risk_levels": list[str],
                "if_scores": np.ndarray (0-1),
                "ae_scores": np.ndarray (0-1),
                "gmm_scores": np.ndarray (0-1),
            }
        """
        if isinstance(data, list):
            data = pd.DataFrame(data)

        # Eksik feature'lari 0 ile doldur
        for f in self.fe.feature_names:
            if f not in data.columns:
                data[f] = 0.0

        X = self.fe.transform(data)
        return self.scorer.score_batch(X)

    def get_risk_level(self, event: dict) -> str:
        """Sadece risk seviyesini dondur: 'low', 'medium', 'high', 'critical'."""
        return self.score(event)["risk_level"]

    def is_anomaly(self, event: dict, threshold: float = 27.0) -> bool:
        """Event anomali mi? (hybrid_score >= threshold)."""
        return self.score(event)["hybrid_score"] >= threshold
