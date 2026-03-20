#!/usr/bin/env python3
"""
generate_compose_scenarios.py — 10,000 Composition Scenario Generator

Generates deterministic JSONL training data for the NoUI AI compose
layer. Each scenario pairs a member profile + CRM context with the expected
rendering decisions (panels shown/hidden, alerts triggered, data fetches).

Usage:
    python generate_compose_scenarios.py --count 10000 --seed 42 --output compose-scenarios.jsonl
    python generate_compose_scenarios.py --count 100 --seed 42  # quick test

Standalone — no external dependencies beyond Python stdlib.
"""

import argparse
import json
import math
import random
import sys
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta
from typing import Optional

# ---------------------------------------------------------------------------
# Constants matching generate_seed_data.py
# ---------------------------------------------------------------------------
TODAY = date(2026, 3, 2)
TIER_1_CUTOFF = date(2006, 1, 1)
TIER_2_CUTOFF = date(2012, 1, 1)
MEDICARE_CUTOFF = date(1986, 4, 1)

RULE_OF_N_TARGET = {1: 75, 2: 75, 3: 85}
MIN_EARLY_AGE = {1: 55, 2: 55, 3: 55}
NORMAL_RETIREMENT_AGE = 65
MIN_VESTING_YEARS = 5
REDUCTION_RATE = {1: 0.03, 2: 0.03, 3: 0.06}

SECURITY_FLAG_TYPES = [
    "fraud_alert", "litigation_hold", "deceased_pending",
    "identity_theft", "garnishment_order",
]

CHANNEL_TYPES = [
    ("phone", 40), ("web_portal", 25), ("email", 15),
    ("walk_in", 10), ("mail", 7), ("fax", 3),
]


# ---------------------------------------------------------------------------
# Weighted choice helper
# ---------------------------------------------------------------------------
def weighted_choice(rng, options_weights):
    """Pick from [(value, weight), ...] using the given RNG."""
    values, weights = zip(*options_weights)
    return rng.choices(values, weights=weights, k=1)[0]


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


# ---------------------------------------------------------------------------
# Member profile generation
# ---------------------------------------------------------------------------
def generate_member_profile(rng, overrides=None):
    """Generate a single member_profile dict from weighted distributions."""
    o = overrides or {}

    tier = o.get("tier") or weighted_choice(rng, [(1, 25), (2, 30), (3, 45)])
    status = o.get("status") or weighted_choice(rng, [
        ("active", 50), ("retired", 30), ("deferred", 12), ("terminated", 8),
    ])
    gender = o.get("gender") or weighted_choice(rng, [("M", 55), ("F", 45)])
    marital_status = o.get("marital_status") or weighted_choice(rng, [
        ("S", 20), ("M", 55), ("D", 20), ("W", 5),
    ])

    # Age at retirement/separation: Normal(62, 4) clamped to 55-75 for active/retired;
    # deferred/terminated members left before retirement age, so use wider range
    age_at_retirement = o.get("age_at_retirement")
    if age_at_retirement is None:
        if status in ("deferred", "terminated"):
            age_at_retirement = round(clamp(rng.gauss(45, 8), 30, 64), 1)
        else:
            age_at_retirement = round(clamp(rng.gauss(62, 4), 55, 75), 1)

    # Earned service years: tier-dependent ranges
    # Deferred/terminated members typically have shorter service
    earned_service_years = o.get("earned_service_years")
    if earned_service_years is None:
        if status in ("deferred", "terminated"):
            # Shorter careers — some below vesting threshold for terminated
            if status == "terminated":
                earned_service_years = round(clamp(rng.gauss(6, 3), 1, 20), 1)
            else:
                earned_service_years = round(clamp(rng.gauss(10, 4), 5, 25), 1)
        elif tier == 1:
            earned_service_years = round(clamp(rng.gauss(25, 5), 15, 35), 1)
        elif tier == 2:
            earned_service_years = round(clamp(rng.gauss(17, 4), 10, 25), 1)
        else:
            earned_service_years = round(clamp(rng.gauss(11, 3), 5, 18), 1)

    # Purchased service
    has_purchased_service = o.get("has_purchased_service")
    if has_purchased_service is None:
        has_purchased_service = rng.random() < 0.03
    purchased_years = 0.0
    if has_purchased_service:
        purchased_years = o.get("purchased_years") or round(rng.uniform(1, 5), 1)

    # Military service
    has_military_service = o.get("has_military_service")
    if has_military_service is None:
        has_military_service = rng.random() < 0.02
    military_years = 0.0
    if has_military_service:
        military_years = o.get("military_years") or round(rng.uniform(1, 4), 1)

    # DRO
    has_dro = o.get("has_dro")
    if has_dro is None:
        has_dro = rng.random() < 0.04
    dro_division_pct = 0.0
    if has_dro:
        dro_division_pct = o.get("dro_division_pct") or round(rng.uniform(30, 50), 1)

    # Hire date derivation (for leave payout + medicare)
    # Approximate hire date from retirement age and service years
    birth_year = round(TODAY.year - age_at_retirement)
    hire_year = round(birth_year + (age_at_retirement - earned_service_years))
    hire_date = date(clamp(hire_year, 1970, 2024), rng.randint(1, 12), rng.randint(1, 28))

    # Leave payout: T1/T2 hired before 2010 only
    leave_payout_eligible = o.get("leave_payout_eligible")
    if leave_payout_eligible is None:
        leave_payout_eligible = (tier in (1, 2) and hire_date < date(2010, 1, 1))
    leave_payout_amount = 0.0
    if leave_payout_eligible:
        leave_payout_amount = round(clamp(rng.gauss(40000, 15000), 10000, 80000), 2)

    # Medicare flag: Y if hired >= 1986-04-01
    medicare_flag = o.get("medicare_flag") or ("Y" if hire_date >= MEDICARE_CUTOFF else "N")

    # Employment history
    has_employment_history = o.get("has_employment_history")
    if has_employment_history is None:
        has_employment_history = rng.random() < 0.95
    employment_event_count = 0
    if has_employment_history:
        employment_event_count = o.get("employment_event_count") or weighted_choice(rng, [
            (1, 10), (2, 25), (3, 30), (4, 20), (5, 8), (6, 4), (7, 2), (8, 1),
        ])

    # Middle name
    has_middle_name = rng.random() < 0.70
    middle_name = _random_middle_name(rng, gender) if has_middle_name else None

    # Derived: vested
    vested = earned_service_years >= MIN_VESTING_YEARS

    # Derived: total service (for benefit calculation, includes purchased)
    total_service_years = round(earned_service_years + purchased_years + military_years, 1)

    # Derived: eligibility years (for Rule of N: earned + military, NOT purchased)
    eligibility_years = round(earned_service_years + military_years, 1)

    profile = {
        "tier": tier,
        "status": status,
        "gender": gender,
        "marital_status": marital_status,
        "age_at_retirement": age_at_retirement,
        "earned_service_years": earned_service_years,
        "has_purchased_service": has_purchased_service,
        "purchased_years": purchased_years,
        "has_military_service": has_military_service,
        "military_years": military_years,
        "has_dro": has_dro,
        "dro_division_pct": dro_division_pct,
        "leave_payout_eligible": leave_payout_eligible,
        "leave_payout_amount": leave_payout_amount,
        "medicare_flag": medicare_flag,
        "has_employment_history": has_employment_history,
        "employment_event_count": employment_event_count,
        "vested": vested,
        "middle_name": middle_name,
        "hire_date": hire_date.isoformat(),
        "total_service_years": total_service_years,
        "eligibility_years": eligibility_years,
    }
    return profile


MIDDLE_NAMES_M = [
    "James", "Michael", "Robert", "William", "David", "John", "Thomas",
    "Lee", "Allen", "Ray", "Dean", "Wayne", "Scott", "Paul", "Edward",
]
MIDDLE_NAMES_F = [
    "Marie", "Ann", "Lynn", "Jean", "Louise", "Rose", "May",
    "Lee", "Grace", "Jane", "Renee", "Nicole", "Kay", "Elaine", "Dawn",
]


def _random_middle_name(rng, gender):
    pool = MIDDLE_NAMES_M if gender == "M" else MIDDLE_NAMES_F
    return rng.choice(pool)


# ---------------------------------------------------------------------------
# Eligibility computation
# ---------------------------------------------------------------------------
def compute_eligibility(profile):
    """Deterministically compute eligibility fields from a member profile."""
    tier = profile["tier"]
    age = profile["age_at_retirement"]
    eligibility_years = profile["eligibility_years"]
    vested = profile["vested"]

    rule_of_n_target = RULE_OF_N_TARGET[tier]
    rule_of_n_sum = round(age + eligibility_years, 1)
    min_early_age = MIN_EARLY_AGE[tier]
    rule_of_n_met = (rule_of_n_sum >= rule_of_n_target) and (age >= min_early_age)

    # Best eligible type
    if age >= NORMAL_RETIREMENT_AGE and vested:
        best_eligible_type = "NORMAL"
    elif rule_of_n_met:
        best_eligible_type = "EARLY"
    elif age >= min_early_age and vested:
        best_eligible_type = "EARLY"
    elif vested:
        best_eligible_type = "DEFERRED"
    else:
        best_eligible_type = "NOT_ELIGIBLE"

    # Reduction
    reduction_applies = (best_eligible_type == "EARLY") and (not rule_of_n_met)
    reduction_pct = 0.0
    if reduction_applies:
        reduction_pct = round((NORMAL_RETIREMENT_AGE - age) * REDUCTION_RATE[tier], 1)
        reduction_pct = max(0.0, reduction_pct)

    # Leave payout AMS impact (> 0 if eligible and in AMS window)
    leave_payout_ams_impact = 0.0
    if profile["leave_payout_eligible"] and profile["leave_payout_amount"] > 0:
        # Simplified: assume payout boosts AMS if within final averaging period
        leave_payout_ams_impact = round(profile["leave_payout_amount"] / 36, 2)

    # Rule of N near threshold
    rule_of_n_near = abs(rule_of_n_sum - rule_of_n_target) <= 2 and not rule_of_n_met

    return {
        "best_eligible_type": best_eligible_type,
        "rule_of_n_sum": rule_of_n_sum,
        "rule_of_n_target": rule_of_n_target,
        "rule_of_n_met": rule_of_n_met,
        "reduction_applies": reduction_applies,
        "reduction_pct": reduction_pct,
        "vested": vested,
        "leave_payout_ams_impact": leave_payout_ams_impact,
        "rule_of_n_near": rule_of_n_near,
    }


# ---------------------------------------------------------------------------
# CRM context generation
# ---------------------------------------------------------------------------
def generate_crm_context(rng, profile, overrides=None):
    """Generate a crm_context dict."""
    o = overrides or {}

    contact_type = o.get("contact_type") or weighted_choice(rng, [
        ("member", 80), ("beneficiary", 10), ("alternate_payee", 5), ("external", 5),
    ])
    identity_verified = o.get("identity_verified")
    if identity_verified is None:
        identity_verified = rng.random() < 0.85

    security_flag = o.get("security_flag")
    if security_flag is None:
        if rng.random() < 0.10:
            security_flag = rng.choice(SECURITY_FLAG_TYPES)
        else:
            security_flag = None

    has_legacy_member_id = o.get("has_legacy_member_id")
    if has_legacy_member_id is None:
        has_legacy_member_id = rng.random() < 0.95 if contact_type == "member" else rng.random() < 0.30

    open_conversations = o.get("open_conversations")
    if open_conversations is None:
        open_conversations = weighted_choice(rng, [(0, 40), (1, 30), (2, 20), (3, 7), (4, 2), (5, 1)])

    pending_commitments = o.get("pending_commitments")
    if pending_commitments is None:
        pending_commitments = weighted_choice(rng, [(0, 50), (1, 30), (2, 15), (3, 5)])

    overdue_commitments = o.get("overdue_commitments")
    if overdue_commitments is None:
        overdue_commitments = weighted_choice(rng, [(0, 80), (1, 15), (2, 5)])

    # Interaction count: log-normal
    interaction_count = o.get("interaction_count")
    if interaction_count is None:
        interaction_count = min(50, max(0, int(rng.lognormvariate(1.5, 1.0))))

    recent_channel = o.get("recent_channel") or weighted_choice(rng, CHANNEL_TYPES)

    sla_breached = o.get("sla_breached")
    if sla_breached is None:
        sla_breached = (open_conversations > 0) and (rng.random() < 0.05)

    has_urgent_notes = o.get("has_urgent_notes")
    if has_urgent_notes is None:
        has_urgent_notes = rng.random() < 0.03

    sentiment_trend = o.get("sentiment_trend") or weighted_choice(rng, [
        ("positive", 30), ("neutral", 45), ("mixed", 15), ("concern", 10),
    ])

    return {
        "contact_type": contact_type,
        "identity_verified": identity_verified,
        "security_flag": security_flag,
        "has_legacy_member_id": has_legacy_member_id,
        "open_conversations": open_conversations,
        "pending_commitments": pending_commitments,
        "overdue_commitments": overdue_commitments,
        "interaction_count": interaction_count,
        "recent_channel": recent_channel,
        "sla_breached": sla_breached,
        "has_urgent_notes": has_urgent_notes,
        "sentiment_trend": sentiment_trend,
    }


# ---------------------------------------------------------------------------
# Composition rules engine
# ---------------------------------------------------------------------------
ALL_PANELS = [
    "member_banner", "service_credit_summary", "benefit_calculation",
    "payment_options", "dro_impact", "scenario_modeler", "death_benefit",
    "ipr_calculator", "employment_timeline", "case_journal",
    "ai_summary", "crm_note_form",
]

ALL_DATA_FETCHES = [
    "member_data", "service_credit", "benefit_calculation",
    "employment_history", "payment_options", "scenario_projection",
    "crm_contact", "crm_conversations", "crm_commitments",
    "crm_interactions", "crm_outreach",
]


def compute_expected_composition(profile, crm_context, eligibility):
    """
    Pure function mirroring App.tsx (lines 252-293), CRMWorkspace.tsx,
    and MemberPortal.tsx conditional rendering logic.

    Returns the expected composition for this profile + CRM context.
    """
    panels_shown = []
    panels_hidden = []
    rationale = {}
    alerts = []
    data_fetches = []

    is_member_contact = crm_context["contact_type"] == "member"
    has_member = is_member_contact or crm_context["has_legacy_member_id"]

    # Determine view mode
    if crm_context["contact_type"] in ("beneficiary", "alternate_payee", "external"):
        view_mode = "crm"
    else:
        view_mode = "workspace"

    # --- Panel decisions (App.tsx AgentWorkspace lines 252-293) ---

    # member_banner: Always shown when member is loaded
    if has_member:
        panels_shown.append("member_banner")
        rationale["member_banner"] = "Shown: member data loaded"
    else:
        panels_hidden.append("member_banner")
        rationale["member_banner"] = "Hidden: no member data"

    # service_credit_summary: shown when service credit data exists
    if has_member and profile["earned_service_years"] > 0:
        panels_shown.append("service_credit_summary")
        rationale["service_credit_summary"] = "Shown: service credit data exists"
        data_fetches.append("service_credit")
    else:
        panels_hidden.append("service_credit_summary")
        rationale["service_credit_summary"] = "Hidden: no service credit data"

    # benefit_calculation: shown when calculation result exists
    # Calculation exists for active/retired members who are vested
    has_calculation = has_member and eligibility["vested"] and profile["status"] in ("active", "retired", "deferred")
    if has_calculation:
        panels_shown.append("benefit_calculation")
        rationale["benefit_calculation"] = "Shown: calculation result available"
        data_fetches.append("benefit_calculation")
    else:
        panels_hidden.append("benefit_calculation")
        rationale["benefit_calculation"] = "Hidden: no calculation result"

    # payment_options: shown when calculation result exists
    if has_calculation:
        panels_shown.append("payment_options")
        rationale["payment_options"] = "Shown: calculation result available"
        data_fetches.append("payment_options")
    else:
        panels_hidden.append("payment_options")
        rationale["payment_options"] = "Hidden: no calculation result"

    # dro_impact: shown when has_dro == true
    if profile["has_dro"] and has_calculation:
        panels_shown.append("dro_impact")
        rationale["dro_impact"] = "Shown: DRO record active"
    else:
        panels_hidden.append("dro_impact")
        rationale["dro_impact"] = "Hidden: no DRO record" if not profile["has_dro"] else "Hidden: no calculation"

    # scenario_modeler: shown when best_eligible_type == 'EARLY'
    if eligibility["best_eligible_type"] == "EARLY" and has_calculation:
        panels_shown.append("scenario_modeler")
        rationale["scenario_modeler"] = "Shown: early retirement — scenario modeling available"
        data_fetches.append("scenario_projection")
    else:
        panels_hidden.append("scenario_modeler")
        rationale["scenario_modeler"] = "Hidden: not early retirement" if eligibility["best_eligible_type"] != "EARLY" else "Hidden: no calculation"

    # death_benefit: shown when calculation result exists
    if has_calculation:
        panels_shown.append("death_benefit")
        rationale["death_benefit"] = "Shown: calculation result available"
    else:
        panels_hidden.append("death_benefit")
        rationale["death_benefit"] = "Hidden: no calculation result"

    # ipr_calculator: shown when calculation result exists
    if has_calculation:
        panels_shown.append("ipr_calculator")
        rationale["ipr_calculator"] = "Shown: calculation result available"
    else:
        panels_hidden.append("ipr_calculator")
        rationale["ipr_calculator"] = "Hidden: no calculation result"

    # employment_timeline: shown when has_employment_history && event_count > 0
    if profile["has_employment_history"] and profile["employment_event_count"] > 0:
        panels_shown.append("employment_timeline")
        rationale["employment_timeline"] = f"Shown: {profile['employment_event_count']} employment events"
        data_fetches.append("employment_history")
    else:
        panels_hidden.append("employment_timeline")
        rationale["employment_timeline"] = "Hidden: no employment history"

    # case_journal: CRM view + contact selected
    if view_mode == "crm" or crm_context["open_conversations"] > 0:
        panels_shown.append("case_journal")
        rationale["case_journal"] = "Shown: CRM context with contact"
        data_fetches.extend(["crm_contact", "crm_conversations", "crm_commitments", "crm_interactions"])
    else:
        panels_hidden.append("case_journal")
        rationale["case_journal"] = "Hidden: no CRM context"

    # ai_summary: journal visible + timeline has entries
    journal_visible = "case_journal" in panels_shown
    has_timeline = profile["has_employment_history"] and profile["employment_event_count"] > 0
    if journal_visible and has_timeline:
        panels_shown.append("ai_summary")
        rationale["ai_summary"] = "Shown: journal visible with timeline entries"
    else:
        panels_hidden.append("ai_summary")
        rationale["ai_summary"] = "Hidden: journal not visible or no timeline" if not journal_visible else "Hidden: no timeline entries"

    # crm_note_form: journal visible
    if journal_visible:
        panels_shown.append("crm_note_form")
        rationale["crm_note_form"] = "Shown: journal panel active"
    else:
        panels_hidden.append("crm_note_form")
        rationale["crm_note_form"] = "Hidden: journal not active"

    # --- Always-needed data fetches ---
    if has_member:
        data_fetches.insert(0, "member_data")
    if crm_context["open_conversations"] > 0 or view_mode == "crm":
        if "crm_outreach" not in data_fetches:
            data_fetches.append("crm_outreach")

    # Deduplicate while preserving order
    seen = set()
    unique_fetches = []
    for f in data_fetches:
        if f not in seen:
            seen.add(f)
            unique_fetches.append(f)
    data_fetches = unique_fetches

    # --- Alert conditions ---

    # Member-related alerts only fire when member data is loaded
    if has_member:
        if profile["marital_status"] == "M":
            alerts.append("spousal_consent_required")

        if eligibility["reduction_applies"]:
            alerts.append("early_retirement_reduction")

        if profile["leave_payout_eligible"] and eligibility["leave_payout_ams_impact"] > 0:
            alerts.append("leave_payout_ams_boost")

        if profile["has_purchased_service"]:
            alerts.append("purchased_service_warning")

        if profile["has_dro"]:
            alerts.append("dro_deduction_active")

        if not eligibility["vested"]:
            alerts.append("not_vested")

        if profile["medicare_flag"] == "Y":
            alerts.append("medicare_ipr_highlight")

        if eligibility["best_eligible_type"] == "EARLY" and not eligibility["rule_of_n_met"]:
            alerts.append("waiting_increases_benefit")

        if eligibility["rule_of_n_near"]:
            alerts.append("rule_of_n_near_threshold")

    # CRM alerts always apply
    if crm_context["security_flag"] is not None:
        alerts.append("security_flag_warning")

    if crm_context["overdue_commitments"] > 0:
        alerts.append("overdue_commitments")

    if crm_context["sla_breached"]:
        alerts.append("sla_breach")

    if not crm_context["identity_verified"]:
        alerts.append("identity_not_verified")

    if crm_context["has_urgent_notes"]:
        alerts.append("urgent_note_flag")

    # Priority order: alerts-relevant panels first, then remaining
    priority_order = list(panels_shown)  # Already in logical order

    return {
        "view_mode": view_mode,
        "panels_shown": panels_shown,
        "panels_hidden": panels_hidden,
        "alerts": alerts,
        "data_fetches": data_fetches,
        "priority_order": priority_order,
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# Stratified scenario generation
# ---------------------------------------------------------------------------
def generate_boundary_scenarios(rng):
    """Generate boundary condition scenarios (~800)."""
    scenarios = []

    for tier in (1, 2, 3):
        target = RULE_OF_N_TARGET[tier]
        min_age = MIN_EARLY_AGE[tier]

        # Rule of N at exactly threshold, one below, one above
        for offset in (-1, 0, 1):
            for status in ("active", "retired"):
                svc = round(target - min_age + offset - 2, 1)  # ensure sensible service
                svc = max(5.0, svc)
                age = round(target - svc + offset, 1)
                age = clamp(age, 55, 75)
                # Recalculate service to hit exact target offset
                svc = round(target - age + offset, 1)
                svc = clamp(svc, 5.0, 35.0)
                scenarios.append({
                    "stratum": f"boundary_rule_of_n_{'+' if offset > 0 else ''}{offset}",
                    "overrides": {
                        "tier": tier, "status": status,
                        "age_at_retirement": age,
                        "earned_service_years": svc,
                    },
                })

        # Age at min early retirement, at 65
        for age in (min_age, NORMAL_RETIREMENT_AGE):
            for svc in (5.0, 15.0, 25.0):
                scenarios.append({
                    "stratum": f"boundary_age_{age}",
                    "overrides": {
                        "tier": tier, "status": "active",
                        "age_at_retirement": float(age),
                        "earned_service_years": svc,
                    },
                })

        # Service at exactly 5 years (vesting threshold), at 4.9
        for svc in (4.9, 5.0):
            scenarios.append({
                "stratum": f"boundary_vesting_{svc}",
                "overrides": {
                    "tier": tier, "status": "active",
                    "earned_service_years": svc,
                    "age_at_retirement": 60.0,
                },
            })

    return scenarios


def generate_special_case_scenarios(rng):
    """Generate special case scenarios (~500)."""
    scenarios = []

    # DRO across all tiers and statuses
    for tier in (1, 2, 3):
        for status in ("active", "retired", "deferred", "terminated"):
            scenarios.append({
                "stratum": f"special_dro_t{tier}_{status}",
                "overrides": {"tier": tier, "status": status, "has_dro": True},
            })

    # Purchased service across tiers
    for tier in (1, 2, 3):
        for purch_yrs in (1, 3, 5):
            scenarios.append({
                "stratum": f"special_purchased_t{tier}_{purch_yrs}yr",
                "overrides": {
                    "tier": tier, "status": "active",
                    "has_purchased_service": True, "purchased_years": float(purch_yrs),
                },
            })

    # Leave payout eligible (T1/T2, hired < 2010)
    for tier in (1, 2):
        for status in ("active", "retired"):
            scenarios.append({
                "stratum": f"special_leave_t{tier}_{status}",
                "overrides": {
                    "tier": tier, "status": status,
                    "leave_payout_eligible": True,
                },
            })

    # Military service across tiers
    for tier in (1, 2, 3):
        for mil_yrs in (1, 2, 4):
            scenarios.append({
                "stratum": f"special_military_t{tier}_{mil_yrs}yr",
                "overrides": {
                    "tier": tier, "status": "active",
                    "has_military_service": True, "military_years": float(mil_yrs),
                },
            })

    # All security flag types
    for flag in SECURITY_FLAG_TYPES:
        for tier in (1, 2, 3):
            scenarios.append({
                "stratum": f"special_security_{flag}",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"security_flag": flag},
            })

    # Non-member contact types
    for ct in ("beneficiary", "alternate_payee", "external"):
        for tier in (1, 2, 3):
            for status in ("active", "retired"):
                scenarios.append({
                    "stratum": f"special_contact_{ct}",
                    "overrides": {"tier": tier, "status": status},
                    "crm_overrides": {"contact_type": ct},
                })

    return scenarios


def generate_crm_variation_scenarios(rng):
    """Generate CRM-focused variation scenarios (~500)."""
    scenarios = []

    # SLA breaches
    for tier in (1, 2, 3):
        for convos in (1, 3, 5):
            scenarios.append({
                "stratum": "crm_sla_breach",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"sla_breached": True, "open_conversations": convos},
            })

    # Overdue commitments
    for overdue in (1, 2):
        for tier in (1, 2, 3):
            scenarios.append({
                "stratum": f"crm_overdue_{overdue}",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"overdue_commitments": overdue, "pending_commitments": overdue},
            })

    # Urgent notes
    for tier in (1, 2, 3):
        for status in ("active", "retired"):
            scenarios.append({
                "stratum": "crm_urgent_notes",
                "overrides": {"tier": tier, "status": status},
                "crm_overrides": {"has_urgent_notes": True},
            })

    # Identity not verified
    for tier in (1, 2, 3):
        for status in ("active", "retired", "deferred"):
            scenarios.append({
                "stratum": "crm_identity_unverified",
                "overrides": {"tier": tier, "status": status},
                "crm_overrides": {"identity_verified": False},
            })

    # High interaction counts
    for count in (20, 35, 50):
        for tier in (1, 2, 3):
            scenarios.append({
                "stratum": f"crm_high_interaction_{count}",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"interaction_count": count},
            })

    # Sentiment variations
    for sentiment in ("positive", "neutral", "mixed", "concern"):
        for tier in (1, 2, 3):
            scenarios.append({
                "stratum": f"crm_sentiment_{sentiment}",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"sentiment_trend": sentiment},
            })

    # Channel variations
    for channel, _ in CHANNEL_TYPES:
        for tier in (1, 2, 3):
            scenarios.append({
                "stratum": f"crm_channel_{channel}",
                "overrides": {"tier": tier, "status": "active"},
                "crm_overrides": {"recent_channel": channel},
            })

    return scenarios


def generate_mandatory_strata(rng):
    """Generate mandatory tier x status strata (~1,200 = 12 combos x 100 each)."""
    scenarios = []
    for tier in (1, 2, 3):
        for status in ("active", "retired", "deferred", "terminated"):
            for _ in range(100):
                scenarios.append({
                    "stratum": f"tier{tier}_{status}",
                    "overrides": {"tier": tier, "status": status},
                })
    return scenarios


# ---------------------------------------------------------------------------
# Main generation pipeline
# ---------------------------------------------------------------------------
def build_scenario(rng, scenario_id, stratum, overrides=None, crm_overrides=None):
    """Build a single complete scenario record."""
    profile = generate_member_profile(rng, overrides)
    eligibility = compute_eligibility(profile)
    crm = generate_crm_context(rng, profile, crm_overrides)
    composition = compute_expected_composition(profile, crm, eligibility)

    return {
        "scenario_id": f"S-{scenario_id:05d}",
        "stratum": stratum,
        "member_profile": profile,
        "crm_context": crm,
        "eligibility_snapshot": eligibility,
        "expected_composition": composition,
    }


def generate_all_scenarios(count, seed):
    """Generate the full set of scenarios with stratified sampling."""
    rng = random.Random(seed)
    scenarios = []
    seen_keys = set()

    def scenario_key(s):
        """Create a fingerprint to detect duplicates."""
        p = s["member_profile"]
        c = s["crm_context"]
        return (
            p["tier"], p["status"], p["gender"], p["marital_status"],
            p["age_at_retirement"], p["earned_service_years"],
            p["has_dro"], p["has_purchased_service"], p["has_military_service"],
            c["contact_type"], c["identity_verified"], c["security_flag"],
        )

    def add_scenario(stratum, overrides=None, crm_overrides=None):
        sid = len(scenarios) + 1
        s = build_scenario(rng, sid, stratum, overrides, crm_overrides)
        key = scenario_key(s)
        # Allow duplicates in stratified strata (they differ in random fields)
        scenarios.append(s)
        seen_keys.add(key)

    # Phase 1: Mandatory strata (~1,200)
    mandatory = generate_mandatory_strata(rng)
    for spec in mandatory:
        if len(scenarios) >= count:
            break
        add_scenario(spec["stratum"], spec.get("overrides"), spec.get("crm_overrides"))

    # Phase 2: Boundary scenarios (~800)
    boundary = generate_boundary_scenarios(rng)
    rng.shuffle(boundary)
    for spec in boundary:
        if len(scenarios) >= count:
            break
        add_scenario(spec["stratum"], spec.get("overrides"), spec.get("crm_overrides"))

    # Phase 3: Special cases (~500)
    special = generate_special_case_scenarios(rng)
    rng.shuffle(special)
    for spec in special:
        if len(scenarios) >= count:
            break
        add_scenario(spec["stratum"], spec.get("overrides"), spec.get("crm_overrides"))

    # Phase 4: CRM variations (~500)
    crm_vars = generate_crm_variation_scenarios(rng)
    rng.shuffle(crm_vars)
    for spec in crm_vars:
        if len(scenarios) >= count:
            break
        add_scenario(spec["stratum"], spec.get("overrides"), spec.get("crm_overrides"))

    # Phase 5: Fill remaining with random weighted distribution
    while len(scenarios) < count:
        add_scenario("random")

    # Trim to exact count (stratified phases may have been cut short)
    scenarios = scenarios[:count]

    # Re-number scenario IDs sequentially
    for i, s in enumerate(scenarios):
        s["scenario_id"] = f"S-{i + 1:05d}"

    return scenarios


# ---------------------------------------------------------------------------
# Coverage summary
# ---------------------------------------------------------------------------
def print_coverage_summary(scenarios, file=sys.stderr):
    """Print coverage statistics to stderr."""
    total = len(scenarios)

    tier_counts = {1: 0, 2: 0, 3: 0}
    status_counts = {"active": 0, "retired": 0, "deferred": 0, "terminated": 0}
    elig_counts = {"NORMAL": 0, "EARLY": 0, "DEFERRED": 0, "NOT_ELIGIBLE": 0}
    dro_count = 0
    purchased_count = 0
    leave_count = 0
    security_count = 0
    military_count = 0
    boundary_count = 0
    panel_configs = set()

    for s in scenarios:
        p = s["member_profile"]
        e = s["eligibility_snapshot"]
        c = s["crm_context"]
        comp = s["expected_composition"]

        tier_counts[p["tier"]] += 1
        status_counts[p["status"]] += 1
        elig_counts[e["best_eligible_type"]] += 1

        if p["has_dro"]:
            dro_count += 1
        if p["has_purchased_service"]:
            purchased_count += 1
        if p["leave_payout_eligible"]:
            leave_count += 1
        if c["security_flag"] is not None:
            security_count += 1
        if p["has_military_service"]:
            military_count += 1
        if s["stratum"].startswith("boundary"):
            boundary_count += 1

        panel_configs.add(tuple(sorted(comp["panels_shown"])))

    print(f"\n=== Composition Scenario Coverage ===", file=file)
    print(f"Total: {total:,} | Tiers: T1={tier_counts[1]} T2={tier_counts[2]} T3={tier_counts[3]}", file=file)
    print(f"Status: Active={status_counts['active']} Retired={status_counts['retired']} "
          f"Deferred={status_counts['deferred']} Terminated={status_counts['terminated']}", file=file)
    print(f"Eligibility: Normal={elig_counts['NORMAL']} Early={elig_counts['EARLY']} "
          f"Deferred={elig_counts['DEFERRED']} NotEligible={elig_counts['NOT_ELIGIBLE']}", file=file)
    print(f"DRO={dro_count} | Purchased={purchased_count} | Leave={leave_count} | "
          f"Military={military_count} | Security={security_count}", file=file)
    print(f"Boundary conditions: {boundary_count} | Unique panel configs: {len(panel_configs)}", file=file)
    print(file=file)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Generate deterministic composition scenarios for NoUI"
    )
    parser.add_argument("--count", type=int, default=10000,
                        help="Number of scenarios to generate (default: 10000)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for deterministic output (default: 42)")
    parser.add_argument("--output", type=str, default="compose-scenarios.jsonl",
                        help="Output JSONL file path (default: compose-scenarios.jsonl)")
    args = parser.parse_args()

    print(f"Generating {args.count:,} scenarios (seed={args.seed})...", file=sys.stderr)

    scenarios = generate_all_scenarios(args.count, args.seed)

    with open(args.output, "w") as f:
        for s in scenarios:
            f.write(json.dumps(s, separators=(",", ":")) + "\n")

    print(f"Wrote {len(scenarios):,} scenarios to {args.output}", file=sys.stderr)
    print_coverage_summary(scenarios)


if __name__ == "__main__":
    main()
