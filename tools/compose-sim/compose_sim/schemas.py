"""Pydantic models matching the compose-scenarios.jsonl structure."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class Panel(str, Enum):
    MEMBER_BANNER = "member_banner"
    SERVICE_CREDIT_SUMMARY = "service_credit_summary"
    BENEFIT_CALCULATION = "benefit_calculation"
    PAYMENT_OPTIONS = "payment_options"
    DRO_IMPACT = "dro_impact"
    SCENARIO_MODELER = "scenario_modeler"
    DEATH_BENEFIT = "death_benefit"
    IPR_CALCULATOR = "ipr_calculator"
    EMPLOYMENT_TIMELINE = "employment_timeline"
    CASE_JOURNAL = "case_journal"
    AI_SUMMARY = "ai_summary"
    CRM_NOTE_FORM = "crm_note_form"


class Alert(str, Enum):
    SPOUSAL_CONSENT_REQUIRED = "spousal_consent_required"
    EARLY_RETIREMENT_REDUCTION = "early_retirement_reduction"
    LEAVE_PAYOUT_AMS_BOOST = "leave_payout_ams_boost"
    PURCHASED_SERVICE_WARNING = "purchased_service_warning"
    DRO_DEDUCTION_ACTIVE = "dro_deduction_active"
    NOT_VESTED = "not_vested"
    MEDICARE_IPR_HIGHLIGHT = "medicare_ipr_highlight"
    WAITING_INCREASES_BENEFIT = "waiting_increases_benefit"
    RULE_OF_N_NEAR_THRESHOLD = "rule_of_n_near_threshold"
    SECURITY_FLAG_WARNING = "security_flag_warning"
    OVERDUE_COMMITMENTS = "overdue_commitments"
    SLA_BREACH = "sla_breach"
    IDENTITY_NOT_VERIFIED = "identity_not_verified"
    URGENT_NOTE_FLAG = "urgent_note_flag"


class DataFetch(str, Enum):
    MEMBER_DATA = "member_data"
    SERVICE_CREDIT = "service_credit"
    BENEFIT_CALCULATION = "benefit_calculation"
    EMPLOYMENT_HISTORY = "employment_history"
    PAYMENT_OPTIONS = "payment_options"
    SCENARIO_PROJECTION = "scenario_projection"
    CRM_CONTACT = "crm_contact"
    CRM_CONVERSATIONS = "crm_conversations"
    CRM_COMMITMENTS = "crm_commitments"
    CRM_INTERACTIONS = "crm_interactions"
    CRM_OUTREACH = "crm_outreach"


class ViewMode(str, Enum):
    WORKSPACE = "workspace"
    CRM = "crm"


class ContactType(str, Enum):
    MEMBER = "member"
    BENEFICIARY = "beneficiary"
    ALTERNATE_PAYEE = "alternate_payee"
    EXTERNAL = "external"


class EligibilityType(str, Enum):
    NORMAL = "NORMAL"
    EARLY = "EARLY"
    DEFERRED = "DEFERRED"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"


class MemberStatus(str, Enum):
    ACTIVE = "active"
    RETIRED = "retired"
    DEFERRED = "deferred"
    TERMINATED = "terminated"


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------
class MemberProfile(BaseModel):
    tier: int = Field(ge=1, le=3)
    status: MemberStatus
    gender: str
    marital_status: str
    age_at_retirement: float
    earned_service_years: float
    has_purchased_service: bool
    purchased_years: float = 0.0
    has_military_service: bool
    military_years: float = 0.0
    has_dro: bool
    dro_division_pct: float = 0.0
    leave_payout_eligible: bool
    leave_payout_amount: float = 0.0
    medicare_flag: str
    has_employment_history: bool
    employment_event_count: int = 0
    vested: bool
    middle_name: Optional[str] = None
    hire_date: str
    total_service_years: float
    eligibility_years: float


class CRMContext(BaseModel):
    contact_type: ContactType
    identity_verified: bool
    security_flag: Optional[str] = None
    has_legacy_member_id: bool
    open_conversations: int = 0
    pending_commitments: int = 0
    overdue_commitments: int = 0
    interaction_count: int = 0
    recent_channel: str
    sla_breached: bool = False
    has_urgent_notes: bool = False
    sentiment_trend: str = "neutral"


class EligibilitySnapshot(BaseModel):
    best_eligible_type: EligibilityType
    rule_of_n_sum: float
    rule_of_n_target: int
    rule_of_n_met: bool
    reduction_applies: bool
    reduction_pct: float = 0.0
    vested: bool
    leave_payout_ams_impact: float = 0.0
    rule_of_n_near: bool = False


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------
class ExpectedComposition(BaseModel):
    view_mode: ViewMode
    panels_shown: list[str]
    panels_hidden: list[str]
    alerts: list[str]
    data_fetches: list[str]
    priority_order: list[str]
    rationale: dict[str, str]


class AIComposition(BaseModel):
    """Output from the AI composer (tool_use result)."""
    view_mode: ViewMode
    panels_shown: list[str]
    panels_hidden: list[str]
    alerts: list[str]
    data_fetches: list[str]
    rationale: dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Top-level scenario
# ---------------------------------------------------------------------------
class Scenario(BaseModel):
    scenario_id: str
    stratum: str
    member_profile: MemberProfile
    crm_context: CRMContext
    eligibility_snapshot: EligibilitySnapshot
    expected_composition: ExpectedComposition


# ---------------------------------------------------------------------------
# Evaluation result
# ---------------------------------------------------------------------------
class ScenarioResult(BaseModel):
    scenario_id: str
    stratum: str
    expected: ExpectedComposition
    actual: AIComposition
    view_mode_correct: bool = False
    panels_exact_match: bool = False
    panels_jaccard: float = 0.0
    panels_precision: float = 0.0
    panels_recall: float = 0.0
    alerts_exact_match: bool = False
    alerts_jaccard: float = 0.0
    alerts_precision: float = 0.0
    alerts_recall: float = 0.0
    fetches_exact_match: bool = False
    fetches_jaccard: float = 0.0
    composite_score: float = 0.0
    error_types: list[str] = Field(default_factory=list)
    missing_panels: list[str] = Field(default_factory=list)
    extra_panels: list[str] = Field(default_factory=list)
    missing_alerts: list[str] = Field(default_factory=list)
    extra_alerts: list[str] = Field(default_factory=list)
    error_message: Optional[str] = None


class AggregateMetrics(BaseModel):
    total_scenarios: int = 0
    view_mode_accuracy: float = 0.0
    panels_exact_accuracy: float = 0.0
    panels_mean_jaccard: float = 0.0
    panels_mean_precision: float = 0.0
    panels_mean_recall: float = 0.0
    alerts_exact_accuracy: float = 0.0
    alerts_mean_jaccard: float = 0.0
    alerts_mean_precision: float = 0.0
    alerts_mean_recall: float = 0.0
    fetches_exact_accuracy: float = 0.0
    fetches_mean_jaccard: float = 0.0
    mean_composite_score: float = 0.0
    error_type_counts: dict[str, int] = Field(default_factory=dict)
    api_errors: int = 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
ALL_PANELS = [p.value for p in Panel]
ALL_ALERTS = [a.value for a in Alert]
ALL_DATA_FETCHES = [d.value for d in DataFetch]
