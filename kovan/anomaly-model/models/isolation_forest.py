"""
Isolation Forest anomaly detection model.

Trains on normal (benign) data only. Uses decision_function to produce
anomaly scores. Stores training score statistics for single-sample scoring.
"""

import logging

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from config.settings import (
    IF_N_ESTIMATORS,
    IF_CONTAMINATION,
    IF_MAX_SAMPLES,
    IF_RANDOM_STATE,
    IF_MODEL_PATH,
)

logger = logging.getLogger(__name__)


class IsolationForestModel:
    """Wrapper around sklearn IsolationForest for ATTDAP anomaly detection."""

    def __init__(self, n_estimators: int = IF_N_ESTIMATORS,
                 contamination: float = IF_CONTAMINATION,
                 max_samples=IF_MAX_SAMPLES, random_state: int = IF_RANDOM_STATE):
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            max_samples=max_samples,
            random_state=random_state,
            n_jobs=-1,
        )
        self.is_fitted = False
        # Training score stats for normalization
        self.train_score_min: float = 0.0
        self.train_score_max: float = 1.0

    def train(self, X_normal: np.ndarray) -> dict:
        """Train on normal (benign) data only."""
        logger.info("Training IF on %d samples (%d features)",
                     X_normal.shape[0], X_normal.shape[1])
        self.model.fit(X_normal)
        self.is_fitted = True

        # Store training score range for normalization
        raw = -self.model.decision_function(X_normal)
        self.train_score_min = float(np.percentile(raw, 1))
        self.train_score_max = float(np.percentile(raw, 99))

        metrics = {
            "n_estimators": self.model.n_estimators,
            "n_samples_trained": X_normal.shape[0],
            "score_min": self.train_score_min,
            "score_max": self.train_score_max,
        }
        logger.info("IF training complete: score_range=[%.4f, %.4f]",
                     self.train_score_min, self.train_score_max)
        return metrics

    def predict_scores(self, X: np.ndarray) -> np.ndarray:
        """Anomaly scores normalized to [0, 1] using training statistics."""
        if not self.is_fitted:
            raise RuntimeError("Model not trained.")
        raw = -self.model.decision_function(X)
        score_range = self.train_score_max - self.train_score_min
        if score_range <= 0:
            return np.zeros(len(X))
        scores = (raw - self.train_score_min) / score_range
        return np.clip(scores, 0, 1)

    def predict_single(self, x: np.ndarray) -> float:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        return float(self.predict_scores(x)[0])

    def save(self, path: str | None = None) -> None:
        save_path = path or str(IF_MODEL_PATH)
        joblib.dump({
            "model": self.model,
            "train_score_min": self.train_score_min,
            "train_score_max": self.train_score_max,
        }, save_path)
        logger.info("IF saved to %s", save_path)

    def load(self, path: str | None = None) -> None:
        load_path = path or str(IF_MODEL_PATH)
        data = joblib.load(load_path)
        if isinstance(data, dict):
            self.model = data["model"]
            self.train_score_min = data.get("train_score_min", 0.0)
            self.train_score_max = data.get("train_score_max", 1.0)
        else:
            # Backwards compat: old format saved just the model
            self.model = data
        self.is_fitted = True
        logger.info("IF loaded from %s", load_path)
