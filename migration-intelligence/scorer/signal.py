"""Multi-signal column scoring for migration mapping."""
from rapidfuzz import fuzz
import re

# Canonical column definitions per concept tag (mirrors Go template registry)
# This is the Python-side knowledge of what canonical columns exist
CANONICAL_COLUMNS = {
    "employee-master": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr", "mbr_id", "emp_nbr", "emp_id", "empl_id"]},
        "national_id": {"type_family": "VARCHAR", "expected_names": ["national_id", "natl_id", "ssn", "ssn_raw", "social_security"]},
        "birth_date": {"type_family": "DATE", "expected_names": ["birth_date", "birth_dt", "dob", "date_of_birth"]},
        "first_name": {"type_family": "VARCHAR", "expected_names": ["first_name", "first_nm", "fname", "given_name"]},
        "last_name": {"type_family": "VARCHAR", "expected_names": ["last_name", "last_nm", "lname", "surname"]},
        "original_hire_date": {"type_family": "DATE", "expected_names": ["hire_date", "hire_dt", "original_hire_date"]},
        "plan_code": {"type_family": "VARCHAR", "expected_names": ["plan_code", "plan_cd", "plan_id"]},
        "plan_tier": {"type_family": "VARCHAR", "expected_names": ["plan_tier", "tier", "member_tier"]},
        "status": {"type_family": "VARCHAR", "expected_names": ["status", "status_code", "status_cd", "member_status"]},
    },
    "salary-history": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr", "mbr_id"]},
        "period_start": {"type_family": "DATE", "expected_names": ["period_start", "earned_start", "pay_period_start", "start_date"]},
        "period_end": {"type_family": "DATE", "expected_names": ["period_end", "earned_end", "pay_period_end", "end_date"]},
        "gross_amount": {"type_family": "DECIMAL", "expected_names": ["gross_amount", "salary_amount", "sal_amt", "compensation"]},
        "pensionable_amount": {"type_family": "DECIMAL", "expected_names": ["pensionable_amount", "base_salary", "base_amount"]},
        "granularity": {"type_family": "VARCHAR", "expected_names": ["granularity", "frequency", "pay_frequency"]},
    },
    "employment-timeline": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr"]},
        "employer_code": {"type_family": "VARCHAR", "expected_names": ["employer_code", "employer_id", "empr_cd"]},
        "spell_start_date": {"type_family": "DATE", "expected_names": ["spell_start", "segment_start", "start_date"]},
        "spell_end_date": {"type_family": "DATE", "expected_names": ["spell_end", "segment_end", "end_date"]},
    },
    "benefit-deduction": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr"]},
        "contribution_period": {"type_family": "DATE", "expected_names": ["contribution_period", "period", "effective_date"]},
        "ee_amount": {"type_family": "DECIMAL", "expected_names": ["ee_amount", "employee_contribution", "ee_contribution"]},
        "er_amount": {"type_family": "DECIMAL", "expected_names": ["er_amount", "employer_contribution", "er_contribution"]},
    },
    "service-credit": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr"]},
        "credited_years_total": {"type_family": "DECIMAL", "expected_names": ["credited_years_total", "service_units", "years_of_service"]},
        "service_type": {"type_family": "VARCHAR", "expected_names": ["service_type", "service_unit_type", "credit_type"]},
    },
    "benefit-payment": {
        "member_id": {"type_family": "INTEGER", "expected_names": ["member_id", "mbr_nbr"]},
        "pay_period_date": {"type_family": "DATE", "expected_names": ["pay_period_date", "payment_date", "pay_date"]},
        "gross_amount": {"type_family": "DECIMAL", "expected_names": ["gross_amount", "payment_amount"]},
        "net_amount": {"type_family": "DECIMAL", "expected_names": ["net_amount", "net_payment"]},
    },
}


def name_similarity(source: str, target: str) -> float:
    """
    Compute name similarity between source and target column names.
    Uses rapidfuzz for fuzzy string matching.
    Returns 0.0 to 1.0.
    """
    s = source.lower().strip()
    t = target.lower().strip()

    if s == t:
        return 1.0

    # Token sort ratio handles reordering (e.g., "hire_date" vs "date_of_hire")
    token_sort = fuzz.token_sort_ratio(s, t) / 100.0

    # Partial ratio handles abbreviations (e.g., "birth_dt" vs "birth_date")
    partial = fuzz.partial_ratio(s, t) / 100.0

    return max(token_sort, partial * 0.9)  # slight discount for partial matches


def type_compatibility(source_type: str, target_family: str) -> float:
    """
    Score type compatibility between source column type and target type family.
    Returns 0.0 to 1.0.
    """
    s = source_type.lower().split("(")[0].strip()  # strip precision
    t = target_family.lower()

    FAMILIES = {
        "integer": {"integer", "int", "int4", "int8", "bigint", "smallint", "serial", "bigserial"},
        "decimal": {"decimal", "numeric", "float", "double", "real", "money"},
        "varchar": {"varchar", "char", "text", "character", "nvarchar", "nchar", "string"},
        "date": {"date", "timestamp", "timestamptz", "datetime"},
        "boolean": {"boolean", "bool", "bit"},
        "uuid": {"uuid"},
    }

    source_family = None
    target_normalized = None

    for family, members in FAMILIES.items():
        if s in members:
            source_family = family
        if t in members:
            target_normalized = family

    if source_family is None or target_normalized is None:
        return 0.3  # unknown types get a small score

    if source_family == target_normalized:
        return 1.0

    # Cross-family compatibility
    COMPAT = {
        ("integer", "decimal"): 0.7,
        ("decimal", "integer"): 0.5,
        ("varchar", "date"): 0.4,      # dates often stored as varchar in legacy
        ("integer", "varchar"): 0.3,
        ("varchar", "integer"): 0.3,
        ("varchar", "uuid"): 0.5,      # UUIDs stored as varchar
        ("uuid", "varchar"): 0.5,
    }

    return COMPAT.get((source_family, target_normalized), 0.1)


def null_rate_signal(null_rate: float, is_required: bool) -> float:
    """
    Score based on null rate. High nulls on a required field = bad sign.
    Returns 0.0 to 1.0.
    """
    if not is_required:
        return 0.8  # null rate doesn't matter much for optional fields

    if null_rate <= 0.01:
        return 1.0
    elif null_rate <= 0.05:
        return 0.8
    elif null_rate <= 0.20:
        return 0.5
    else:
        return 0.2  # >20% null on required field is suspicious


def cardinality_signal(cardinality: int, row_count: int, target_family: str) -> float:
    """
    Score based on cardinality pattern.
    PKs should be unique, FKs should have medium cardinality, etc.
    """
    if row_count == 0:
        return 0.5

    ratio = cardinality / row_count

    # IDs and PKs should be high cardinality
    if target_family in ("INTEGER", "UUID"):
        if ratio > 0.9:
            return 1.0
        elif ratio > 0.5:
            return 0.7
        else:
            return 0.4

    # Dates should have medium-high cardinality
    if target_family == "DATE":
        if 0.01 < ratio < 1.0:
            return 0.9
        return 0.5

    # Status/code fields should have LOW cardinality
    if target_family == "VARCHAR":
        # This is ambiguous -- varchar could be name (high card) or code (low card)
        return 0.7

    # Decimal/money fields -- usually high cardinality
    if target_family == "DECIMAL":
        if ratio > 0.1:
            return 0.9
        return 0.5

    return 0.6


def composite_score(signals: dict[str, float], weights: dict[str, float] | None = None) -> float:
    """
    Weighted combination of all signals.
    """
    if weights is None:
        weights = {
            "name_similarity": 0.40,
            "type_compatibility": 0.25,
            "null_rate": 0.10,
            "cardinality": 0.10,
            "corpus_match": 0.15,  # starts at 0 until corpus has data
        }

    total_weight = sum(weights.get(k, 0) for k in signals)
    if total_weight == 0:
        return 0.0

    score = sum(signals.get(k, 0) * weights.get(k, 0) for k in signals)
    return score / total_weight  # normalize if not all signals present


def score_column(
    source_name: str,
    source_type: str,
    null_rate: float,
    cardinality: int,
    row_count: int,
    canonical_column: str,
    canonical_info: dict,
) -> tuple[float, dict[str, float]]:
    """
    Score a single source column against a single canonical column.
    Returns (composite_score, individual_signals).
    """
    signals = {}

    # Check pattern match first (high confidence shortcut)
    expected_names = canonical_info.get("expected_names", [])
    if source_name.lower() in [n.lower() for n in expected_names]:
        signals["name_similarity"] = 0.95  # pattern match, very high
    else:
        signals["name_similarity"] = name_similarity(source_name, canonical_column)

    signals["type_compatibility"] = type_compatibility(source_type, canonical_info["type_family"])
    signals["null_rate"] = null_rate_signal(null_rate, True)  # assume required for scoring
    signals["cardinality"] = cardinality_signal(cardinality, row_count, canonical_info["type_family"])
    signals["corpus_match"] = 0.0  # no corpus data yet

    return composite_score(signals), signals
