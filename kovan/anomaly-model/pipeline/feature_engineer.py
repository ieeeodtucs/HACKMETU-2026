"""
Feature engineering: 26 common features, percentile clipping, log1p, QuantileTransformer.

v4 pipeline: raw features → percentile clip → log1p → QuantileTransformer(normal output)
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import QuantileTransformer

from config.settings import (
    COMMON_FEATURES,
    FEATURE_SCALER_PATH,
    SELECTED_FEATURES_PATH,
)

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """v4 feature pipeline: 26 common features with QuantileTransformer."""

    def __init__(self):
        self.scaler: QuantileTransformer | None = None
        self.feature_names: list[str] = list(COMMON_FEATURES)
        self.clip_upper: pd.Series | None = None

    def fit_transform(self, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Fit pipeline on data and transform. Returns (X, y, feature_names)."""
        # Percentile clipping fit (from normal data only)
        normal = df[df["is_attack"] == 0] if "is_attack" in df.columns else df
        raw_normal = normal[self.feature_names].copy().fillna(0).clip(lower=0)
        self.clip_upper = raw_normal.quantile(0.99)

        # Transform
        X_raw = self._preprocess(df)

        # Fit QuantileTransformer
        self.scaler = QuantileTransformer(
            output_distribution="normal", n_quantiles=1000, random_state=42,
        )
        X = self.scaler.fit_transform(X_raw).astype(np.float32)
        X = np.nan_to_num(X, nan=0, posinf=3, neginf=-3)

        y = df["is_attack"].values.astype(np.int32) if "is_attack" in df.columns else np.zeros(len(X), dtype=np.int32)

        logger.info("FeatureEngineer fitted: %d features, %d samples", len(self.feature_names), len(X))
        return X, y, self.feature_names

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """Transform new data using fitted pipeline."""
        if self.scaler is None:
            raise RuntimeError("Not fitted. Call fit_transform first.")
        X_raw = self._preprocess(df)
        X = self.scaler.transform(X_raw).astype(np.float32)
        return np.nan_to_num(X, nan=0, posinf=3, neginf=-3)

    def transform_single(self, features: dict) -> np.ndarray:
        """Transform a single event dict into a feature vector."""
        if self.scaler is None:
            raise RuntimeError("Not fitted. Call fit_transform first.")
        row = pd.DataFrame([features])
        for f in self.feature_names:
            if f not in row.columns:
                row[f] = 0.0
        return self.transform(row)

    def _preprocess(self, df: pd.DataFrame) -> np.ndarray:
        """Extract 26 features → clip → log1p."""
        out = df[self.feature_names].copy().fillna(0).clip(lower=0)
        if self.clip_upper is not None:
            out = out.clip(upper=self.clip_upper, axis=1)
        out = np.log1p(out)
        X = out.values.astype(np.float32)
        return np.nan_to_num(X, nan=0, posinf=0, neginf=0)

    def save(self) -> None:
        """Save scaler, clip bounds, and feature names."""
        if self.scaler is not None:
            joblib.dump({
                "scaler": self.scaler,
                "clip_upper": self.clip_upper,
            }, FEATURE_SCALER_PATH)
            logger.info("Scaler saved to %s", FEATURE_SCALER_PATH)
        with open(SELECTED_FEATURES_PATH, "w") as f:
            json.dump(self.feature_names, f)
        logger.info("Feature names saved (%d features)", len(self.feature_names))

    def load(self) -> None:
        """Load scaler, clip bounds, and feature names."""
        if not FEATURE_SCALER_PATH.exists():
            raise FileNotFoundError(f"Scaler not found at {FEATURE_SCALER_PATH}")
        data = joblib.load(FEATURE_SCALER_PATH)
        if isinstance(data, dict):
            self.scaler = data["scaler"]
            self.clip_upper = data.get("clip_upper")
        else:
            # Backwards compat: old format saved just the scaler
            self.scaler = data
        if SELECTED_FEATURES_PATH.exists():
            with open(SELECTED_FEATURES_PATH) as f:
                self.feature_names = json.load(f)
        logger.info("FeatureEngineer loaded: %d features", len(self.feature_names))

    @property
    def n_features(self) -> int:
        return len(self.feature_names)
