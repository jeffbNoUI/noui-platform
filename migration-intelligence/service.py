import os
from decimal import Decimal
from fastapi import FastAPI
from pydantic import BaseModel
from scorer.signal import CANONICAL_COLUMNS, score_column
from reconciliation.analysis import ReconciliationResult, detect_systematic_patterns
from reconciliation.corrections import FieldMapping, suggest_corrections
from corpus.store import AnalystDecision, DecisionStore
from corpus.abstractor import FeatureAbstractor

app = FastAPI(title="Migration Intelligence Service", version="0.1.0")

# Module-level corpus instances
_decision_store = DecisionStore()
_feature_abstractor = FeatureAbstractor()

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

class MappingInput(BaseModel):
    source_field: str
    canonical_field: str
    domain: str
    transform_type: str = "DIRECT"

class AnalyzeMismatchesRequest(BaseModel):
    tenant_id: str
    reconciliation_results: list[dict]
    field_mappings: list[MappingInput] = []

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
    canonical = CANONICAL_COLUMNS.get(request.concept_tag, {})
    if not canonical:
        return ScoreColumnsResponse(mappings=[])

    mappings: list[ScoredMapping] = []

    for col in request.columns:
        candidates: list[tuple[float, str, dict[str, float]]] = []

        for canon_name, canon_info in canonical.items():
            conf, signals = score_column(
                source_name=col.column_name,
                source_type=col.data_type,
                null_rate=col.null_rate,
                cardinality=col.cardinality,
                row_count=col.row_count,
                canonical_column=canon_name,
                canonical_info=canon_info,
            )
            if conf > 0.3:
                candidates.append((conf, canon_name, signals))

        # Sort by score descending, take top 3
        candidates.sort(key=lambda x: x[0], reverse=True)
        for conf, canon_name, signals in candidates[:3]:
            mappings.append(ScoredMapping(
                source_column=col.column_name,
                canonical_column=canon_name,
                confidence=round(conf, 4),
                signals={k: round(v, 4) for k, v in signals.items()},
            ))

    return ScoreColumnsResponse(mappings=mappings)

@app.post("/intelligence/record-decision")
async def record_decision(request: RecordDecisionRequest):
    """Record an analyst decision, extract features to shared corpus."""
    decision = AnalystDecision(
        tenant_id=request.tenant_id,
        engagement_id=request.engagement_id,
        decision_type=request.decision_type,
        source_table="",  # Not provided in request; would come from full context
        source_column=request.source_column,
        canonical_table="",  # Not provided in request
        canonical_column=request.canonical_column,
        concept_tag=request.concept_tag,
        column_profile={
            "null_rate": request.column_profile.null_rate,
            "cardinality": request.column_profile.cardinality,
            "row_count": request.column_profile.row_count,
            "data_type": request.column_profile.data_type,
        },
        outcome=request.outcome,
    )
    _decision_store.record_decision(decision)
    # Verify abstraction works (strips identifiers)
    _feature_abstractor.abstract(decision)
    return {"status": "recorded", "corpus_entry_created": True}

@app.post("/intelligence/analyze-mismatches", response_model=AnalyzeMismatchesResponse)
async def analyze_mismatches(request: AnalyzeMismatchesRequest) -> AnalyzeMismatchesResponse:
    """Detect systematic patterns in reconciliation results and suggest corrections."""
    # Parse reconciliation results into domain objects
    recon_results: list[ReconciliationResult] = []
    for r in request.reconciliation_results:
        recon_results.append(
            ReconciliationResult(
                member_id=r.get("member_id", ""),
                variance_amount=Decimal(str(r.get("variance_amount", "0"))),
                variance_pct=float(r.get("variance_pct", 0.0)),
                suspected_domain=r.get("suspected_domain", ""),
                member_status=r.get("member_status", ""),
                plan_code=r.get("plan_code", ""),
                category=r.get("category", "MATCH"),
            )
        )

    # Detect patterns
    patterns = detect_systematic_patterns(recon_results)

    # Build field mappings from request
    mappings = [
        FieldMapping(
            source_field=m.source_field,
            canonical_field=m.canonical_field,
            domain=m.domain,
            transform_type=m.transform_type,
        )
        for m in request.field_mappings
    ]

    # Suggest corrections if patterns found
    suggestions = suggest_corrections(patterns, mappings) if patterns else []

    return AnalyzeMismatchesResponse(
        patterns=[
            {
                "pattern_id": p.pattern_id,
                "suspected_domain": p.suspected_domain,
                "plan_code": p.plan_code,
                "direction": p.direction,
                "member_count": p.member_count,
                "mean_variance": str(p.mean_variance),
                "cv": p.cv,
                "affected_members": p.affected_members,
            }
            for p in patterns
        ],
        suggestions=[
            CorrectionSuggestion(
                correction_type=s.correction_type,
                affected_field=s.affected_field,
                current_mapping=s.current_mapping,
                proposed_mapping=s.proposed_mapping,
                confidence=s.confidence,
                evidence=s.evidence,
                affected_member_count=s.affected_member_count,
            )
            for s in suggestions
        ],
    )

@app.get("/intelligence/corpus-stats", response_model=CorpusStats)
async def corpus_stats() -> CorpusStats:
    """Return shared corpus health metrics (no tenant data)."""
    return CorpusStats(
        total_entries=_decision_store.count(),
        concepts_covered=_decision_store.concepts_covered(),
        avg_confidence=0.0,  # Placeholder — would be computed from corpus entries
    )
