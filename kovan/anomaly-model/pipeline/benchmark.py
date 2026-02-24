"""
3-Way Benchmark: CICIDS-only vs UNSW-only vs Combined

Her modeli eğitir, hepsini aynı birleşik test seti üzerinde değerlendirir.
Cross-dataset generalizasyon yeteneğini de test eder.

Usage:
    python -m pipeline.benchmark
    python -m pipeline.benchmark --max-rows 100000   # Hızlı test
"""

import argparse
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import RANDOM_STATE, TEST_SIZE, MODELS_SAVED_DIR
from pipeline.data_loader import load_cicids2017, load_unsw_nb15
from pipeline.feature_engineer import FeatureEngineer
from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.hybrid_scorer import HybridScorer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# Yardımcı: Tek bir deney çalıştır
# ═════════════════════════════════════════════════════════════════════════════

def run_experiment(
    train_df: pd.DataFrame,
    name: str,
    ae_epochs: int = 50,
) -> dict:
    """Tek bir model setini eğit, iç metriklerle döndür."""
    logger.info("━" * 50)
    logger.info("EĞİTİM: %s (%d satır)", name, len(train_df))
    logger.info("━" * 50)

    t0 = time.time()

    fe = FeatureEngineer()
    X, y, feature_names = fe.fit_transform(train_df)

    X_tr, X_val, y_tr, y_val = train_test_split(
        X, y, test_size=0.15, random_state=RANDOM_STATE, stratify=y,
    )
    X_normal = X_tr[y_tr == 0]

    logger.info("[%s] Features: %d | Train normal: %d | Val: %d",
                name, X.shape[1], len(X_normal), len(X_val))

    # IF
    if_model = IsolationForestModel()
    if_model.train(X_normal)

    # AE
    ae_model = AutoencoderModel(input_dim=X.shape[1], epochs=ae_epochs)
    ae_model.train(X_normal)

    elapsed = time.time() - t0

    return {
        "name": name,
        "if_model": if_model,
        "ae_model": ae_model,
        "feature_engineer": fe,
        "scorer": HybridScorer(if_model, ae_model),
        "n_train": len(train_df),
        "n_features": X.shape[1],
        "attack_ratio": float(y.mean()),
        "train_time": elapsed,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Yardımcı: Bir modeli belirli test seti üzerinde değerlendir
# ═════════════════════════════════════════════════════════════════════════════

def evaluate_on_test(
    experiment: dict,
    test_df: pd.DataFrame,
    test_name: str,
) -> dict:
    """Eğitilmiş modeli verilen test setinde değerlendir."""
    fe: FeatureEngineer = experiment["feature_engineer"]
    scorer: HybridScorer = experiment["scorer"]

    # Test verisini bu deneyin feature space'ine dönüştür
    try:
        X_test = fe.transform(test_df)
    except Exception:
        # Eksik feature varsa 0 ile doldur
        from pipeline.feature_engineer import add_derived_features
        test_aug = add_derived_features(test_df.copy())
        for f in fe.feature_names:
            if f not in test_aug.columns:
                test_aug[f] = 0.0
        X_test = test_aug[fe.feature_names].values.astype(np.float32)
        X_test = np.nan_to_num(X_test, nan=0.0, posinf=0.0, neginf=0.0)
        X_test = fe.scaler.transform(X_test)

    y_test = test_df["is_attack"].values.astype(np.int32)

    # Skorla
    results = scorer.score_batch(X_test)
    hybrid = results["hybrid_scores"]

    # Optimal threshold bul (F1 maximize)
    best_f1, best_thresh = 0, 50
    for t in range(0, 101, 1):
        preds = (hybrid >= t).astype(int)
        f = f1_score(y_test, preds, zero_division=0)
        if f > best_f1:
            best_f1 = f
            best_thresh = t

    y_pred = (hybrid >= best_thresh).astype(int)

    metrics = {
        "model": experiment["name"],
        "test_set": test_name,
        "n_test": len(y_test),
        "threshold": best_thresh,
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": best_f1,
        "auc_roc": roc_auc_score(y_test, hybrid),
        "avg_precision": average_precision_score(y_test, hybrid),
        "normal_mean": float(hybrid[y_test == 0].mean()),
        "attack_mean": float(hybrid[y_test == 1].mean()),
        "separation": float(hybrid[y_test == 1].mean() - hybrid[y_test == 0].mean()),
    }

    # IF ve AE ayrı AUC
    metrics["if_auc"] = roc_auc_score(y_test, results["if_scores"])
    metrics["ae_auc"] = roc_auc_score(y_test, results["ae_scores"])

    return metrics


# ═════════════════════════════════════════════════════════════════════════════
# Ana benchmark
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ATTDAP 3-Way Benchmark")
    parser.add_argument("--max-rows", type=int, default=None,
                        help="Kaynak başına max satır (hızlı test için)")
    parser.add_argument("--ae-epochs", type=int, default=50,
                        help="Autoencoder epoch sayısı")
    args = parser.parse_args()

    total_start = time.time()

    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║          ATTDAP 3-Way Model Benchmark                      ║")
    print("║    CICIDS-only  vs  UNSW-only  vs  Combined                ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()

    # ─── 1. Veri yükleme ─────────────────────────────────────────────────
    logger.info("Veri setleri yükleniyor...")

    cicids_full = load_cicids2017(max_rows=args.max_rows)
    unsw_full = load_unsw_nb15(max_rows=args.max_rows)

    if cicids_full.empty or unsw_full.empty:
        print("[HATA] Her iki veri seti de gerekli!")
        print("  python -m data.download_datasets çalıştırın.")
        return

    print(f"  CICIDS2017 : {len(cicids_full):>10,} satır  |  "
          f"attack: {cicids_full['is_attack'].mean():.1%}")
    print(f"  UNSW-NB15  : {len(unsw_full):>10,} satır  |  "
          f"attack: {unsw_full['is_attack'].mean():.1%}")

    # ─── 2. Train/Test split (her dataset'ten) ──────────────────────────
    # Her datasetten %80 train, %20 test ayır. Sonra test'leri birleştir.
    cicids_train, cicids_test = train_test_split(
        cicids_full, test_size=TEST_SIZE, random_state=RANDOM_STATE,
        stratify=cicids_full["is_attack"],
    )
    unsw_train, unsw_test = train_test_split(
        unsw_full, test_size=TEST_SIZE, random_state=RANDOM_STATE,
        stratify=unsw_full["is_attack"],
    )

    combined_train = pd.concat([cicids_train, unsw_train], ignore_index=True).fillna(0)
    combined_test = pd.concat([cicids_test, unsw_test], ignore_index=True).fillna(0)

    print(f"\n  Train splits:")
    print(f"    CICIDS train : {len(cicids_train):>10,}")
    print(f"    UNSW train   : {len(unsw_train):>10,}")
    print(f"    Combined     : {len(combined_train):>10,}")
    print(f"  Test splits:")
    print(f"    CICIDS test  : {len(cicids_test):>10,}")
    print(f"    UNSW test    : {len(unsw_test):>10,}")
    print(f"    Combined     : {len(combined_test):>10,}")

    # ─── 3. Üç modeli eğit ──────────────────────────────────────────────
    experiments = []

    exp_cicids = run_experiment(cicids_train, "CICIDS-only", ae_epochs=args.ae_epochs)
    experiments.append(exp_cicids)

    exp_unsw = run_experiment(unsw_train, "UNSW-only", ae_epochs=args.ae_epochs)
    experiments.append(exp_unsw)

    exp_combined = run_experiment(combined_train, "Combined", ae_epochs=args.ae_epochs)
    experiments.append(exp_combined)

    # ─── 4. Tüm test setlerinde değerlendir ────────────────────────────
    test_sets = {
        "CICIDS-test": cicids_test,
        "UNSW-test": unsw_test,
        "Combined-test": combined_test,
    }

    all_metrics = []
    for exp in experiments:
        for test_name, test_df in test_sets.items():
            logger.info("Değerlendirme: %s → %s", exp["name"], test_name)
            m = evaluate_on_test(exp, test_df, test_name)
            all_metrics.append(m)

    # ─── 5. Sonuç tabloları ─────────────────────────────────────────────
    results_df = pd.DataFrame(all_metrics)

    # ── Tablo 1: Ana Metrikler (Combined test üzerinde) ──
    print("\n")
    print("=" * 80)
    print("  TABLO 1: Combined Test Seti Üzerinde Karşılaştırma")
    print("=" * 80)

    main_results = results_df[results_df["test_set"] == "Combined-test"].copy()
    main_results = main_results.sort_values("f1", ascending=False)

    print(f"\n  {'Model':<15} {'Prec':>8} {'Recall':>8} {'F1':>8} "
          f"{'AUC-ROC':>9} {'AvgPrec':>9} {'IF-AUC':>8} {'AE-AUC':>8} {'Thresh':>7}")
    print("  " + "─" * 85)
    for _, r in main_results.iterrows():
        print(f"  {r['model']:<15} {r['precision']:>8.4f} {r['recall']:>8.4f} "
              f"{r['f1']:>8.4f} {r['auc_roc']:>9.4f} {r['avg_precision']:>9.4f} "
              f"{r['if_auc']:>8.4f} {r['ae_auc']:>8.4f} {r['threshold']:>7}")

    # ── Tablo 2: Cross-Dataset Generalizasyon ──
    print("\n")
    print("=" * 80)
    print("  TABLO 2: Cross-Dataset Generalizasyon (F1 / AUC-ROC)")
    print("  Satır = eğitim kaynağı, Sütun = test seti")
    print("=" * 80)

    models = ["CICIDS-only", "UNSW-only", "Combined"]
    tests = ["CICIDS-test", "UNSW-test", "Combined-test"]

    print(f"\n  {'Eğitim \\ Test':<15}", end="")
    for t in tests:
        print(f" {t:>20}", end="")
    print()
    print("  " + "─" * 78)

    for model in models:
        print(f"  {model:<15}", end="")
        for test in tests:
            row = results_df[(results_df["model"] == model) & (results_df["test_set"] == test)]
            if not row.empty:
                r = row.iloc[0]
                print(f"  F1={r['f1']:.3f} AUC={r['auc_roc']:.3f}", end="")
            else:
                print(f"  {'N/A':>20}", end="")
        print()

    # ── Tablo 3: Skor Dağılımları ──
    print("\n")
    print("=" * 80)
    print("  TABLO 3: Skor Dağılımları (Combined Test)")
    print("=" * 80)

    print(f"\n  {'Model':<15} {'Normal Ort':>12} {'Saldırı Ort':>13} {'Ayrışma':>10}")
    print("  " + "─" * 52)
    for _, r in main_results.iterrows():
        print(f"  {r['model']:<15} {r['normal_mean']:>12.2f} {r['attack_mean']:>13.2f} "
              f"{r['separation']:>10.2f}")

    # ── Tablo 4: Eğitim Bilgileri ──
    print("\n")
    print("=" * 80)
    print("  TABLO 4: Eğitim Bilgileri")
    print("=" * 80)

    print(f"\n  {'Model':<15} {'Eğitim Satır':>14} {'Feature':>9} "
          f"{'Attack %':>10} {'Süre (s)':>10}")
    print("  " + "─" * 60)
    for exp in experiments:
        print(f"  {exp['name']:<15} {exp['n_train']:>14,} {exp['n_features']:>9} "
              f"{exp['attack_ratio']:>9.1%} {exp['train_time']:>10.1f}")

    # ── En iyi model ──
    print("\n")
    print("=" * 80)
    best = main_results.iloc[0]
    print(f"  🏆 EN İYİ MODEL: {best['model']}")
    print(f"     F1={best['f1']:.4f}  AUC-ROC={best['auc_roc']:.4f}  "
          f"Precision={best['precision']:.4f}  Recall={best['recall']:.4f}")

    # Cross-dataset en iyi
    combined_cross = results_df[results_df["model"] == "Combined"]
    if not combined_cross.empty:
        min_f1 = combined_cross["f1"].min()
        max_f1 = combined_cross["f1"].max()
        print(f"\n  Combined modelin cross-dataset F1 aralığı: {min_f1:.4f} - {max_f1:.4f}")

    # ── Kazananı kaydet ──
    winner = best["model"]
    winner_exp = next(e for e in experiments if e["name"] == winner)
    winner_exp["if_model"].save(str(MODELS_SAVED_DIR / "isolation_forest.pkl"))
    winner_exp["ae_model"].save(str(MODELS_SAVED_DIR / "autoencoder.pt"))
    winner_exp["feature_engineer"].save()
    print(f"\n  Kazanan model ({winner}) production olarak kaydedildi.")

    total_elapsed = time.time() - total_start
    print(f"\n  Toplam benchmark süresi: {total_elapsed:.1f} saniye")
    print("=" * 80)

    # CSV export
    csv_path = MODELS_SAVED_DIR / "benchmark_results.csv"
    results_df.to_csv(csv_path, index=False)
    print(f"\n  Detaylı sonuçlar: {csv_path}")

    return results_df


if __name__ == "__main__":
    main()
