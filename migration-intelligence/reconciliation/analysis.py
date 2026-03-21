"""Systematic pattern detection for reconciliation mismatches."""

from dataclasses import dataclass, field
from decimal import Decimal
import statistics


@dataclass
class ReconciliationResult:
    member_id: str
    variance_amount: Decimal
    variance_pct: float  # variance as percentage of canonical
    suspected_domain: str  # e.g., "salary", "service_credit", "formula"
    member_status: str  # "RETIREE", "ACTIVE", "DEFERRED"
    plan_code: str
    category: str  # "MATCH", "MINOR", "MAJOR", "ERROR"


@dataclass
class Pattern:
    pattern_id: str
    suspected_domain: str
    plan_code: str
    direction: str  # "positive" or "negative"
    member_count: int
    mean_variance: Decimal
    cv: float  # coefficient of variation
    affected_members: list[str] = field(default_factory=list)


MIN_MEMBERS_FOR_PATTERN = 5
MAX_CV_FOR_SYSTEMATIC = 0.3


def detect_systematic_patterns(
    results: list[ReconciliationResult],
) -> list[Pattern]:
    """
    Group mismatches by suspected_domain + plan_code and direction.
    A pattern is 'systematic' if:
    - >= 5 members affected
    - All variances in same direction (all positive or all negative)
    - Coefficient of variation < 0.3 (tight cluster)
    """
    # Step 1: Filter out MATCH results
    mismatches = [r for r in results if r.category != "MATCH"]

    # Step 2: Group by (suspected_domain, plan_code)
    groups: dict[tuple[str, str], list[ReconciliationResult]] = {}
    for r in mismatches:
        key = (r.suspected_domain, r.plan_code)
        groups.setdefault(key, []).append(r)

    patterns: list[Pattern] = []

    for (domain, plan_code), members in groups.items():
        # Step 3: Separate positive and negative variances
        positive = [m for m in members if m.variance_amount > 0]
        negative = [m for m in members if m.variance_amount < 0]

        for direction, subgroup in [("positive", positive), ("negative", negative)]:
            # Step 4: Check minimum count
            if len(subgroup) < MIN_MEMBERS_FOR_PATTERN:
                continue

            # Compute statistics on absolute variance amounts
            amounts = [float(abs(m.variance_amount)) for m in subgroup]
            mean_val = statistics.mean(amounts)

            if mean_val == 0:
                continue

            if len(amounts) >= 2:
                stdev_val = statistics.stdev(amounts)
                cv = stdev_val / mean_val
            else:
                cv = 0.0

            # Step 5: Check CV threshold
            if cv >= MAX_CV_FOR_SYSTEMATIC:
                continue

            pattern_id = f"{domain}_{plan_code}_{direction}"
            patterns.append(
                Pattern(
                    pattern_id=pattern_id,
                    suspected_domain=domain,
                    plan_code=plan_code,
                    direction=direction,
                    member_count=len(subgroup),
                    mean_variance=Decimal(str(round(mean_val, 4))),
                    cv=round(cv, 4),
                    affected_members=[m.member_id for m in subgroup],
                )
            )

    return patterns
