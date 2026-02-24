"""
Download CICIDS2017 and UNSW-NB15 datasets.

Usage:
    python -m data.download_datasets            # Tüm kaynaklar
    python -m data.download_datasets --kaggle   # Sadece Kaggle
    python -m data.download_datasets --synthetic # Sadece sentetik

Kaynak önceliği:
    1. UNB direkt sunucu (CICIDS2017) + HuggingFace (UNSW-NB15)  → auth gerektirmez
    2. Kaggle API (her ikisi)                                      → kaggle token gerekir
    3. Sentetik veri (her zaman fallback)
"""

import os
import sys
import subprocess
import zipfile
import glob as globmod
import requests
from pathlib import Path
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.settings import DATA_RAW_DIR


# ─── CICIDS2017: UNB Direkt Sunucu (IP tabanlı, auth yok) ──────────────────
CICIDS2017_BASE = "http://205.174.165.80/CICDataset/CIC-IDS-2017/Dataset/MachineLearningCSV/"
CICIDS2017_ZIP = "MachineLearningCVE.zip"

# ─── UNSW-NB15: HuggingFace (auth yok, direkt indirilebilir) ────────────────
UNSW_HF_BASE = (
    "https://huggingface.co/datasets/wwydmanski/UNSW-NB15/resolve/main/"
)
UNSW_HF_FILES = [
    "UNSW_NB15_training-set.csv",
    "UNSW_NB15_testing-set.csv",
]

# ─── Kaggle dataset slug'ları (fallback) ─────────────────────────────────────
KAGGLE_CICIDS = "dhoogla/cicids2017"
KAGGLE_UNSW = "mrwellsdavid/unsw-nb15"


# ═════════════════════════════════════════════════════════════════════════════
# Yardımcı fonksiyonlar
# ═════════════════════════════════════════════════════════════════════════════

def download_file(url: str, dest: Path, chunk_size: int = 8192, timeout: int = 120) -> bool:
    """Dosyayı progress bar ile indir. Başarılıysa True döner."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] Zaten mevcut: {dest.name}")
        return True

    print(f"  [download] {dest.name} ← {url[:80]}...")
    try:
        resp = requests.get(url, stream=True, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))

        with open(dest, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc=dest.name
        ) as pbar:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                f.write(chunk)
                pbar.update(len(chunk))

        if dest.stat().st_size == 0:
            dest.unlink()
            return False
        return True
    except Exception as e:
        print(f"  [error] {dest.name}: {e}")
        if dest.exists():
            dest.unlink()
        return False


def kaggle_available() -> bool:
    """Kaggle CLI kurulu ve yapılandırılmış mı?"""
    try:
        result = subprocess.run(
            ["kaggle", "--version"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return False
        # Token var mı?
        token_path = Path.home() / ".kaggle" / "kaggle.json"
        return token_path.exists()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def kaggle_download(dataset_slug: str, dest_dir: Path) -> bool:
    """Kaggle CLI ile veri seti indir ve zip'i aç."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    print(f"  [kaggle] {dataset_slug} → {dest_dir}")
    try:
        result = subprocess.run(
            ["kaggle", "datasets", "download", "-d", dataset_slug, "-p", str(dest_dir), "--unzip"],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            print(f"  [error] Kaggle hatası: {result.stderr.strip()}")
            return False
        csv_count = len(list(dest_dir.glob("*.csv")))
        print(f"  [ok] {csv_count} CSV dosyası indirildi")
        return csv_count > 0
    except Exception as e:
        print(f"  [error] Kaggle indirme başarısız: {e}")
        return False


# ═════════════════════════════════════════════════════════════════════════════
# CICIDS2017
# ═════════════════════════════════════════════════════════════════════════════

def download_cicids2017_direct() -> bool:
    """UNB direkt sunucudan CICIDS2017 ZIP indir ve aç."""
    print("\n=== CICIDS2017 - UNB Direkt Sunucu ===")
    dest_dir = DATA_RAW_DIR / "cicids2017"
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Zaten CSV'ler varsa atla
    existing = list(dest_dir.glob("*.csv"))
    if len(existing) >= 8:
        print(f"  [skip] {len(existing)} CSV zaten mevcut")
        return True

    zip_path = dest_dir / CICIDS2017_ZIP
    url = CICIDS2017_BASE + CICIDS2017_ZIP

    if not download_file(url, zip_path, timeout=300):
        return False

    # ZIP aç
    print("  [unzip] Açılıyor...")
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(dest_dir)
        zip_path.unlink()

        # Bazı zip'ler alt klasöre açar, CSV'leri üst dizine taşı
        for csv in dest_dir.rglob("*.csv"):
            if csv.parent != dest_dir:
                target = dest_dir / csv.name
                if not target.exists():
                    csv.rename(target)

        csv_count = len(list(dest_dir.glob("*.csv")))
        print(f"  [ok] CICIDS2017: {csv_count} CSV dosyası hazır")
        return csv_count > 0
    except zipfile.BadZipFile:
        print("  [error] Geçersiz ZIP dosyası")
        if zip_path.exists():
            zip_path.unlink()
        return False


def download_cicids2017_kaggle() -> bool:
    """Kaggle'dan CICIDS2017 indir."""
    print("\n=== CICIDS2017 - Kaggle ===")
    dest_dir = DATA_RAW_DIR / "cicids2017"
    return kaggle_download(KAGGLE_CICIDS, dest_dir)


def download_cicids2017() -> bool:
    """CICIDS2017'yi en uygun kaynaktan indir."""
    # Yöntem 1: UNB direkt sunucu
    if download_cicids2017_direct():
        return True

    # Yöntem 2: Kaggle (token varsa)
    if kaggle_available():
        print("  UNB sunucusu başarısız, Kaggle deneniyor...")
        if download_cicids2017_kaggle():
            return True

    print("  [!] CICIDS2017 indirilemedi.")
    print("      Manuel indirme: https://www.kaggle.com/datasets/dhoogla/cicids2017")
    print("      Veya: http://205.174.165.80/CICDataset/CIC-IDS-2017/Dataset/")
    return False


# ═════════════════════════════════════════════════════════════════════════════
# UNSW-NB15
# ═════════════════════════════════════════════════════════════════════════════

def download_unsw_nb15_huggingface() -> bool:
    """HuggingFace'ten UNSW-NB15 training/testing setlerini indir."""
    print("\n=== UNSW-NB15 - HuggingFace ===")
    dest_dir = DATA_RAW_DIR / "unsw_nb15"
    dest_dir.mkdir(parents=True, exist_ok=True)

    existing = list(dest_dir.glob("*.csv"))
    if len(existing) >= 2:
        print(f"  [skip] {len(existing)} CSV zaten mevcut")
        return True

    success = 0
    for filename in UNSW_HF_FILES:
        url = UNSW_HF_BASE + filename
        if download_file(url, dest_dir / filename, timeout=180):
            success += 1

    if success == len(UNSW_HF_FILES):
        print(f"  [ok] UNSW-NB15: {success} CSV dosyası hazır")
        return True

    # HuggingFace bazen parquet formatında tutuyor, onu da deneyelim
    print("  CSV bulunamadı, Parquet deniyor...")
    try:
        import pandas as pd

        parquet_files = [
            "train-00000-of-00001.parquet",
            "test-00000-of-00001.parquet",
        ]
        pq_base = "https://huggingface.co/datasets/wwydmanski/UNSW-NB15/resolve/main/data/"

        for pq_file, csv_name in zip(parquet_files, UNSW_HF_FILES):
            pq_path = dest_dir / pq_file
            url = pq_base + pq_file
            if download_file(url, pq_path, timeout=180):
                df = pd.read_parquet(pq_path)
                csv_path = dest_dir / csv_name
                df.to_csv(csv_path, index=False)
                pq_path.unlink()
                print(f"  [ok] {csv_name} ({len(df)} satır)")
                success += 1

        return success >= 2
    except ImportError:
        print("  [error] Parquet okumak için pyarrow/fastparquet gerekli")
        return False
    except Exception as e:
        print(f"  [error] Parquet dönüştürme hatası: {e}")
        return False


def download_unsw_nb15_kaggle() -> bool:
    """Kaggle'dan UNSW-NB15 indir."""
    print("\n=== UNSW-NB15 - Kaggle ===")
    dest_dir = DATA_RAW_DIR / "unsw_nb15"
    return kaggle_download(KAGGLE_UNSW, dest_dir)


def download_unsw_nb15() -> bool:
    """UNSW-NB15'i en uygun kaynaktan indir."""
    # Yöntem 1: HuggingFace (auth yok)
    if download_unsw_nb15_huggingface():
        return True

    # Yöntem 2: Kaggle (token varsa)
    if kaggle_available():
        print("  HuggingFace başarısız, Kaggle deneniyor...")
        if download_unsw_nb15_kaggle():
            return True

    print("  [!] UNSW-NB15 indirilemedi.")
    print("      Manuel indirme: https://www.kaggle.com/datasets/mrwellsdavid/unsw-nb15")
    print("      Veya: https://huggingface.co/datasets/wwydmanski/UNSW-NB15")
    return False


# ═════════════════════════════════════════════════════════════════════════════
# Sentetik Veri
# ═════════════════════════════════════════════════════════════════════════════

def generate_synthetic_data():
    """Geliştirme/test için sentetik veri üret."""
    import numpy as np
    import pandas as pd

    print("\n=== Sentetik Veri Üretimi ===")
    np.random.seed(42)
    n_normal = 10000
    n_attack = 1000

    feature_names = [
        "flow_duration", "total_fwd_packets", "total_bwd_packets",
        "fwd_packet_length_mean", "bwd_packet_length_mean",
        "flow_bytes_per_sec", "flow_packets_per_sec",
        "fwd_iat_mean", "bwd_iat_mean", "active_mean", "idle_mean",
        "syn_flag_count", "fin_flag_count", "rst_flag_count",
        "psh_flag_count", "ack_flag_count",
        "fwd_psh_flags", "bwd_psh_flags", "fwd_urg_flags", "bwd_urg_flags",
        "fwd_header_length", "bwd_header_length",
        "fwd_packets_per_sec", "bwd_packets_per_sec",
        "min_packet_length", "max_packet_length",
        "packet_length_mean", "packet_length_std", "packet_length_variance",
        "down_up_ratio", "avg_packet_size", "avg_fwd_segment_size",
        "avg_bwd_segment_size", "init_win_bytes_forward", "init_win_bytes_backward",
        "act_data_pkt_fwd", "min_seg_size_forward",
        "subflow_fwd_packets", "subflow_fwd_bytes",
        "subflow_bwd_packets", "subflow_bwd_bytes",
        "fwd_act_data_pkts", "fwd_seg_size_min",
        "flow_iat_mean", "flow_iat_std", "flow_iat_max", "flow_iat_min",
    ]

    # Normal trafik
    normal_data = np.random.randn(n_normal, len(feature_names)) * 0.5 + 2.0
    normal_data = np.abs(normal_data)

    # Saldırı trafiği — kaydırılmış dağılım, yüksek varyans
    attack_data = np.random.randn(n_attack, len(feature_names)) * 2.0 + 5.0
    attack_data = np.abs(attack_data)
    attack_data[:, 0] *= 3    # flow_duration
    attack_data[:, 5] *= 5    # flow_bytes_per_sec
    attack_data[:, 11] *= 4   # syn_flag_count

    data = np.vstack([normal_data, attack_data])
    labels = ["BENIGN"] * n_normal + ["ATTACK"] * n_attack

    df = pd.DataFrame(data, columns=feature_names)
    df["label"] = labels
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    out_path = DATA_RAW_DIR / "synthetic_dataset.csv"
    df.to_csv(out_path, index=False)
    print(f"  [ok] {out_path.name} ({len(df)} satır, {len(feature_names)} özellik)")
    return True


# ═════════════════════════════════════════════════════════════════════════════
# Ana giriş noktası
# ═════════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    parser = argparse.ArgumentParser(description="ATTDAP Veri Seti İndirici")
    parser.add_argument("--kaggle", action="store_true", help="Sadece Kaggle'dan indir")
    parser.add_argument("--synthetic", action="store_true", help="Sadece sentetik veri üret")
    args = parser.parse_args()

    print("ATTDAP Veri Seti İndirici")
    print("=" * 60)

    if kaggle_available():
        print("[info] Kaggle CLI: yapılandırılmış ✓")
    else:
        print("[info] Kaggle CLI: yapılandırılmamış (opsiyonel)")
        print("       Kurmak için: pip install kaggle && kaggle.json ekle")

    # Her zaman sentetik veri üret (fallback)
    generate_synthetic_data()

    if args.synthetic:
        print("\nSadece sentetik veri üretildi.")
        return

    # Gerçek veri setlerini indir
    results = {}

    if args.kaggle:
        if not kaggle_available():
            print("\n[error] Kaggle CLI yapılandırılmamış!")
            print("  1. pip install kaggle")
            print("  2. https://www.kaggle.com/settings → 'Create New Token'")
            print("  3. ~/.kaggle/kaggle.json olarak kaydet")
            return
        results["CICIDS2017"] = download_cicids2017_kaggle()
        results["UNSW-NB15"] = download_unsw_nb15_kaggle()
    else:
        results["CICIDS2017"] = download_cicids2017()
        results["UNSW-NB15"] = download_unsw_nb15()

    # Özet
    print("\n" + "=" * 60)
    print("ÖZET:")
    for name, ok in results.items():
        status = "✓ İndirildi" if ok else "✗ Başarısız (sentetik veri kullanılacak)"
        print(f"  {name}: {status}")

    # Mevcut dosyaları listele
    print("\nMevcut veri dosyaları:")
    for p in sorted(DATA_RAW_DIR.rglob("*.csv")):
        size_mb = p.stat().st_size / (1024 * 1024)
        print(f"  {p.relative_to(DATA_RAW_DIR)} ({size_mb:.1f} MB)")
    print()


if __name__ == "__main__":
    main()
