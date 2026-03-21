import os
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Migration Intelligence Service", version="0.1.0")

# --- Request/Response Models ---

class ColumnProfile(BaseModel):
    column_name: str
    data_type: str
    null_rate: float
    cardinality: int
    row_count: int = 0
    sample_values: list[str] = []  # Used for scoring only, NEVER stored in corpus

class ScoreColumnsRequest(BaseModel):
    columns: list[ColumnProfile]
    concept_tag: str
    canonical_table: str
    tenant_id: str

class ScoredMapping(BaseModel):
    source_column: str
    canonical_column: str
    confidence: float
    signals: dict[str, float]  # signal_name -> individual score

class ScoreColumnsResponse(BaseModel):
    mappings: list[ScoredMapping]

class RecordDecisionRequest(BaseModel):
    tenant_id: str
    engagement_id: str
    decision_type: str  # MAPPING_APPROVED, MAPPING_REJECTED, etc.
    source_column: str
    canonical_column: str
    concept_tag: str
    column_profile: ColumnProfile
    outcome: str  # APPROVED or REJECTED

class AnalyzeMismatchesRequest(BaseModel):
    tenant_id: str
    reconciliation_results: list[dict]

class CorrectionSuggestion(BaseModel):
    correction_type: str
    affected_field: str
    current_mapping: str
    proposed_mapping: str
    confidence: float
    evidence: str
    affected_member_count: int

class AnalyzeMismatchesResponse(BaseModel):
    patterns: list[dict]
    suggestions: list[CorrectionSuggestion]

class CorpusStats(BaseModel):
    total_entries: int
    concepts_covered: list[str]
    avg_confidence: float

# --- Endpoints ---

@app.get("/healthz")
async def health():
    return {"status": "ok", "service": "migration-intelligence", "version": "0.1.0"}

@app.post("/intelligence/score-columns", response_model=ScoreColumnsResponse)
async def score_columns(request: ScoreColumnsRequest) -> ScoreColumnsResponse:
    """Score source columns against canonical columns using multiple signals."""
    # Stub - returns empty mappings until Task 8 implements the scorer
    return ScoreColumnsResponse(mappings=[])

@app.post("/intelligence/record-decision")
async def record_decision(request: RecordDecisionRequest):
    """Record an analyst decision, extract features to shared corpus."""
    # Stub - until Task 24 implements corpus
    return {"status": "recorded"}

@app.post("/intelligence/analyze-mismatches", response_model=AnalyzeMismatchesResponse)
async def analyze_mismatches(request: AnalyzeMismatchesRequest) -> AnalyzeMismatchesResponse:
    """Detect systematic patterns in reconciliation results."""
    # Stub - until Task 23 implements analysis
    return AnalyzeMismatchesResponse(patterns=[], suggestions=[])

@app.get("/intelligence/corpus-stats", response_model=CorpusStats)
async def corpus_stats() -> CorpusStats:
    """Return shared corpus health metrics (no tenant data)."""
    # Stub - until Task 24 implements corpus
    return CorpusStats(total_entries=0, concepts_covered=[], avg_confidence=0.0)
