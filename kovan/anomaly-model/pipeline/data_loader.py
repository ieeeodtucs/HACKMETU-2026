"""
Load CICIDS2017, UNSW-NB15, and synthetic datasets into a unified DataFrame format.

Unified schema columns:
    - All numeric feature columns (45+)
    - 'label': str - 'BENIGN' or attack type
    - 'is_attack': int - 0 for benign, 1 for attack
"""

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from config.settings import DATA_RAW_DIR

logger = logging.getLogger(__name__)

# ─── CICIDS2017 ──────────────────────────────────────────────────────────────

# Common features used from CICIDS2017
CICIDS_FEATURE_MAP = {
    " Flow Duration": "flow_duration",
    " Total Fwd Packets": "total_fwd_packets",
    " Total Backward Packets": "total_bwd_packets",
    " Fwd Packet Length Mean": "fwd_packet_length_mean",
    " Bwd Packet Length Mean": "bwd_packet_length_mean",
    "Flow Bytes/s": "flow_bytes_per_sec",
    " Flow Packets/s": "flow_packets_per_sec",
    " Fwd IAT Mean": "fwd_iat_mean",
    " Bwd IAT Mean": "bwd_iat_mean",
    "Active Mean": "active_mean",
    " Idle Mean": "idle_mean",
    " SYN Flag Count": "syn_flag_count",
    " FIN Flag Count": "fin_flag_count",
    " RST Flag Count": "rst_flag_count",
    " PSH Flag Count": "psh_flag_count",
    " ACK Flag Count": "ack_flag_count",
    "Fwd PSH Flags": "fwd_psh_flags",
    " Bwd PSH Flags": "bwd_psh_flags",
    " Fwd URG Flags": "fwd_urg_flags",
    " Bwd URG Flags": "bwd_urg_flags",
    " Fwd Header Length": "fwd_header_length",
    " Bwd Header Length": "bwd_header_length",
    " Fwd Packets/s": "fwd_packets_per_sec",
    " Bwd Packets/s": "bwd_packets_per_sec",
    " Min Packet Length": "min_packet_length",
    " Max Packet Length": "max_packet_length",
    " Packet Length Mean": "packet_length_mean",
    " Packet Length Std": "packet_length_std",
    " Packet Length Variance": "packet_length_variance",
    " Down/Up Ratio": "down_up_ratio",
    " Average Packet Size": "avg_packet_size",
    " Avg Fwd Segment Size": "avg_fwd_segment_size",
    " Avg Bwd Segment Size": "avg_bwd_segment_size",
    "Init_Win_bytes_forward": "init_win_bytes_forward",
    " Init_Win_bytes_backward": "init_win_bytes_backward",
    " act_data_pkt_fwd": "act_data_pkt_fwd",
    " min_seg_size_forward": "min_seg_size_forward",
    "Subflow Fwd Packets": "subflow_fwd_packets",
    " Subflow Fwd Bytes": "subflow_fwd_bytes",
    " Subflow Bwd Packets": "subflow_bwd_packets",
    " Subflow Bwd Bytes": "subflow_bwd_bytes",
    " Fwd Act Data Pkts": "fwd_act_data_pkts",
    " Fwd Seg Size Min": "fwd_seg_size_min",
    " Flow IAT Mean": "flow_iat_mean",
    " Flow IAT Std": "flow_iat_std",
    " Flow IAT Max": "flow_iat_max",
    " Flow IAT Min": "flow_iat_min",
}


def load_cicids2017(max_rows: int | None = None) -> pd.DataFrame:
    """Load CICIDS2017 CSV files into a unified DataFrame."""
    cicids_dir = DATA_RAW_DIR / "cicids2017"
    if not cicids_dir.exists():
        logger.warning("CICIDS2017 directory not found: %s", cicids_dir)
        return pd.DataFrame()

    csv_files = list(cicids_dir.glob("*.csv"))
    if not csv_files:
        logger.warning("No CSV files found in %s", cicids_dir)
        return pd.DataFrame()

    frames = []
    for f in csv_files:
        logger.info("Loading %s", f.name)
        try:
            df = pd.read_csv(f, encoding="utf-8", low_memory=False)
            frames.append(df)
        except Exception as e:
            logger.error("Failed to load %s: %s", f.name, e)

    if not frames:
        return pd.DataFrame()

    raw = pd.concat(frames, ignore_index=True)
    logger.info("CICIDS2017 raw: %d rows, %d columns", len(raw), len(raw.columns))

    # Rename columns
    rename_map = {k: v for k, v in CICIDS_FEATURE_MAP.items() if k in raw.columns}
    df = raw.rename(columns=rename_map)

    # Handle label column
    label_col = " Label" if " Label" in raw.columns else "Label"
    if label_col in raw.columns:
        df["label"] = raw[label_col].str.strip()
    else:
        df["label"] = "UNKNOWN"

    df["is_attack"] = (df["label"] != "BENIGN").astype(int)
    df["source"] = "cicids2017"

    # Keep only mapped feature columns + meta
    feature_cols = list(rename_map.values())
    keep_cols = feature_cols + ["label", "is_attack", "source"]
    df = df[[c for c in keep_cols if c in df.columns]]

    # Clean numeric columns
    for col in feature_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)

    if max_rows and len(df) > max_rows:
        # Stratified sample: saldırı oranını koru
        from sklearn.model_selection import train_test_split
        keep_ratio = max_rows / len(df)
        df, _ = train_test_split(
            df, train_size=max_rows, random_state=42, stratify=df["is_attack"],
        )
        df = df.reset_index(drop=True)

    logger.info("CICIDS2017 processed: %d rows, %d features", len(df), len(feature_cols))
    return df


# ─── UNSW-NB15 ───────────────────────────────────────────────────────────────

UNSW_FEATURE_MAP = {
    "dur": "flow_duration",
    "spkts": "total_fwd_packets",
    "dpkts": "total_bwd_packets",
    "sbytes": "fwd_packet_length_mean",
    "dbytes": "bwd_packet_length_mean",
    "rate": "flow_bytes_per_sec",
    "sttl": "fwd_iat_mean",
    "dttl": "bwd_iat_mean",
    "sload": "flow_packets_per_sec",
    "dload": "active_mean",
    "sloss": "idle_mean",
    "dloss": "syn_flag_count",
    "sinpkt": "fin_flag_count",
    "dinpkt": "rst_flag_count",
    "sjit": "psh_flag_count",
    "djit": "ack_flag_count",
    "swin": "init_win_bytes_forward",
    "dwin": "init_win_bytes_backward",
    "stcpb": "fwd_header_length",
    "dtcpb": "bwd_header_length",
    "smean": "avg_fwd_segment_size",
    "dmean": "avg_bwd_segment_size",
    "trans_depth": "down_up_ratio",
    "ct_srv_src": "subflow_fwd_packets",
    "ct_srv_dst": "subflow_bwd_packets",
    "ct_dst_ltm": "subflow_fwd_bytes",
    "ct_src_ltm": "subflow_bwd_bytes",
    "ct_src_dport_ltm": "fwd_packets_per_sec",
    "ct_dst_sport_ltm": "bwd_packets_per_sec",
    "ct_dst_src_ltm": "avg_packet_size",
}


def load_unsw_nb15(max_rows: int | None = None) -> pd.DataFrame:
    """Load UNSW-NB15 CSV files into a unified DataFrame."""
    unsw_dir = DATA_RAW_DIR / "unsw_nb15"
    if not unsw_dir.exists():
        logger.warning("UNSW-NB15 directory not found: %s", unsw_dir)
        return pd.DataFrame()

    # Prefer the training/testing split files
    csv_files = list(unsw_dir.glob("*training*.csv")) + list(unsw_dir.glob("*testing*.csv"))
    if not csv_files:
        csv_files = list(unsw_dir.glob("UNSW-NB15_*.csv"))

    if not csv_files:
        logger.warning("No CSV files found in %s", unsw_dir)
        return pd.DataFrame()

    frames = []
    for f in csv_files:
        logger.info("Loading %s", f.name)
        try:
            df = pd.read_csv(f, encoding="utf-8", low_memory=False)
            frames.append(df)
        except Exception as e:
            logger.error("Failed to load %s: %s", f.name, e)

    if not frames:
        return pd.DataFrame()

    raw = pd.concat(frames, ignore_index=True)
    logger.info("UNSW-NB15 raw: %d rows, %d columns", len(raw), len(raw.columns))

    # Rename columns
    rename_map = {k: v for k, v in UNSW_FEATURE_MAP.items() if k in raw.columns}
    df = raw.rename(columns=rename_map)

    # Handle labels - UNSW-NB15 has both 'attack_cat' (str) and 'label' (0/1)
    if "attack_cat" in raw.columns and "label" in raw.columns:
        # Use numeric label as ground truth, attack_cat for category name
        df["is_attack"] = raw["label"].astype(int)
        cat = raw["attack_cat"].fillna("").str.strip()
        df["label"] = cat.where(df["is_attack"] == 1, "BENIGN")
        df["label"] = df["label"].replace({"": "BENIGN", "Normal": "BENIGN"})
    elif "attack_cat" in raw.columns:
        df["label"] = raw["attack_cat"].fillna("Normal").str.strip()
        df["label"] = df["label"].replace({"Normal": "BENIGN", "": "BENIGN"})
        df["is_attack"] = (df["label"] != "BENIGN").astype(int)
    elif "label" in raw.columns:
        df["is_attack"] = raw["label"].astype(int)
        df["label"] = df["is_attack"].apply(lambda x: "BENIGN" if x == 0 else "ATTACK")
    else:
        df["label"] = "UNKNOWN"
        df["is_attack"] = 0
    df["source"] = "unsw_nb15"

    feature_cols = list(rename_map.values())
    keep_cols = feature_cols + ["label", "is_attack", "source"]
    df = df[[c for c in keep_cols if c in df.columns]]

    for col in feature_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)

    if max_rows and len(df) > max_rows:
        from sklearn.model_selection import train_test_split
        df, _ = train_test_split(
            df, train_size=max_rows, random_state=42, stratify=df["is_attack"],
        )
        df = df.reset_index(drop=True)

    logger.info("UNSW-NB15 processed: %d rows, %d features", len(df), len(feature_cols))
    return df


# ─── Synthetic Dataset ───────────────────────────────────────────────────────

def load_synthetic(max_rows: int | None = None) -> pd.DataFrame:
    """Load the synthetic dataset."""
    path = DATA_RAW_DIR / "synthetic_dataset.csv"
    if not path.exists():
        logger.warning("Synthetic dataset not found: %s", path)
        return pd.DataFrame()

    df = pd.read_csv(path)
    df["is_attack"] = (df["label"] != "BENIGN").astype(int)
    df["source"] = "synthetic"

    if max_rows:
        df = df.head(max_rows)

    logger.info("Synthetic dataset: %d rows", len(df))
    return df


# ─── Unified Loader ──────────────────────────────────────────────────────────

def load_all_datasets(max_rows_per_source: int | None = None) -> pd.DataFrame:
    """
    Load all available datasets and combine into a single unified DataFrame.
    Falls back to synthetic data if real datasets are not available.
    """
    frames = []

    # Try real datasets first
    cicids = load_cicids2017(max_rows=max_rows_per_source)
    if not cicids.empty:
        frames.append(cicids)

    unsw = load_unsw_nb15(max_rows=max_rows_per_source)
    if not unsw.empty:
        frames.append(unsw)

    # Fallback to synthetic
    if not frames:
        logger.info("No real datasets found, loading synthetic data")
        synthetic = load_synthetic(max_rows=max_rows_per_source)
        if not synthetic.empty:
            frames.append(synthetic)

    if not frames:
        raise FileNotFoundError(
            "No datasets available. Run 'python -m data.download_datasets' first."
        )

    combined = pd.concat(frames, ignore_index=True)

    # Fill any missing columns with 0
    combined.fillna(0, inplace=True)

    logger.info(
        "Combined dataset: %d rows, %d columns, attack ratio: %.2f%%",
        len(combined),
        len(combined.columns),
        combined["is_attack"].mean() * 100,
    )
    return combined
