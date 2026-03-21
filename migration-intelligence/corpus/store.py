"""Tenant-isolated decision storage for the shared corpus."""

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class AnalystDecision:
    """A recorded analyst decision with full context (tenant-scoped)."""

    tenant_id: str
    engagement_id: str
    decision_type: str  # MAPPING_APPROVED, MAPPING_REJECTED, CORRECTION_APPLIED, etc.
    source_table: str
    source_column: str
    canonical_table: str
    canonical_column: str
    concept_tag: str
    column_profile: dict  # null_rate, cardinality, data_type, etc.
    outcome: str  # APPROVED, REJECTED
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class DecisionStore:
    """In-memory tenant-isolated decision store.
    In production this would be backed by PostgreSQL with RLS."""

    def __init__(self) -> None:
        self._decisions: dict[str, list[AnalystDecision]] = {}  # tenant_id -> decisions

    def record_decision(self, decision: AnalystDecision) -> None:
        """Store a decision in the tenant-isolated store."""
        self._decisions.setdefault(decision.tenant_id, []).append(decision)

    def get_decisions(self, tenant_id: str) -> list[AnalystDecision]:
        """Get all decisions for a specific tenant. Never returns cross-tenant data."""
        return list(self._decisions.get(tenant_id, []))

    def get_all_decisions(self) -> list[AnalystDecision]:
        """Get all decisions across all tenants. Used only for corpus building."""
        return [d for decisions in self._decisions.values() for d in decisions]

    def count(self) -> int:
        """Total decision count."""
        return sum(len(v) for v in self._decisions.values())

    def concepts_covered(self) -> list[str]:
        """Return unique concept tags across all decisions."""
        concepts: set[str] = set()
        for decisions in self._decisions.values():
            for d in decisions:
                concepts.add(d.concept_tag)
        return sorted(concepts)
