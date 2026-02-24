"""
Gaussian Mixture Model for density-based anomaly detection.

Fits a GMM on normal data. Anomaly score = negative log-likelihood.
Stores training score statistics for single-sample normalization.
"""

import logging

import joblib
import numpy as np
from sklearn.mixture import GaussianMixture

from config.settings import (
    GMM_N_COMPONENTS,
    GMM_COVARIANCE_TYPE,
    GMM_REG_COVAR,
    GMM_MODEL_PATH,
    RANDOM_STATE,
)

logger = logging.getLogger(__name__)


class GMMModel:
    """Wrapper around sklearn GaussianMixture for anomaly detection."""

    def __init__(self, n_components: int = GMM_N_COMPONENTS):
        self.n_components = n_components
        self.model: GaussianMixture | None = None
        self.is_fitted = False
        # Training score stats for normalization
        self.train_score_mean: float = 0.0
        self.train_score_std: float = 1.0

    def train(self, X_normal: np.ndarray) -> dict:
        """Train GMM on normal data (float64 for numerical stability)."""
        logger.info("Training GMM (%d components) on %d samples",
                     self.n_components, X_normal.shape[0])

        X = X_normal.astype(np.float64)
        self.model = GaussianMixture(
            n_components=self.n_components,
            covariance_type=GMM_COVARIANCE_TYPE,
            reg_covar=GMM_REG_COVAR,
            random_state=RANDOM_STATE,
            max_iter=200,
            n_init=2,
        )
        self.model.fit(X)
        self.is_fitted = True

        # Store training score stats
        raw = -self.model.score_samples(X)
        self.train_score_mean = float(np.mean(raw))
        self.train_score_std = float(np.std(raw))

        bic = self.model.bic(X)
        logger.info("GMM training complete: BIC=%.0f", bic)
        return {"n_components": self.n_components, "bic": float(bic)}

    def predict_scores(self, X: np.ndarray) -> np.ndarray:
        """Anomaly scores [0-1] using log-ratio normalization.

        Uses log2(nll / baseline) with a gentle sensitivity multiplier.
        At baseline (abs of training mean NLL), score = 0.5.
        Sensitivity 0.25 keeps the sigmoid in its useful range for OOD inputs.
        """
        if not self.is_fitted:
            raise RuntimeError("Model not trained.")
        raw = -self.model.score_samples(X.astype(np.float64))
        baseline = max(abs(self.train_score_mean), 1.0)
        ratio = raw / baseline
        log_ratio = np.log2(np.maximum(ratio, 1e-6))
        return 1 / (1 + np.exp(-log_ratio * 0.25))

    def predict_single(self, x: np.ndarray) -> float:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        return float(self.predict_scores(x)[0])

    def save(self, path: str | None = None) -> None:
        save_path = path or str(GMM_MODEL_PATH)
        joblib.dump({
            "model": self.model,
            "train_score_mean": self.train_score_mean,
            "train_score_std": self.train_score_std,
        }, save_path)
        logger.info("GMM saved to %s", save_path)

    def load(self, path: str | None = None) -> None:
        load_path = path or str(GMM_MODEL_PATH)
        data = joblib.load(load_path)
        if isinstance(data, dict):
            self.model = data["model"]
            self.train_score_mean = data.get("train_score_mean", 0.0)
            self.train_score_std = data.get("train_score_std", 1.0)
        else:
            # Backwards compat
            self.model = data
        self.n_components = self.model.n_components
        self.is_fitted = True
        logger.info("GMM loaded from %s", load_path)
