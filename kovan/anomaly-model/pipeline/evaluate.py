"""
Model evaluation (v4): 3-model ensemble on test data.

Usage:
    python -m pipeline.evaluate
    python -m pipeline.evaluate --max-rows 100000
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import RANDOM_STATE, TEST_SIZE, BEST_CONFIG_PATH
from pipeline.data_loader import load_cicids2017, load_unsw_nb15
from pipeline.feature_engineer import FeatureEngineer
from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.gmm_model import GMMModel
from models.hybrid_scorer import HybridScorer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="ATTDAP Model Evaluation")
    parser.add_argument("--max-rows", type=int, default=200000)
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  ATTDAP Model Evaluation (v4)")
    print("=" * 60 + "\n")

    # Load models
    fe = FeatureEngineer()
    fe.load()
    if_model = IsolationForestModel()
    if_model.load()
    ae_model = AutoencoderModel(input_dim=fe.n_features)
    ae_model.load()
    gmm_model = GMMModel()
    gmm_model.load()
    scorer = HybridScorer(if_model, ae_model, gmm_model)

    # Load config
    config = {}
    if BEST_CONFIG_PATH.exists():
        with open(BEST_CONFIG_PATH) as f:
            config = json.load(f)
    threshold = config.get("threshold", 27)

    # Load test data
    cicids = load_cicids2017(max_rows=args.max_rows)
    unsw = load_unsw_nb15(max_rows=args.max_rows)
    combined = pd.concat([cicids, unsw], ignore_index=True).fillna(0)

    datasets = {"CICIDS2017": cicids, "UNSW-NB15": unsw, "Combined": combined}

    for name, df in datasets.items():
        X = fe.transform(df)
        y = df["is_attack"].values

        _, X_test, _, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y)

        results = scorer.score_batch(X_test)
        hybrid = results["hybrid_scores"]
        y_pred = (hybrid >= threshold).astype(int)

        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        auc = roc_auc_score(y_test, hybrid)

        cm = confusion_matrix(y_test, y_pred)

        print(f"  {name}")
        print(f"    Samples: {len(y_test):,}  |  Attack: {y_test.mean():.1%}")
        print(f"    F1={f1:.4f}  Prec={prec:.4f}  Rec={rec:.4f}  AUC={auc:.4f}")
        print(f"    TN={cm[0][0]:,}  FP={cm[0][1]:,}  FN={cm[1][0]:,}  TP={cm[1][1]:,}")

        # Individual model AUC
        if_auc = roc_auc_score(y_test, results["if_scores"])
        ae_auc = roc_auc_score(y_test, results["ae_scores"])
        gmm_auc = roc_auc_score(y_test, results["gmm_scores"])
        print(f"    IF AUC={if_auc:.4f}  AE AUC={ae_auc:.4f}  GMM AUC={gmm_auc:.4f}")
        print()

    print("=" * 60)


if __name__ == "__main__":
    main()
