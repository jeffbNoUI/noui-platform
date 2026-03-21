"""Tests for reconciliation pattern detection and correction suggestions."""

import pytest
from decimal import Decimal

from reconciliation.analysis import (
    ReconciliationResult,
    Pattern,
    detect_systematic_patterns,
)
from reconciliation.corrections import (
    FieldMapping,
    Correction,
    suggest_corrections,
)


# --- Helpers ---

def _make_result(
    member_id: str,
    variance_amount: str,
    variance_pct: float = 1.8,
    suspected_domain: str = "salary",
    plan_code: str = "DB_T2",
    category: str = "MINOR",
    member_status: str = "RETIREE",
) -> ReconciliationResult:
    return ReconciliationResult(
        member_id=member_id,
        variance_amount=Decimal(variance_amount),
        variance_pct=variance_pct,
        suspected_domain=suspected_domain,
        plan_code=plan_code,
        category=category,
        member_status=member_status,
    )


def _make_salary_cluster(
    count: int,
    variance: str = "150.00",
    direction: int = 1,
    plan_code: str = "DB_T2",
) -> list[ReconciliationResult]:
    """Create a tight cluster of salary mismatches."""
    base = Decimal(variance)
    results = []
    for i in range(count):
        # Small jitter to keep CV low but nonzero
        jitter = Decimal(str(i * 0.5))
        amount = (base + jitter) * direction
        results.append(
            _make_result(
                member_id=f"M{i+1:04d}",
                variance_amount=str(amount),
                variance_pct=1.8,
                plan_code=plan_code,
            )
        )
    return results


# --- Pattern Detection Tests ---


def test_detects_salary_mapping_error():
    """20 DB_T2 members all with +1.8% FAS variance -> 1 pattern, direction=positive, CV<0.3"""
    results = _make_salary_cluster(20, variance="150.00")
    patterns = detect_systematic_patterns(results)

    assert len(patterns) == 1
    p = patterns[0]
    assert p.suspected_domain == "salary"
    assert p.plan_code == "DB_T2"
    assert p.direction == "positive"
    assert p.member_count == 20
    assert p.cv < 0.3
    assert len(p.affected_members) == 20


def test_no_pattern_below_threshold():
    """3 members with same variance -> not systematic (< 5)"""
    results = _make_salary_cluster(3, variance="150.00")
    patterns = detect_systematic_patterns(results)
    assert len(patterns) == 0


def test_mixed_directions_no_pattern():
    """10 members, 5 positive + 5 negative -> not systematic as one pattern (split into two subgroups, each < 5)"""
    positive = _make_salary_cluster(4, variance="150.00", direction=1)
    negative = _make_salary_cluster(4, variance="150.00", direction=-1)
    # Rename member IDs to avoid duplicates
    for i, r in enumerate(negative):
        r.member_id = f"N{i+1:04d}"
    results = positive + negative
    patterns = detect_systematic_patterns(results)
    # Each direction has only 4 members, below the threshold of 5
    assert len(patterns) == 0


def test_high_cv_no_pattern():
    """10 members, widely varying amounts (CV > 0.3) -> not systematic"""
    results = []
    # Create highly variable amounts: 10, 100, 500, 20, 300, 50, 800, 5, 400, 250
    amounts = ["10.00", "100.00", "500.00", "20.00", "300.00",
               "50.00", "800.00", "5.00", "400.00", "250.00"]
    for i, amt in enumerate(amounts):
        results.append(
            _make_result(
                member_id=f"M{i+1:04d}",
                variance_amount=amt,
            )
        )
    patterns = detect_systematic_patterns(results)
    assert len(patterns) == 0


def test_multiple_patterns():
    """Members in 2 different domains -> detects 2 patterns"""
    salary_results = _make_salary_cluster(6, variance="150.00")
    service_results = []
    for i in range(7):
        jitter = Decimal(str(i * 0.3))
        service_results.append(
            _make_result(
                member_id=f"S{i+1:04d}",
                variance_amount=str(Decimal("2.50") + jitter),
                suspected_domain="service_credit",
                plan_code="DB_MAIN",
            )
        )

    patterns = detect_systematic_patterns(salary_results + service_results)
    assert len(patterns) == 2
    domains = {p.suspected_domain for p in patterns}
    assert domains == {"salary", "service_credit"}


def test_filters_out_matches():
    """MATCH results are excluded from analysis"""
    match_results = [
        _make_result(member_id=f"M{i+1:04d}", variance_amount="0.00", category="MATCH")
        for i in range(20)
    ]
    # Add a few non-match results below threshold
    minor_results = [
        _make_result(member_id=f"X{i+1:04d}", variance_amount="150.00", category="MINOR")
        for i in range(3)
    ]
    patterns = detect_systematic_patterns(match_results + minor_results)
    # 20 MATCHes filtered out, only 3 MINORs remain -- below threshold
    assert len(patterns) == 0


# --- Correction Suggestion Tests ---


def test_correction_suggests_mapping_fix():
    """Pattern + relevant mapping -> suggests MAPPING_FIX"""
    pattern = Pattern(
        pattern_id="salary_DB_T2_positive",
        suspected_domain="salary",
        plan_code="DB_T2",
        direction="positive",
        member_count=20,
        mean_variance=Decimal("150.00"),
        cv=0.05,
        affected_members=[f"M{i+1:04d}" for i in range(20)],
    )
    mappings = [
        FieldMapping(
            source_field="FAS_AMOUNT",
            canonical_field="final_average_salary",
            domain="salary",
            transform_type="FORMULA",
        ),
    ]

    corrections = suggest_corrections([pattern], mappings)
    assert len(corrections) == 1
    c = corrections[0]
    assert c.pattern_id == "salary_DB_T2_positive"
    assert c.correction_type == "MAPPING_FIX"
    assert c.affected_field == "final_average_salary"
    assert c.current_mapping == "FAS_AMOUNT"
    assert c.affected_member_count == 20
    assert c.confidence > 0.0
    assert "20 members" in c.evidence
    assert "DB_T2" in c.evidence


def test_correction_with_no_matching_mappings():
    """Pattern in domain with no mappings -> still produces suggestion with empty proposed_mapping"""
    pattern = Pattern(
        pattern_id="formula_DB_MAIN_negative",
        suspected_domain="formula",
        plan_code="DB_MAIN",
        direction="negative",
        member_count=10,
        mean_variance=Decimal("500.00"),
        cv=0.08,
        affected_members=[f"M{i+1:04d}" for i in range(10)],
    )
    # Mappings exist but not for "formula" domain
    mappings = [
        FieldMapping(
            source_field="SAL_AMT",
            canonical_field="salary",
            domain="salary",
            transform_type="DIRECT",
        ),
    ]

    corrections = suggest_corrections([pattern], mappings)
    assert len(corrections) == 1
    c = corrections[0]
    assert c.correction_type == "DATA_FIX"
    assert c.affected_field == "formula"
    assert c.current_mapping == ""
    assert c.proposed_mapping == ""
    assert c.affected_member_count == 10
    # Confidence should be reduced when no mapping info available
    assert c.confidence < 0.7


def test_correction_data_fix_for_high_cv():
    """Pattern with CV > 0.1 but < 0.3 suggests DATA_FIX when mappings exist."""
    pattern = Pattern(
        pattern_id="salary_DB_T2_positive",
        suspected_domain="salary",
        plan_code="DB_T2",
        direction="positive",
        member_count=15,
        mean_variance=Decimal("200.00"),
        cv=0.2,
        affected_members=[f"M{i+1:04d}" for i in range(15)],
    )
    mappings = [
        FieldMapping(
            source_field="SAL_AMT",
            canonical_field="salary_amount",
            domain="salary",
            transform_type="DIRECT",
        ),
    ]

    corrections = suggest_corrections([pattern], mappings)
    assert len(corrections) == 1
    assert corrections[0].correction_type == "DATA_FIX"
