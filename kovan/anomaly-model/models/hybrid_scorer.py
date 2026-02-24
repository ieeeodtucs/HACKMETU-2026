"""
Hybrid anomaly scorer: combines Isolation Forest, Autoencoder, and GMM scores
into a unified 0-100 risk score with severity classification.
"""

import logging

import numpy as np

from config.settings import (
    HYBRID_IF_WEIGHT,
    HYBRID_AE_WEIGHT,
    HYBRID_GMM_WEIGHT,
    THRESHOLD_LOW,
    THRESHOLD_MEDIUM,
    THRESHOLD_HIGH,
)
from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.gmm_model import GMMModel

logger = logging.getLogger(__name__)


def classify_risk(score: float) -> str:
    """Classify a 0-100 risk score into a severity level."""
    if score < THRESHOLD_LOW:
        return "low"
    elif score < THRESHOLD_MEDIUM:
        return "medium"
    elif score < THRESHOLD_HIGH:
        return "high"
    else:
        return "critical"


class HybridScorer:
    """
    3-model ensemble: IF + AE + GMM.

    Final score = (w_if * if_score + w_ae * ae_score + w_gmm * gmm_score) * 100
    """

    def __init__(
        self,
        if_model: IsolationForestModel,
        ae_model: AutoencoderModel,
        gmm_model: GMMModel | None = None,
        if_weight: float = HYBRID_IF_WEIGHT,
        ae_weight: float = HYBRID_AE_WEIGHT,
        gmm_weight: float = HYBRID_GMM_WEIGHT,
    ):
        self.if_model = if_model
        self.ae_model = ae_model
        self.gmm_model = gmm_model
        self.if_weight = if_weight
        self.ae_weight = ae_weight
        self.gmm_weight = gmm_weight

        # Normalize weights
        total = self.if_weight + self.ae_weight + self.gmm_weight
        self.if_weight /= total
        self.ae_weight /= total
        self.gmm_weight /= total

    def score_batch(self, X: np.ndarray) -> dict:
        """Score a batch of samples. Returns dict with scores and risk levels."""
        if_scores = self.if_model.predict_scores(X)
        ae_scores = self.ae_model.predict_scores(X)

        gmm_scores = np.zeros_like(if_scores)
        if self.gmm_model is not None and self.gmm_model.is_fitted:
            gmm_scores = self.gmm_model.predict_scores(X)

        hybrid_scores = (
            self.if_weight * if_scores +
            self.ae_weight * ae_scores +
            self.gmm_weight * gmm_scores
        ) * 100
        hybrid_scores = np.clip(hybrid_scores, 0, 100)

        risk_levels = [classify_risk(s) for s in hybrid_scores]

        return {
            "if_scores": if_scores,
            "ae_scores": ae_scores,
            "gmm_scores": gmm_scores,
            "hybrid_scores": hybrid_scores,
            "risk_levels": risk_levels,
        }

    def score_single(self, x: np.ndarray) -> dict:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        result = self.score_batch(x)
        return {
            "if_score": float(result["if_scores"][0]),
            "ae_score": float(result["ae_scores"][0]),
            "gmm_score": float(result["gmm_scores"][0]),
            "hybrid_score": float(result["hybrid_scores"][0]),
            "risk_level": result["risk_levels"][0],
        }

    def get_detailed_score(self, x: np.ndarray, feature_names: list[str] = None) -> dict:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        score = self.score_single(x)

        feature_contributions = {}
        if feature_names:
            abs_values = np.abs(x[0])
            total = abs_values.sum()
            if total > 0:
                contributions = abs_values / total
                top_indices = np.argsort(contributions)[-10:][::-1]
                for idx in top_indices:
                    if idx < len(feature_names):
                        feature_contributions[feature_names[idx]] = float(contributions[idx])

        score["feature_contributions"] = feature_contributions
        return score
