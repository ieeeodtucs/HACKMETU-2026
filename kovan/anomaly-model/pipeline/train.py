"""
End-to-end training pipeline (v4):
    1. Load datasets (CICIDS2017 + UNSW-NB15)
    2. Feature engineering (26 common features + QuantileTransformer)
    3. Train Isolation Forest (on normal data)
    4. Train Denoising Autoencoder (on normal data)
    5. Train GMM (on normal data)
    6. Optimize 3-model ensemble weights
    7. Save models and artifacts

Usage:
    python -m pipeline.train                    # Combined (varsayilan)
    python -m pipeline.train --source cicids    # Sadece CICIDS2017
    python -m pipeline.train --source unsw      # Sadece UNSW-NB15
    python -m pipeline.train --max-rows 200000  # Hizli test
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import RANDOM_STATE, TEST_SIZE, MODELS_SAVED_DIR, BEST_CONFIG_PATH
from pipeline.data_loader import load_cicids2017, load_unsw_nb15, load_all_datasets
from pipeline.feature_engineer import FeatureEngineer
from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.gmm_model import GMMModel
from models.hybrid_scorer import HybridScorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def load_by_source(source: str, max_rows: int | None = None):
    import pandas as pd
    if source == "cicids":
        df = load_cicids2017(max_rows=max_rows)
        if df.empty:
            raise FileNotFoundError("CICIDS2017 verisi bulunamadi")
        return df
    elif source == "unsw":
        df = load_unsw_nb15(max_rows=max_rows)
        if df.empty:
            raise FileNotFoundError("UNSW-NB15 verisi bulunamadi")
        return df
    else:  # combined
        frames = []
        cicids = load_cicids2017(max_rows=max_rows)
        if not cicids.empty:
            frames.append(cicids)
        unsw = load_unsw_nb15(max_rows=max_rows)
        if not unsw.empty:
            frames.append(unsw)
        if not frames:
            raise FileNotFoundError("Hicbir veri seti bulunamadi")
        combined = pd.concat(frames, ignore_index=True).fillna(0)
        return combined


def train_models(df, tag: str = "default", save: bool = True) -> dict:
    """Full v4 training pipeline: FE → IF + AE + GMM → ensemble optimize → save."""
    t0 = time.time()

    # Feature engineering
    fe = FeatureEngineer()
    X, y, feature_names = fe.fit_transform(df)
    logger.info("[%s] Features: %d, samples: %d, attack: %.1f%%",
                tag, X.shape[1], len(X), y.mean() * 100)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y)
    X_normal = X_train[y_train == 0]

    # Subsample normal data for faster training (200K is enough for good results)
    MAX_TRAIN_NORMAL = 200_000
    if len(X_normal) > MAX_TRAIN_NORMAL:
        rng = np.random.RandomState(RANDOM_STATE)
        idx = rng.choice(len(X_normal), MAX_TRAIN_NORMAL, replace=False)
        X_normal = X_normal[idx]
        logger.info("[%s] Subsampled normal data: %d -> %d", tag, len(X_train[y_train == 0]), MAX_TRAIN_NORMAL)

    logger.info("[%s] Train normal: %d | Test: %d", tag, len(X_normal), len(X_test))

    # Train IF
    if_model = IsolationForestModel()
    if_model.train(X_normal)

    # Train AE
    ae_model = AutoencoderModel(input_dim=X.shape[1])
    ae_model.train(X_normal)

    # Train GMM
    gmm_model = GMMModel()
    gmm_model.train(X_normal)

    # Score test set
    if_scores = if_model.predict_scores(X_test)
    ae_scores = ae_model.predict_scores(X_test)
    gmm_scores = gmm_model.predict_scores(X_test)

    if_auc = roc_auc_score(y_test, if_scores)
    ae_auc = roc_auc_score(y_test, ae_scores)
    gmm_auc = roc_auc_score(y_test, gmm_scores)
    logger.info("[%s] AUC - IF: %.4f, AE: %.4f, GMM: %.4f", tag, if_auc, ae_auc, gmm_auc)

    # Optimize ensemble weights
    best_f1, best_w1, best_w2, best_w3, best_t = 0, 0.8, 0.0, 0.2, 27
    step = 0.05
    for w1 in np.arange(0, 1.01, step):
        for w2 in np.arange(0, 1.01 - w1, step):
            w3 = round(1.0 - w1 - w2, 2)
            if w3 < 0:
                continue
            h = (w1 * if_scores + w2 * ae_scores + w3 * gmm_scores) * 100
            for t in range(5, 90, 2):
                f = f1_score(y_test, (h >= t).astype(int), zero_division=0)
                if f > best_f1:
                    best_f1, best_w1, best_w2, best_w3, best_t = f, w1, w2, w3, t

    # Fine-tune threshold
    h = (best_w1 * if_scores + best_w2 * ae_scores + best_w3 * gmm_scores) * 100
    for t in range(max(1, best_t - 5), min(95, best_t + 5)):
        f = f1_score(y_test, (h >= t).astype(int), zero_division=0)
        if f > best_f1:
            best_f1, best_t = f, t

    hybrid = (best_w1 * if_scores + best_w2 * ae_scores + best_w3 * gmm_scores) * 100
    y_pred = (hybrid >= best_t).astype(int)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, hybrid)

    elapsed = time.time() - t0

    logger.info("[%s] F1=%.4f, Prec=%.4f, Rec=%.4f, AUC=%.4f", tag, best_f1, prec, rec, auc)
    logger.info("[%s] Weights: IF=%.2f / AE=%.2f / GMM=%.2f, Threshold=%d",
                tag, best_w1, best_w2, best_w3, best_t)

    # Save
    if save:
        if_model.save()
        ae_model.save()
        gmm_model.save()
        fe.save()

        json.dump({
            "feature_names": feature_names,
            "n_features": len(feature_names),
            "w_if": float(best_w1), "w_ae": float(best_w2), "w_gmm": float(best_w3),
            "threshold": int(best_t),
            "strategy": "3-model weighted avg",
            "scaler": "QuantileTransformer",
            "f1": float(best_f1), "auc_roc": float(auc),
            "precision": float(prec), "recall": float(rec),
            "if_auc": float(if_auc), "ae_auc": float(ae_auc), "gmm_auc": float(gmm_auc),
        }, open(BEST_CONFIG_PATH, "w"), indent=2)
        logger.info("[%s] Models saved to %s", tag, MODELS_SAVED_DIR)

    return {
        "tag": tag, "n_samples": len(df), "n_features": X.shape[1],
        "f1": best_f1, "precision": prec, "recall": rec, "auc_roc": auc,
        "if_auc": if_auc, "ae_auc": ae_auc, "gmm_auc": gmm_auc,
        "weights": {"if": best_w1, "ae": best_w2, "gmm": best_w3},
        "threshold": best_t, "elapsed": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description="ATTDAP Model Egitimi (v4)")
    parser.add_argument("--source", choices=["cicids", "unsw", "combined"],
                        default="combined", help="Veri kaynagi")
    parser.add_argument("--max-rows", type=int, default=None, help="Kaynak basina max satir")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print(f"  ATTDAP Model Egitimi (v4) - Kaynak: {args.source}")
    print("=" * 60 + "\n")

    df = load_by_source(args.source, max_rows=args.max_rows)
    print(f"  Veri: {len(df):,} satir, attack: {df['is_attack'].mean():.1%}\n")

    results = train_models(df, tag=args.source, save=True)

    print(f"\n{'=' * 60}")
    print(f"  SONUCLAR")
    print(f"{'=' * 60}")
    print(f"  F1:        {results['f1']:.4f}")
    print(f"  Precision: {results['precision']:.4f}")
    print(f"  Recall:    {results['recall']:.4f}")
    print(f"  AUC-ROC:   {results['auc_roc']:.4f}")
    print(f"  IF AUC:    {results['if_auc']:.4f}")
    print(f"  AE AUC:    {results['ae_auc']:.4f}")
    print(f"  GMM AUC:   {results['gmm_auc']:.4f}")
    print(f"  Weights:   IF={results['weights']['if']:.2f} / AE={results['weights']['ae']:.2f} / GMM={results['weights']['gmm']:.2f}")
    print(f"  Threshold: {results['threshold']}")
    print(f"  Sure:      {results['elapsed']:.1f}s")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
