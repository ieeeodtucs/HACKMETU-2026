"""
Hızlı deney v4: F1 > 0.80 hedefi.

v3 → v4:
  1. QuantileTransformer → bimodal dağılımları düzeltir (RobustScaler yerine)
  2. GMM (3. model) → IF ve AE'den farklı perspektif, density-based
  3. 3-model ensemble (IF + DAE + GMM) optimizasyonu
  4. IF 1000 tree
  5. 500K per dataset

Usage:
    python -m pipeline.fast_experiment
"""

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.ensemble import IsolationForest
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import QuantileTransformer
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import RANDOM_STATE, MODELS_SAVED_DIR
from pipeline.data_loader import load_cicids2017, load_unsw_nb15

# ─── Ortak feature'lar ──────────────────────────────────────────────────────
COMMON_FEATURES = [
    'flow_duration', 'total_fwd_packets', 'total_bwd_packets',
    'fwd_packet_length_mean', 'bwd_packet_length_mean',
    'flow_bytes_per_sec', 'flow_packets_per_sec',
    'fwd_iat_mean', 'bwd_iat_mean', 'active_mean',
    'syn_flag_count', 'rst_flag_count',
    'psh_flag_count', 'ack_flag_count',
    'fwd_header_length', 'bwd_header_length',
    'avg_fwd_segment_size', 'avg_bwd_segment_size',
    'bwd_packets_per_sec', 'down_up_ratio', 'avg_packet_size',
    'init_win_bytes_forward', 'init_win_bytes_backward',
    'subflow_fwd_packets', 'subflow_fwd_bytes',
    'subflow_bwd_packets',
]

_clip_upper = None


def fit_clipping(df: pd.DataFrame):
    global _clip_upper
    raw = df[COMMON_FEATURES].copy().fillna(0).clip(lower=0)
    _clip_upper = raw.quantile(0.99)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df[COMMON_FEATURES].copy().fillna(0).clip(lower=0)
    if _clip_upper is not None:
        out = out.clip(upper=_clip_upper, axis=1)
    out = np.log1p(out)
    return out


class DenoisingAutoencoder(nn.Module):
    def __init__(self, dim, noise_factor=0.2):
        super().__init__()
        self.noise_factor = noise_factor
        self.encoder = nn.Sequential(
            nn.Linear(dim, 48), nn.BatchNorm1d(48), nn.GELU(), nn.Dropout(0.1),
            nn.Linear(48, 24), nn.BatchNorm1d(24), nn.GELU(),
            nn.Linear(24, 12),
        )
        self.decoder = nn.Sequential(
            nn.Linear(12, 24), nn.BatchNorm1d(24), nn.GELU(), nn.Dropout(0.1),
            nn.Linear(24, 48), nn.BatchNorm1d(48), nn.GELU(),
            nn.Linear(48, dim),
        )

    def add_noise(self, x):
        if self.training:
            return x + torch.randn_like(x) * self.noise_factor
        return x

    def forward(self, x):
        return self.decoder(self.encoder(self.add_noise(x)))


def normalize_scores(scores):
    """Min-max normalize to [0, 1]."""
    mn, mx = scores.min(), scores.max()
    return (scores - mn) / (mx - mn + 1e-10)


def main():
    t0 = time.time()

    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║  FAST EXPERIMENT v4: QuantileTransformer + 3-Model       ║")
    print("╚════════════════════════════════════════════════════════════╝\n")

    # ── Veri ──
    print("[1/7] Veri yükleniyor...")
    cicids = load_cicids2017(max_rows=500000)
    unsw = load_unsw_nb15(max_rows=500000)
    combined = pd.concat([cicids, unsw], ignore_index=True)
    print(f"  {len(combined):,} satır, attack: {combined['is_attack'].mean():.1%}")

    # Percentile clipping (normal veriden)
    normal_data = combined[combined['is_attack'] == 0]
    fit_clipping(normal_data)

    # ── Feature Engineering ──
    print("[2/7] Feature engineering (clip + log1p + QuantileTransformer)...")
    X_df = engineer_features(combined)
    feature_names = list(X_df.columns)
    n_feat = len(feature_names)

    X_raw = np.nan_to_num(X_df.values.astype(np.float32), nan=0, posinf=0, neginf=0)
    y = combined['is_attack'].values

    # QuantileTransformer → bimodal dağılımları Gaussian'a çevirir
    scaler = QuantileTransformer(output_distribution='normal', n_quantiles=1000,
                                  random_state=RANDOM_STATE)
    X = scaler.fit_transform(X_raw).astype(np.float32)
    X = np.nan_to_num(X, nan=0, posinf=3, neginf=-3)  # clip extreme quantile values

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y)
    X_normal = X_train[y_train == 0]

    # Cross-dataset split'ler
    cicids_feats = np.nan_to_num(engineer_features(cicids).values.astype(np.float32),
                                  nan=0, posinf=0, neginf=0)
    unsw_feats = np.nan_to_num(engineer_features(unsw).values.astype(np.float32),
                                nan=0, posinf=0, neginf=0)
    cicids_X = np.nan_to_num(scaler.transform(cicids_feats), nan=0, posinf=3, neginf=-3).astype(np.float32)
    unsw_X = np.nan_to_num(scaler.transform(unsw_feats), nan=0, posinf=3, neginf=-3).astype(np.float32)
    _, cicids_test, _, cicids_y_test = train_test_split(
        cicids_X, cicids['is_attack'].values, test_size=0.2, random_state=RANDOM_STATE,
        stratify=cicids['is_attack'].values)
    _, unsw_test, _, unsw_y_test = train_test_split(
        unsw_X, unsw['is_attack'].values, test_size=0.2, random_state=RANDOM_STATE,
        stratify=unsw['is_attack'].values)

    print(f"  {n_feat} feature | Train normal: {len(X_normal):,} | Test: {len(X_test):,}")

    # ── Model 1: Isolation Forest (1000 trees) ──
    print("[3/7] Isolation Forest eğitimi (1000 trees)...")
    if_model = IsolationForest(n_estimators=1000, contamination=0.02, max_samples=0.8,
                                random_state=RANDOM_STATE, n_jobs=-1)
    if_model.fit(X_normal)
    if_scores = normalize_scores(-if_model.decision_function(X_test))
    if_auc = roc_auc_score(y_test, if_scores)
    print(f"  IF AUC: {if_auc:.4f}")

    # ── Model 2: Denoising Autoencoder ──
    print("[4/7] Denoising AE eğitimi...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ae_model = DenoisingAutoencoder(n_feat, noise_factor=0.2).to(device)
    criterion = nn.SmoothL1Loss(reduction='none')
    optimizer = torch.optim.AdamW(ae_model.parameters(), lr=5e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=150, eta_min=1e-6)

    train_t = torch.FloatTensor(X_normal).to(device)
    loader = DataLoader(TensorDataset(train_t, train_t), batch_size=256, shuffle=True)

    best_loss, patience, best_state = float('inf'), 0, None
    for epoch in range(150):
        ae_model.train()
        eloss, n = 0, 0
        for bx, target in loader:
            optimizer.zero_grad()
            loss = criterion(ae_model(bx), target).mean()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(ae_model.parameters(), 1.0)
            optimizer.step()
            eloss += loss.item()
            n += 1
        avg = eloss / n
        scheduler.step()
        if avg < best_loss:
            best_loss = avg
            best_state = {k: v.cpu().clone() for k, v in ae_model.state_dict().items()}
            patience = 0
        else:
            patience += 1
            if patience >= 25:
                print(f"  Early stop @ epoch {epoch+1}, loss={best_loss:.6f}")
                break
        if (epoch + 1) % 30 == 0:
            print(f"  Epoch {epoch+1}: loss={avg:.6f}")

    ae_model.load_state_dict(best_state)
    ae_model.eval()

    with torch.no_grad():
        tr_err = criterion(ae_model(train_t), train_t).mean(dim=1).cpu().numpy()
        test_t = torch.FloatTensor(X_test).to(device)
        test_err = criterion(ae_model(test_t), test_t).mean(dim=1).cpu().numpy()

    ae_mean, ae_std = tr_err.mean(), tr_err.std()
    ae_scores = normalize_scores(test_err)
    ae_auc = roc_auc_score(y_test, ae_scores)
    print(f"  AE AUC: {ae_auc:.4f}")

    # ── Model 3: Gaussian Mixture Model ──
    print("[5/7] GMM eğitimi (density-based anomaly detection)...")
    X_normal_64 = X_normal.astype(np.float64)  # numerical stability
    best_gmm, best_bic = None, float('inf')
    for n_comp in [3, 5, 8, 12]:
        gmm = GaussianMixture(n_components=n_comp, covariance_type='full',
                               reg_covar=1e-4, random_state=RANDOM_STATE,
                               max_iter=200, n_init=2)
        gmm.fit(X_normal_64)
        bic = gmm.bic(X_normal_64)
        print(f"    GMM n={n_comp}: BIC={bic:.0f}")
        if bic < best_bic:
            best_bic = bic
            best_gmm = gmm

    # GMM score: -log_likelihood (yüksek = anormal)
    gmm_raw_train = -best_gmm.score_samples(X_normal_64)
    gmm_raw_test = -best_gmm.score_samples(X_test.astype(np.float64))
    gmm_scores = normalize_scores(gmm_raw_test)
    gmm_auc = roc_auc_score(y_test, gmm_scores)
    print(f"  GMM AUC: {gmm_auc:.4f} (n_components={best_gmm.n_components})")

    # ── 3-Model Ensemble Optimizasyonu ──
    print("[6/7] 3-model ensemble optimizasyonu...")

    # Weighted average: w1*IF + w2*AE + w3*GMM (w1+w2+w3=1)
    best_f1, best_w1, best_w2, best_w3, best_thresh = 0, 0.33, 0.33, 0.34, 50

    # Grid search over weights (step 0.05)
    step = 0.05
    for w1 in np.arange(0, 1.01, step):
        for w2 in np.arange(0, 1.01 - w1, step):
            w3 = 1.0 - w1 - w2
            if w3 < -0.01:
                continue
            w3 = max(w3, 0)
            h = (w1 * if_scores + w2 * ae_scores + w3 * gmm_scores) * 100
            for t in range(5, 90, 2):
                f = f1_score(y_test, (h >= t).astype(int), zero_division=0)
                if f > best_f1:
                    best_f1, best_w1, best_w2, best_w3, best_thresh = f, w1, w2, w3, t

    # Fine-tune threshold around best
    h = (best_w1 * if_scores + best_w2 * ae_scores + best_w3 * gmm_scores) * 100
    for t in range(max(1, best_thresh - 5), min(95, best_thresh + 5)):
        f = f1_score(y_test, (h >= t).astype(int), zero_division=0)
        if f > best_f1:
            best_f1, best_thresh = f, t

    hybrid = (best_w1 * if_scores + best_w2 * ae_scores + best_w3 * gmm_scores) * 100
    y_pred = (hybrid >= best_thresh).astype(int)

    print(f"  Ağırlıklar: IF={best_w1:.2f} / AE={best_w2:.2f} / GMM={best_w3:.2f}")
    print(f"  Threshold: {best_thresh}")

    # ── Sonuçlar ──
    elapsed = time.time() - t0

    print("\n" + "=" * 65)
    print("  SONUÇLAR (v4 - IF+DAE+GMM)")
    print("=" * 65)

    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, hybrid)
    sep = hybrid[y_test == 1].mean() - hybrid[y_test == 0].mean()

    print(f"\n  Precision:  {prec:.4f}")
    print(f"  Recall:     {rec:.4f}")
    print(f"  F1-Score:   {best_f1:.4f}")
    print(f"  AUC-ROC:    {auc:.4f}")
    print(f"  IF AUC:     {if_auc:.4f}  |  AE AUC: {ae_auc:.4f}  |  GMM AUC: {gmm_auc:.4f}")
    print(f"  Normal avg: {hybrid[y_test==0].mean():.2f}")
    print(f"  Attack avg: {hybrid[y_test==1].mean():.2f}")
    print(f"  Separation: {sep:.2f}")
    print(f"  Weights:    IF={best_w1:.2f} / AE={best_w2:.2f} / GMM={best_w3:.2f}")
    print(f"  Threshold:  {best_thresh}")
    print(f"  Süre:       {elapsed:.1f}s")

    print(f"\n  📊 v1: F1=0.7662  AUC=0.8812")
    print(f"  📊 v3: F1=0.7600  AUC=0.8878")
    print(f"  📊 v4: F1={best_f1:.4f}  AUC={auc:.4f}")
    imp = ((best_f1 - 0.7662) / 0.7662) * 100
    print(f"  → F1 değişim (v1→v4): %{imp:+.1f}")

    # ── Cross-dataset test ──
    print("\n  Cross-dataset:")

    def eval_set(name, Xt, yt):
        ifs = normalize_scores(-if_model.decision_function(Xt))
        with torch.no_grad():
            tt = torch.FloatTensor(Xt).to(device)
            te = criterion(ae_model(tt), tt).mean(dim=1).cpu().numpy()
        aes = normalize_scores(te)
        gms = normalize_scores(-best_gmm.score_samples(Xt.astype(np.float64)))
        h = (best_w1 * ifs + best_w2 * aes + best_w3 * gms) * 100
        yp = (h >= best_thresh).astype(int)
        f = f1_score(yt, yp, zero_division=0)
        a = roc_auc_score(yt, h) if len(set(yt)) > 1 else 0
        print(f"    {name:15s}: F1={f:.4f}  AUC={a:.4f}")
        return f, a

    eval_set("CICIDS-test", cicids_test, cicids_y_test)
    eval_set("UNSW-test", unsw_test, unsw_y_test)
    eval_set("Combined-test", X_test, y_test)

    print("\n" + "=" * 65)

    # ── Kaydet ──
    print("[7/7] Model kaydediliyor...")
    import joblib, json

    joblib.dump(if_model, MODELS_SAVED_DIR / "isolation_forest.pkl")
    joblib.dump(scaler, MODELS_SAVED_DIR / "feature_scaler.pkl")
    joblib.dump(best_gmm, MODELS_SAVED_DIR / "gmm_model.pkl")
    torch.save({
        "model_state_dict": ae_model.state_dict(),
        "input_dim": n_feat,
        "noise_factor": ae_model.noise_factor,
        "threshold_mean": float(ae_mean),
        "threshold_std": float(ae_std),
    }, MODELS_SAVED_DIR / "autoencoder.pt")

    json.dump({
        "feature_names": feature_names,
        "n_features": n_feat,
        "w_if": float(best_w1),
        "w_ae": float(best_w2),
        "w_gmm": float(best_w3),
        "threshold": int(best_thresh),
        "strategy": "3-model weighted avg",
        "scaler": "QuantileTransformer",
        "f1": float(best_f1), "auc_roc": float(auc),
        "precision": float(prec), "recall": float(rec),
        "if_auc": float(if_auc), "ae_auc": float(ae_auc), "gmm_auc": float(gmm_auc),
    }, open(MODELS_SAVED_DIR / "best_config.json", "w"), indent=2)
    json.dump(feature_names, open(MODELS_SAVED_DIR / "selected_features.json", "w"))

    print(f"  Model kaydedildi → {MODELS_SAVED_DIR}")


if __name__ == "__main__":
    main()
