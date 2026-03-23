"""
Cross-language verification: Python (decimal.Decimal) vs Go (math/big.Rat).

Both languages read the same YAML fixtures and must produce $0.00 variance
on gross_monthly, reduction_factor, and final_monthly for every test case.

Run:
    cd migration-simulation
    python -m pytest tests/test_cross_language.py -v
"""

import os
import sys
from decimal import Decimal
from pathlib import Path

import pytest
import yaml

# Add parent so we can import formula package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from formula.benefit import (
    PLAN_REGISTRY,
    BenefitCalcResult,
    calc_retirement_benefit,
    round_half_up,
)

FIXTURES_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "reconciliation_fixtures.yaml"


def load_fixtures():
    """Load shared YAML fixtures."""
    with open(FIXTURES_PATH) as f:
        doc = yaml.safe_load(f)
    return doc["test_cases"]


FIXTURES = load_fixtures()


@pytest.mark.parametrize(
    "case",
    FIXTURES,
    ids=[c["name"] for c in FIXTURES],
)
def test_benefit_formula_matches_fixtures(case):
    """Each fixture case must match to $0.00 variance."""
    inputs = case["inputs"]
    expected = case["expected"]

    # Handle error cases (e.g., unknown tier)
    if expected.get("error"):
        tier_code = inputs["tier_code"]
        assert tier_code not in PLAN_REGISTRY, (
            f"tier_code {tier_code!r} should NOT be in PLAN_REGISTRY for error case"
        )
        return

    yos = Decimal(inputs["yos"])
    fas = Decimal(inputs["fas"])
    age = inputs["age_at_retirement"]
    tier_code = inputs["tier_code"]

    params = PLAN_REGISTRY[tier_code]
    result = calc_retirement_benefit(yos, fas, age, params)

    assert str(result.gross_monthly) == expected["gross_monthly"], (
        f"gross_monthly: got {result.gross_monthly}, want {expected['gross_monthly']}"
    )

    # reduction_factor: compare as string (Go uses FloatString(2))
    assert str(result.reduction_factor) == expected["reduction_factor"], (
        f"reduction_factor: got {result.reduction_factor}, want {expected['reduction_factor']}"
    )

    assert str(result.final_monthly) == expected["final_monthly"], (
        f"final_monthly: got {result.final_monthly}, want {expected['final_monthly']}"
    )


def test_round_half_up_cases():
    """Verify HALF_UP rounding matches Go behavior."""
    cases = [
        ("0", "0.00"),
        ("100", "100.00"),
        ("12.34", "12.34"),
        ("0.005", "0.01"),
        ("2291.665", "2291.67"),
        ("2291.664", "2291.66"),
        ("-1.005", "-1.01"),
        ("99999.995", "100000.00"),
    ]
    for input_val, expected in cases:
        result = str(round_half_up(Decimal(input_val)))
        assert result == expected, (
            f"round_half_up({input_val}) = {result}, want {expected}"
        )


def test_all_plan_codes_covered():
    """Every tier_code in fixtures (except error cases) must exist in PLAN_REGISTRY."""
    tier_codes = {
        c["inputs"]["tier_code"]
        for c in FIXTURES
        if not c["expected"].get("error")
    }
    for code in tier_codes:
        assert code in PLAN_REGISTRY, f"tier code {code!r} not in PLAN_REGISTRY"
