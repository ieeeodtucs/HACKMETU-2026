"""POST /score - Score a single security event."""

from fastapi import APIRouter, HTTPException

from api.schemas import SecurityEvent, AnomalyScore

router = APIRouter()

META_FIELDS = {"source_ip", "dest_ip", "source_port", "dest_port", "protocol"}


@router.post("/score", response_model=AnomalyScore)
async def score_event(event: SecurityEvent):
    """Score a single network flow event for anomalous behavior.

    Returns a 0-100 risk score combining Isolation Forest, Autoencoder, and GMM.
    """
    from api.main import scorer, feature_engineer, models_loaded

    if not models_loaded or scorer is None or feature_engineer is None:
        raise HTTPException(status_code=503, detail="Models not loaded.")

    feature_dict = event.model_dump(exclude=META_FIELDS)
    X = feature_engineer.transform_single(feature_dict)
    result = scorer.get_detailed_score(X, feature_names=feature_engineer.feature_names)

    return AnomalyScore(
        if_score=result["if_score"],
        ae_score=result["ae_score"],
        gmm_score=result["gmm_score"],
        hybrid_score=result["hybrid_score"],
        risk_level=result["risk_level"],
        feature_contributions=result["feature_contributions"],
    )
