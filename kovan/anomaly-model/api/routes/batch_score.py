"""POST /batch-score - Score multiple security events at once."""

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from api.schemas import BatchScoreRequest, BatchScoreResponse, AnomalyScore

router = APIRouter()

META_FIELDS = {"source_ip", "dest_ip", "source_port", "dest_port", "protocol"}


@router.post("/batch-score", response_model=BatchScoreResponse)
async def batch_score_events(request: BatchScoreRequest):
    """Score a batch of network flow events. Max 10000 per request."""
    from api.main import scorer, feature_engineer, models_loaded

    if not models_loaded or scorer is None or feature_engineer is None:
        raise HTTPException(status_code=503, detail="Models not loaded.")
    if not request.events:
        raise HTTPException(status_code=400, detail="No events provided")
    if len(request.events) > 10000:
        raise HTTPException(status_code=400, detail="Maximum 10000 events per batch")

    feature_dicts = [e.model_dump(exclude=META_FIELDS) for e in request.events]
    df = pd.DataFrame(feature_dicts)
    X = feature_engineer.transform(df)
    results = scorer.score_batch(X)

    scores = []
    for i in range(len(request.events)):
        scores.append(AnomalyScore(
            if_score=float(results["if_scores"][i]),
            ae_score=float(results["ae_scores"][i]),
            gmm_score=float(results["gmm_scores"][i]),
            hybrid_score=float(results["hybrid_scores"][i]),
            risk_level=results["risk_levels"][i],
            feature_contributions={},
        ))

    hybrid_scores = results["hybrid_scores"]
    risk_counts = {}
    for level in results["risk_levels"]:
        risk_counts[level] = risk_counts.get(level, 0) + 1

    summary = {
        "total_events": len(request.events),
        "mean_score": float(np.mean(hybrid_scores)),
        "max_score": float(np.max(hybrid_scores)),
        "min_score": float(np.min(hybrid_scores)),
        "risk_distribution": risk_counts,
    }

    return BatchScoreResponse(scores=scores, summary=summary)
