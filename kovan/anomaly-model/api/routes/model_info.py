"""GET /model-info - Model metadata and metrics."""

import json
from fastapi import APIRouter, HTTPException

from api.schemas import ModelInfoResponse

router = APIRouter()


@router.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get information about the loaded models and their configuration."""
    from api.main import if_model, ae_model, gmm_model, scorer, feature_engineer, models_loaded
    from config.settings import (
        IF_N_ESTIMATORS, IF_CONTAMINATION,
        AE_ENCODER_DIMS, AE_LATENT_DIM, AE_NOISE_FACTOR, AE_EPOCHS,
        GMM_N_COMPONENTS,
        HYBRID_IF_WEIGHT, HYBRID_AE_WEIGHT, HYBRID_GMM_WEIGHT,
        ANOMALY_THRESHOLD, THRESHOLD_LOW, THRESHOLD_MEDIUM, THRESHOLD_HIGH,
        BEST_CONFIG_PATH,
    )

    if not models_loaded or feature_engineer is None:
        raise HTTPException(status_code=503, detail="Models not loaded.")

    # Load best_config for training metrics
    train_metrics = {}
    if BEST_CONFIG_PATH.exists():
        with open(BEST_CONFIG_PATH) as f:
            train_metrics = json.load(f)

    return ModelInfoResponse(
        isolation_forest={
            "n_estimators": IF_N_ESTIMATORS,
            "contamination": IF_CONTAMINATION,
            "fitted": if_model.is_fitted if if_model else False,
            "auc": train_metrics.get("if_auc", 0),
        },
        autoencoder={
            "encoder_dims": AE_ENCODER_DIMS,
            "latent_dim": AE_LATENT_DIM,
            "noise_factor": AE_NOISE_FACTOR,
            "epochs": AE_EPOCHS,
            "fitted": ae_model.is_fitted if ae_model else False,
            "auc": train_metrics.get("ae_auc", 0),
        },
        gmm={
            "n_components": GMM_N_COMPONENTS,
            "fitted": gmm_model.is_fitted if gmm_model else False,
            "auc": train_metrics.get("gmm_auc", 0),
        },
        hybrid_scorer={
            "weights": {"if": HYBRID_IF_WEIGHT, "ae": HYBRID_AE_WEIGHT, "gmm": HYBRID_GMM_WEIGHT},
            "anomaly_threshold": ANOMALY_THRESHOLD,
            "risk_thresholds": {"low": THRESHOLD_LOW, "medium": THRESHOLD_MEDIUM, "high": THRESHOLD_HIGH},
            "f1": train_metrics.get("f1", 0),
            "auc_roc": train_metrics.get("auc_roc", 0),
            "precision": train_metrics.get("precision", 0),
            "recall": train_metrics.get("recall", 0),
        },
        feature_count=feature_engineer.n_features,
        feature_names=feature_engineer.feature_names,
    )
