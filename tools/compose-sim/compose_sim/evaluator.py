"""Per-scenario and aggregate scoring for composition evaluation."""

from __future__ import annotations

from .schemas import (
    AIComposition,
    AggregateMetrics,
    ExpectedComposition,
    Scenario,
    ScenarioResult,
)


# ---------------------------------------------------------------------------
# Set metrics
# ---------------------------------------------------------------------------
def jaccard(a: set, b: set) -> float:
    """Jaccard similarity between two sets."""
    if not a and not b:
        return 1.0
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def precision(predicted: set, actual: set) -> float:
    """Precision: what fraction of predicted items are correct."""
    if not predicted:
        return 1.0 if not actual else 0.0
    return len(predicted & actual) / len(predicted)


def recall(predicted: set, actual: set) -> float:
    """Recall: what fraction of actual items were predicted."""
    if not actual:
        return 1.0 if not predicted else 0.0
    return len(predicted & actual) / len(actual)


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------
def classify_errors(
    scenario: Scenario,
    expected: ExpectedComposition,
    actual: AIComposition,
) -> list[str]:
    """Classify the root cause of errors in a composition result."""
    errors = []

    # View mode error
    if actual.view_mode != expected.view_mode:
        errors.append("view_mode_error")

    exp_shown = set(expected.panels_shown)
    act_shown = set(actual.panels_shown)
    missing = exp_shown - act_shown
    extra = act_shown - exp_shown

    # Derive what the AI should have computed
    crm = scenario.crm_context
    profile = scenario.member_profile
    elig = scenario.eligibility_snapshot

    is_member_contact = crm.contact_type.value == "member"
    expected_has_member = is_member_contact or crm.has_legacy_member_id
    expected_has_calc = (
        expected_has_member
        and elig.vested
        and profile.status.value in ("active", "retired", "deferred")
    )

    # has_member error: member_banner wrong → likely misidentified has_member
    if "member_banner" in missing or "member_banner" in extra:
        errors.append("has_member_error")

    # has_calculation error: calc-dependent panels wrong
    calc_panels = {"benefit_calculation", "payment_options", "death_benefit", "ipr_calculator"}
    calc_missing = calc_panels & missing
    calc_extra = calc_panels & extra
    if calc_missing or calc_extra:
        errors.append("has_calculation_error")

    # Panel dependency error: case_journal wrong → ai_summary/crm_note_form cascade
    if "case_journal" in missing or "case_journal" in extra:
        dependent_wrong = {"ai_summary", "crm_note_form"} & (missing | extra)
        if dependent_wrong:
            errors.append("panel_dependency_error")

    # Alert condition errors
    exp_alerts = set(expected.alerts)
    act_alerts = set(actual.alerts)
    if exp_alerts != act_alerts:
        errors.append("alert_condition_error")

    # Boundary error: check if this is a boundary stratum
    if scenario.stratum.startswith("boundary") and (missing or extra):
        errors.append("boundary_error")

    return errors if errors else []


# ---------------------------------------------------------------------------
# Per-scenario scoring
# ---------------------------------------------------------------------------
def evaluate_scenario(
    scenario: Scenario,
    actual: AIComposition,
) -> ScenarioResult:
    """Score a single scenario against ground truth."""
    expected = scenario.expected_composition

    exp_shown = set(expected.panels_shown)
    act_shown = set(actual.panels_shown)
    exp_alerts = set(expected.alerts)
    act_alerts = set(actual.alerts)
    exp_fetches = set(expected.data_fetches)
    act_fetches = set(actual.data_fetches)

    view_ok = actual.view_mode == expected.view_mode
    panels_exact = exp_shown == act_shown
    alerts_exact = exp_alerts == act_alerts
    fetches_exact = exp_fetches == act_fetches

    p_jaccard = jaccard(act_shown, exp_shown)
    p_precision = precision(act_shown, exp_shown)
    p_recall = recall(act_shown, exp_shown)

    a_jaccard = jaccard(act_alerts, exp_alerts)
    a_precision = precision(act_alerts, exp_alerts)
    a_recall = recall(act_alerts, exp_alerts)

    f_jaccard = jaccard(act_fetches, exp_fetches)

    # Composite score: weighted combination
    composite = (
        0.15 * (1.0 if view_ok else 0.0)
        + 0.40 * p_jaccard
        + 0.30 * a_jaccard
        + 0.15 * f_jaccard
    )

    error_types = classify_errors(scenario, expected, actual)

    return ScenarioResult(
        scenario_id=scenario.scenario_id,
        stratum=scenario.stratum,
        expected=expected,
        actual=actual,
        view_mode_correct=view_ok,
        panels_exact_match=panels_exact,
        panels_jaccard=round(p_jaccard, 4),
        panels_precision=round(p_precision, 4),
        panels_recall=round(p_recall, 4),
        alerts_exact_match=alerts_exact,
        alerts_jaccard=round(a_jaccard, 4),
        alerts_precision=round(a_precision, 4),
        alerts_recall=round(a_recall, 4),
        fetches_exact_match=fetches_exact,
        fetches_jaccard=round(f_jaccard, 4),
        composite_score=round(composite, 4),
        error_types=error_types,
        missing_panels=sorted(exp_shown - act_shown),
        extra_panels=sorted(act_shown - exp_shown),
        missing_alerts=sorted(exp_alerts - act_alerts),
        extra_alerts=sorted(act_alerts - exp_alerts),
    )


def evaluate_error_result(scenario: Scenario, error_msg: str) -> ScenarioResult:
    """Create a ScenarioResult for a scenario that errored during API call."""
    return ScenarioResult(
        scenario_id=scenario.scenario_id,
        stratum=scenario.stratum,
        expected=scenario.expected_composition,
        actual=AIComposition(
            view_mode=scenario.expected_composition.view_mode,
            panels_shown=[],
            panels_hidden=[],
            alerts=[],
            data_fetches=[],
        ),
        error_message=error_msg,
        error_types=["api_error"],
    )


# ---------------------------------------------------------------------------
# Aggregate scoring
# ---------------------------------------------------------------------------
def aggregate_results(results: list[ScenarioResult]) -> AggregateMetrics:
    """Compute aggregate metrics across all scenario results."""
    if not results:
        return AggregateMetrics()

    n = len(results)
    valid = [r for r in results if r.error_message is None]
    n_valid = len(valid)

    if n_valid == 0:
        return AggregateMetrics(
            total_scenarios=n,
            api_errors=n,
        )

    error_counts: dict[str, int] = {}
    for r in results:
        for et in r.error_types:
            error_counts[et] = error_counts.get(et, 0) + 1

    return AggregateMetrics(
        total_scenarios=n,
        view_mode_accuracy=round(sum(1 for r in valid if r.view_mode_correct) / n_valid, 4),
        panels_exact_accuracy=round(sum(1 for r in valid if r.panels_exact_match) / n_valid, 4),
        panels_mean_jaccard=round(sum(r.panels_jaccard for r in valid) / n_valid, 4),
        panels_mean_precision=round(sum(r.panels_precision for r in valid) / n_valid, 4),
        panels_mean_recall=round(sum(r.panels_recall for r in valid) / n_valid, 4),
        alerts_exact_accuracy=round(sum(1 for r in valid if r.alerts_exact_match) / n_valid, 4),
        alerts_mean_jaccard=round(sum(r.alerts_jaccard for r in valid) / n_valid, 4),
        alerts_mean_precision=round(sum(r.alerts_precision for r in valid) / n_valid, 4),
        alerts_mean_recall=round(sum(r.alerts_recall for r in valid) / n_valid, 4),
        fetches_exact_accuracy=round(sum(1 for r in valid if r.fetches_exact_match) / n_valid, 4),
        fetches_mean_jaccard=round(sum(r.fetches_jaccard for r in valid) / n_valid, 4),
        mean_composite_score=round(sum(r.composite_score for r in valid) / n_valid, 4),
        error_type_counts=error_counts,
        api_errors=n - n_valid,
    )


def aggregate_by_group(
    results: list[ScenarioResult],
    group_fn,
) -> dict[str, AggregateMetrics]:
    """Compute aggregate metrics grouped by a function of ScenarioResult.

    group_fn: ScenarioResult -> str (group key)
    """
    groups: dict[str, list[ScenarioResult]] = {}
    for r in results:
        key = group_fn(r)
        groups.setdefault(key, []).append(r)

    return {k: aggregate_results(v) for k, v in sorted(groups.items())}


def by_stratum(r: ScenarioResult) -> str:
    return r.stratum


def by_tier(r: ScenarioResult) -> str:
    # Extract tier from stratum name or scenario data
    stratum = r.stratum
    for t in ("tier1", "tier2", "tier3"):
        if t in stratum:
            return t
    return "other"


def by_status(r: ScenarioResult) -> str:
    for s in ("active", "retired", "deferred", "terminated"):
        if s in r.stratum:
            return s
    return "other"
