"""Tests for decision store and feature abstraction."""

import dataclasses

import pytest
from corpus.abstractor import CorpusEntry, FeatureAbstractor
from corpus.store import AnalystDecision, DecisionStore


def _make_decision(
    tenant_id: str = "tenant-a",
    engagement_id: str = "eng-001",
    decision_type: str = "MAPPING_APPROVED",
    source_table: str = "PRISM_SAL_HIST",
    source_column: str = "SAL_AMT",
    canonical_table: str = "salary_history",
    canonical_column: str = "salary_amount",
    concept_tag: str = "salary-history",
    outcome: str = "APPROVED",
    column_profile: dict | None = None,
) -> AnalystDecision:
    if column_profile is None:
        column_profile = {
            "null_rate": 0.03,
            "cardinality": 450,
            "row_count": 500,
            "data_type": "decimal(10,2)",
        }
    return AnalystDecision(
        tenant_id=tenant_id,
        engagement_id=engagement_id,
        decision_type=decision_type,
        source_table=source_table,
        source_column=source_column,
        canonical_table=canonical_table,
        canonical_column=canonical_column,
        concept_tag=concept_tag,
        column_profile=column_profile,
        outcome=outcome,
    )


class TestDecisionStoreIsolation:
    """test_decision_store_isolation — cross-tenant isolation."""

    def test_tenant_isolation(self):
        store = DecisionStore()
        store.record_decision(_make_decision(tenant_id="tenant-a"))
        store.record_decision(_make_decision(tenant_id="tenant-a"))
        store.record_decision(_make_decision(tenant_id="tenant-b"))

        a_decisions = store.get_decisions("tenant-a")
        b_decisions = store.get_decisions("tenant-b")

        assert len(a_decisions) == 2
        assert len(b_decisions) == 1
        assert all(d.tenant_id == "tenant-a" for d in a_decisions)
        assert all(d.tenant_id == "tenant-b" for d in b_decisions)

    def test_unknown_tenant_returns_empty(self):
        store = DecisionStore()
        store.record_decision(_make_decision(tenant_id="tenant-a"))
        assert store.get_decisions("tenant-x") == []


class TestDecisionStoreCount:
    """test_decision_store_count"""

    def test_count(self):
        store = DecisionStore()
        for i in range(5):
            store.record_decision(_make_decision(tenant_id=f"t-{i % 2}"))
        assert store.count() == 5

    def test_empty_count(self):
        store = DecisionStore()
        assert store.count() == 0


class TestDecisionStoreConcepts:
    """test_decision_store_concepts"""

    def test_concepts_covered(self):
        store = DecisionStore()
        store.record_decision(_make_decision(concept_tag="salary-history"))
        store.record_decision(_make_decision(concept_tag="employee-master"))
        store.record_decision(_make_decision(concept_tag="salary-history"))  # duplicate

        concepts = store.concepts_covered()
        assert concepts == ["employee-master", "salary-history"]  # sorted

    def test_empty_concepts(self):
        store = DecisionStore()
        assert store.concepts_covered() == []


class TestAbstractionRemovesIdentifiers:
    """test_abstraction_removes_identifiers"""

    def test_no_identifying_info_in_corpus_entry(self):
        decision = _make_decision(
            tenant_id="client-abc",
            engagement_id="eng-secret-123",
            source_table="PRISM_SAL_HIST",
            source_column="SAL_AMT",
            canonical_table="salary_history",
            canonical_column="salary_amount",
        )
        abstractor = FeatureAbstractor()
        entry = abstractor.abstract(decision)

        # Serialize all field values to strings for checking
        all_values = []
        for f in dataclasses.fields(entry):
            all_values.append(str(getattr(entry, f.name)))
        combined = " ".join(all_values)

        assert "client-abc" not in combined
        assert "PRISM" not in combined
        assert "SAL_AMT" not in combined
        assert "salary_amount" not in combined
        assert "salary_history" not in combined
        assert "eng-secret-123" not in combined


class TestAbstractionPreservesStatistics:
    """test_abstraction_preserves_statistics"""

    def test_statistics_are_quantized(self):
        decision = _make_decision(
            column_profile={
                "null_rate": 0.03,
                "cardinality": 450,
                "row_count": 500,
                "data_type": "decimal(10,2)",
            }
        )
        abstractor = FeatureAbstractor()
        entry = abstractor.abstract(decision)

        assert entry.null_rate_bucket == 0.05  # 0.03 quantized to nearest 0.05
        assert entry.cardinality_bucket == "HIGH"  # 450/500 = 0.9 -> HIGH
        assert entry.data_type_category == "NUMERIC"  # decimal -> NUMERIC


class TestCorpusEntryHasNoTenantField:
    """test_corpus_entry_has_no_tenant_field"""

    def test_no_tenant_id_field(self):
        field_names = {f.name for f in dataclasses.fields(CorpusEntry)}
        assert "tenant_id" not in field_names
        assert "engagement_id" not in field_names
        assert "source_table" not in field_names
        assert "source_column" not in field_names
        assert "canonical_table" not in field_names
        assert "canonical_column" not in field_names
