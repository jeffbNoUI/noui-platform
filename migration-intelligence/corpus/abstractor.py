"""Feature abstraction layer — extracts statistical features, discards all identifiers."""

from dataclasses import dataclass

from .anonymizer import categorize_data_type, quantize_cardinality, quantize_null_rate
from .store import AnalystDecision


@dataclass
class CorpusEntry:
    """Statistical features only — NO identifying information."""

    decision_type: str
    outcome: str
    concept_tag: str
    # Statistical features (quantized by anonymizer)
    null_rate_bucket: float  # quantized to nearest 0.05
    cardinality_bucket: str  # LOW, MEDIUM, HIGH, UNIQUE
    data_type_category: str  # TEXT, NUMERIC, DATE, BOOLEAN, OTHER
    # Pattern features
    name_similarity_bucket: float  # quantized to nearest 0.1
    # NO tenant_id, NO source_table, NO source_column, NO canonical names


class FeatureAbstractor:
    """Extracts ONLY statistical features from analyst decisions.

    Discards ALL identifying information:
    - No tenant_id
    - No source table/column names
    - No canonical table/column names
    - No engagement_id
    - No sample values
    """

    def abstract(self, decision: AnalystDecision) -> CorpusEntry:
        """Extract statistical features from a decision, discarding all identifiers."""
        profile = decision.column_profile
        null_rate = profile.get("null_rate", 0.0)
        cardinality = profile.get("cardinality", 0)
        row_count = profile.get("row_count", 1)
        data_type = profile.get("data_type", "unknown")

        return CorpusEntry(
            decision_type=decision.decision_type,
            outcome=decision.outcome,
            concept_tag=decision.concept_tag,
            null_rate_bucket=quantize_null_rate(null_rate),
            cardinality_bucket=quantize_cardinality(cardinality, row_count),
            data_type_category=categorize_data_type(data_type),
            name_similarity_bucket=0.0,  # Placeholder — would be computed from scoring signals
        )
