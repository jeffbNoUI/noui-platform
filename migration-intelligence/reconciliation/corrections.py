"""Correction suggestions based on detected systematic patterns."""

from dataclasses import dataclass
from reconciliation.analysis import Pattern


@dataclass
class FieldMapping:
    source_field: str
    canonical_field: str
    domain: str  # matches suspected_domain
    transform_type: str  # "DIRECT", "LOOKUP", "FORMULA"


@dataclass
class Correction:
    pattern_id: str
    correction_type: str  # "MAPPING_FIX", "TRANSFORM_FIX", "DATA_FIX"
    affected_field: str
    current_mapping: str
    proposed_mapping: str  # empty if can't determine
    confidence: float  # 0.0-1.0
    evidence: str
    affected_member_count: int


def _compute_confidence(pattern: Pattern) -> float:
    """Compute confidence score based on member count and CV."""
    # Base confidence from member count: more members = higher confidence
    # 5 members -> 0.5, 10 -> 0.65, 20 -> 0.75, 50+ -> 0.85
    count_factor = min(0.85, 0.4 + 0.01 * pattern.member_count)

    # CV bonus: lower CV means tighter cluster = higher confidence
    # CV=0 -> +0.15, CV=0.15 -> +0.075, CV=0.3 -> 0
    cv_bonus = max(0.0, 0.15 * (1.0 - pattern.cv / 0.3))

    return round(min(1.0, count_factor + cv_bonus), 2)


def _build_evidence(pattern: Pattern) -> str:
    """Build a human-readable evidence string."""
    sign = "+" if pattern.direction == "positive" else "-"
    return (
        f"{pattern.member_count} members in {pattern.plan_code} show "
        f"{sign}{pattern.mean_variance} {pattern.suspected_domain} variance, "
        f"CV={pattern.cv}"
    )


def suggest_corrections(
    patterns: list[Pattern],
    mappings: list[FieldMapping],
) -> list[Correction]:
    """
    For each systematic pattern, identify the likely mapping error.
    Correlate pattern's suspected_domain with mapping fields in that domain.
    """
    # Index mappings by domain
    mappings_by_domain: dict[str, list[FieldMapping]] = {}
    for m in mappings:
        mappings_by_domain.setdefault(m.domain, []).append(m)

    corrections: list[Correction] = []

    for pattern in patterns:
        domain_mappings = mappings_by_domain.get(pattern.suspected_domain, [])
        confidence = _compute_confidence(pattern)
        evidence = _build_evidence(pattern)

        if not domain_mappings:
            # No mappings for this domain -- still produce a suggestion
            corrections.append(
                Correction(
                    pattern_id=pattern.pattern_id,
                    correction_type="DATA_FIX",
                    affected_field=pattern.suspected_domain,
                    current_mapping="",
                    proposed_mapping="",
                    confidence=round(confidence * 0.7, 2),  # lower confidence without mapping info
                    evidence=evidence,
                    affected_member_count=pattern.member_count,
                )
            )
            continue

        # Determine correction type based on CV
        if pattern.cv > 0.1:
            correction_type = "DATA_FIX"
        else:
            correction_type = "MAPPING_FIX"

        # Suggest corrections for each mapping in the domain
        for mapping in domain_mappings:
            corrections.append(
                Correction(
                    pattern_id=pattern.pattern_id,
                    correction_type=correction_type,
                    affected_field=mapping.canonical_field,
                    current_mapping=mapping.source_field,
                    proposed_mapping="",  # would require deeper analysis to suggest specific fix
                    confidence=confidence,
                    evidence=evidence,
                    affected_member_count=pattern.member_count,
                )
            )

    return corrections
