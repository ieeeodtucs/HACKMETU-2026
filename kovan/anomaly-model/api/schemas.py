"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field


class SecurityEvent(BaseModel):
    """A single network flow event to be scored for anomaly detection."""

    # 26 common features (CICIDS2017 + UNSW-NB15 shared)
    flow_duration: float = Field(0.0, description="Flow duration")
    total_fwd_packets: float = Field(0.0, description="Total forward packets")
    total_bwd_packets: float = Field(0.0, description="Total backward packets")
    fwd_packet_length_mean: float = Field(0.0, description="Mean forward packet length")
    bwd_packet_length_mean: float = Field(0.0, description="Mean backward packet length")
    flow_bytes_per_sec: float = Field(0.0, description="Flow bytes per second")
    flow_packets_per_sec: float = Field(0.0, description="Flow packets per second")
    fwd_iat_mean: float = Field(0.0, description="Forward inter-arrival time mean")
    bwd_iat_mean: float = Field(0.0, description="Backward inter-arrival time mean")
    active_mean: float = Field(0.0, description="Active mean")
    syn_flag_count: float = Field(0.0, description="SYN flag count")
    rst_flag_count: float = Field(0.0, description="RST flag count")
    psh_flag_count: float = Field(0.0, description="PSH flag count")
    ack_flag_count: float = Field(0.0, description="ACK flag count")
    fwd_header_length: float = Field(0.0, description="Forward header length")
    bwd_header_length: float = Field(0.0, description="Backward header length")
    avg_fwd_segment_size: float = Field(0.0, description="Average forward segment size")
    avg_bwd_segment_size: float = Field(0.0, description="Average backward segment size")
    bwd_packets_per_sec: float = Field(0.0, description="Backward packets per second")
    down_up_ratio: float = Field(0.0, description="Download/upload ratio")
    avg_packet_size: float = Field(0.0, description="Average packet size")
    init_win_bytes_forward: float = Field(0.0, description="Initial TCP window size (forward)")
    init_win_bytes_backward: float = Field(0.0, description="Initial TCP window size (backward)")
    subflow_fwd_packets: float = Field(0.0, description="Subflow forward packets")
    subflow_fwd_bytes: float = Field(0.0, description="Subflow forward bytes")
    subflow_bwd_packets: float = Field(0.0, description="Subflow backward packets")

    # Optional metadata (not used for scoring)
    source_ip: str | None = Field(None, description="Source IP address")
    dest_ip: str | None = Field(None, description="Destination IP address")
    source_port: int | None = Field(None, description="Source port")
    dest_port: int | None = Field(None, description="Destination port")
    protocol: int | None = Field(None, description="Protocol number")

    model_config = {"json_schema_extra": {
        "examples": [{
            "flow_duration": 120000.0,
            "total_fwd_packets": 10.0,
            "total_bwd_packets": 8.0,
            "flow_bytes_per_sec": 5000.0,
            "syn_flag_count": 1.0,
            "source_ip": "192.168.1.100",
            "dest_ip": "10.0.0.1",
        }]
    }}


class AnomalyScore(BaseModel):
    """Anomaly score response for a single event."""
    if_score: float = Field(description="Isolation Forest score [0-1]")
    ae_score: float = Field(description="Autoencoder reconstruction error score [0-1]")
    gmm_score: float = Field(description="GMM density score [0-1]")
    hybrid_score: float = Field(description="Combined risk score [0-100]")
    risk_level: str = Field(description="Risk classification: low/medium/high/critical")
    feature_contributions: dict[str, float] = Field(
        default_factory=dict,
        description="Top contributing features to the anomaly score",
    )


class BatchScoreRequest(BaseModel):
    events: list[SecurityEvent] = Field(description="List of security events to score")


class BatchScoreResponse(BaseModel):
    scores: list[AnomalyScore] = Field(description="Anomaly scores for each event")
    summary: dict = Field(description="Summary statistics for the batch")


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    version: str


class ModelInfoResponse(BaseModel):
    isolation_forest: dict
    autoencoder: dict
    gmm: dict
    hybrid_scorer: dict
    feature_count: int
    feature_names: list[str]
