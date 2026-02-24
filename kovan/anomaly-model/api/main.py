"""
ATTDAP Anomaly Detection API - FastAPI Application.

3-model ensemble: Isolation Forest + Denoising Autoencoder + GMM.

Usage:
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.isolation_forest import IsolationForestModel
from models.autoencoder import AutoencoderModel
from models.gmm_model import GMMModel
from models.hybrid_scorer import HybridScorer
from pipeline.feature_engineer import FeatureEngineer
from api.routes import score, batch_score, health, model_info

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Global model instances
if_model: IsolationForestModel | None = None
ae_model: AutoencoderModel | None = None
gmm_model: GMMModel | None = None
scorer: HybridScorer | None = None
feature_engineer: FeatureEngineer | None = None
models_loaded = False


def load_models() -> bool:
    """Load trained models from disk."""
    global if_model, ae_model, gmm_model, scorer, feature_engineer, models_loaded

    try:
        feature_engineer = FeatureEngineer()
        feature_engineer.load()
        logger.info("Feature engineer loaded (%d features)", feature_engineer.n_features)

        if_model = IsolationForestModel()
        if_model.load()
        logger.info("Isolation Forest loaded")

        ae_model = AutoencoderModel(input_dim=feature_engineer.n_features)
        ae_model.load()
        logger.info("Denoising Autoencoder loaded")

        gmm_model = GMMModel()
        gmm_model.load()
        logger.info("GMM loaded")

        scorer = HybridScorer(if_model, ae_model, gmm_model)
        logger.info("Hybrid scorer initialized (IF+AE+GMM)")

        models_loaded = True
        return True

    except FileNotFoundError as e:
        logger.warning("Models not found: %s. Run 'python -m pipeline.train' first.", e)
        models_loaded = False
        return False
    except Exception as e:
        logger.error("Failed to load models: %s", e)
        models_loaded = False
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ATTDAP Anomaly Detection API...")
    load_models()
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="ATTDAP Anomaly Detection API",
    description="ML-based network anomaly detection using "
                "Isolation Forest + Denoising Autoencoder + GMM hybrid scoring.",
    version="2.0.0",
    lifespan=lifespan,
)

app.include_router(health.router, tags=["Health"])
app.include_router(score.router, tags=["Scoring"])
app.include_router(batch_score.router, tags=["Scoring"])
app.include_router(model_info.router, tags=["Model Info"])
