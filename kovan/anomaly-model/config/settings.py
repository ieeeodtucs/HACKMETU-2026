"""ATTDAP Anomaly Detection Module - Configuration."""

import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_RAW_DIR = BASE_DIR / "data" / "raw"
DATA_PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_SAVED_DIR = BASE_DIR / "models" / "saved"

# Ensure directories exist
DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
MODELS_SAVED_DIR.mkdir(parents=True, exist_ok=True)

# ─── Database ─────────────────────────────────────────────────────────────────
DB_HOST = os.getenv("ATTDAP_DB_HOST", "localhost")
DB_PORT = int(os.getenv("ATTDAP_DB_PORT", "5432"))
DB_NAME = os.getenv("ATTDAP_DB_NAME", "attdap_anomaly")
DB_USER = os.getenv("ATTDAP_DB_USER", "attdap")
DB_PASSWORD = os.getenv("ATTDAP_DB_PASSWORD", "attdap_secret")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
ASYNC_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

DB_MIN_CONNECTIONS = int(os.getenv("ATTDAP_DB_MIN_CONN", "5"))
DB_MAX_CONNECTIONS = int(os.getenv("ATTDAP_DB_MAX_CONN", "20"))


# ─── Common Features (26 features shared between CICIDS2017 and UNSW-NB15) ──
COMMON_FEATURES = [
    "flow_duration", "total_fwd_packets", "total_bwd_packets",
    "fwd_packet_length_mean", "bwd_packet_length_mean",
    "flow_bytes_per_sec", "flow_packets_per_sec",
    "fwd_iat_mean", "bwd_iat_mean", "active_mean",
    "syn_flag_count", "rst_flag_count",
    "psh_flag_count", "ack_flag_count",
    "fwd_header_length", "bwd_header_length",
    "avg_fwd_segment_size", "avg_bwd_segment_size",
    "bwd_packets_per_sec", "down_up_ratio", "avg_packet_size",
    "init_win_bytes_forward", "init_win_bytes_backward",
    "subflow_fwd_packets", "subflow_fwd_bytes",
    "subflow_bwd_packets",
]

# ─── Isolation Forest ────────────────────────────────────────────────────────
IF_N_ESTIMATORS = int(os.getenv("ATTDAP_IF_ESTIMATORS", "1000"))
IF_CONTAMINATION = float(os.getenv("ATTDAP_IF_CONTAMINATION", "0.02"))
IF_MAX_SAMPLES = "auto"  # 256 samples per tree (much faster, similar accuracy)
IF_RANDOM_STATE = 42
IF_MODEL_PATH = MODELS_SAVED_DIR / "isolation_forest.pkl"

# ─── Autoencoder (Denoising AE: 26→48→24→12) ────────────────────────────────
AE_ENCODER_DIMS = [48, 24]
AE_LATENT_DIM = 12
AE_NOISE_FACTOR = 0.2
AE_LEARNING_RATE = float(os.getenv("ATTDAP_AE_LR", "5e-4"))
AE_EPOCHS = int(os.getenv("ATTDAP_AE_EPOCHS", "150"))
AE_BATCH_SIZE = int(os.getenv("ATTDAP_AE_BATCH_SIZE", "256"))
AE_MODEL_PATH = MODELS_SAVED_DIR / "autoencoder.pt"

# ─── GMM (Gaussian Mixture Model) ───────────────────────────────────────────
GMM_N_COMPONENTS = 12
GMM_COVARIANCE_TYPE = "full"
GMM_REG_COVAR = 1e-4
GMM_MODEL_PATH = MODELS_SAVED_DIR / "gmm_model.pkl"

# ─── Hybrid Scorer (3-model ensemble: IF + AE + GMM) ────────────────────────
# For ss-derived data, IF is the only model that differentiates connections.
# AE/GMM produce near-constant scores for OOD inputs (ss ≠ CICIDS flow data).
HYBRID_IF_WEIGHT = float(os.getenv("ATTDAP_HYBRID_IF_WEIGHT", "1.00"))
HYBRID_AE_WEIGHT = float(os.getenv("ATTDAP_HYBRID_AE_WEIGHT", "0.00"))
HYBRID_GMM_WEIGHT = float(os.getenv("ATTDAP_HYBRID_GMM_WEIGHT", "0.00"))
ANOMALY_THRESHOLD = int(os.getenv("ATTDAP_ANOMALY_THRESHOLD", "27"))

# Risk thresholds (0-100 scale)
# IF-only scoring produces 70-100 range for ss-derived data.
# Calibrated: normal SSH ~71, web ~85, C2 ~91, SYN flood ~100
THRESHOLD_LOW = 75
THRESHOLD_MEDIUM = 82
THRESHOLD_HIGH = 90

# ─── Feature Engineering ─────────────────────────────────────────────────────
FEATURE_SCALER_PATH = MODELS_SAVED_DIR / "feature_scaler.pkl"
SELECTED_FEATURES_PATH = MODELS_SAVED_DIR / "selected_features.json"
BEST_CONFIG_PATH = MODELS_SAVED_DIR / "best_config.json"

# Train/test split
TEST_SIZE = 0.2
RANDOM_STATE = 42

# ─── API ──────────────────────────────────────────────────────────────────────
API_HOST = os.getenv("ATTDAP_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("ATTDAP_API_PORT", "8000"))
API_WORKERS = int(os.getenv("ATTDAP_API_WORKERS", "1"))
