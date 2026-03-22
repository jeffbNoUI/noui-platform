#!/usr/bin/env python3
"""
Scenario-driven PAS legacy source data generator.

Outputs SQL INSERT statements to init/02_seed.sql for Docker init.
Schema-qualified table names: src_pas.* for source data, recon.* for reconciliation.
"""

from __future__ import annotations
import argparse
import json
import math
import os
import random
import uuid
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data constants
# ---------------------------------------------------------------------------

FIRST_NAMES = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda",
               "William","Elizabeth","David","Susan","Richard","Jessica","Joseph","Sarah"]
LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
              "Rodriguez","Martinez","Taylor","Anderson"]
CITIES = ["Denver","Helena","Billings","Phoenix","Seattle","Boise","Cheyenne","Salt Lake City"]
STATES = ["CO","MT","WY","UT","WA","AZ","ID"]
EMPLOYERS = [
    ("EMP-101", "State University System", "university", "M", "GRP-A"),
    ("EMP-102", "County Health District", "county", "BW", "GRP-B"),
    ("EMP-103", "Public Schools Consortium", "school_district", "SM", "GRP-A"),
    ("EMP-104", "Transit Operations Authority", "special_district", "BW", "GRP-C"),
]
CASE_TYPES = ["RET_INQUIRY","DEATH","QDRO","REFUND","DISABILITY","ADDRESS_CHANGE"]
STATUS_CODES = ["A","I","R","T"]
JOB_CODES = ["ANL","ADM","ENG","CLK","TRN","NRS","TCH","MGR"]
REL_CODES = ["SP","CH","TR","ES"]
RET_TYPES = ["NORMAL","EARLY","DISABILITY","SURVIVOR"]
OPTION_CODES = ["OPT_A","OPT_B","OPT_C","OPT_D"]

# Reference data for ref tables
REF_PLANS = [
    ("DB-T1", "Defined Benefit Tier 1", "DB", "T1", False, "1970-01-01", None),
    ("DB-T2", "Defined Benefit Tier 2", "DB", "T2", False, "2000-01-01", None),
    ("DB-T3", "Defined Benefit Tier 3", "DB", "T3", False, "2010-01-01", None),
    ("DC-01", "Defined Contribution Plan", "DC", None, False, "1990-01-01", None),
    ("HY-01", "Hybrid Plan", "Hybrid", None, True, "2015-01-01", None),
    ("HEALTH-01", "Retiree Health", "Health", None, False, "1980-01-01", None),
    ("LIFE-01", "Group Life Insurance", "Life", None, False, "1985-01-01", None),
]

REF_STATUS_CODES = [
    ("member", "A", "Active", True),      # ambiguous — also used for employment
    ("member", "I", "Inactive", False),
    ("member", "R", "Retired", False),
    ("member", "T", "Terminated", False),
    ("member", "D", "Deceased", False),
    ("employment", "A", "Active Employment", True),
    ("employment", "L", "Leave of Absence", False),
    ("employment", "T", "Terminated", False),
    ("employment", "S", "Suspended", False),
    ("case", "OPEN", "Open", False),
    ("case", "PEND", "Pending", False),
    ("case", "CLOSED", "Closed", False),
]

REF_TRANSACTION_TYPES = [
    ("REG", "Regular Contribution", True, True, False),
    ("ADJ", "Adjustment", True, True, True),
    ("RETRO", "Retroactive Adjustment", True, True, True),
    ("PUR", "Service Purchase", True, False, False),
    ("REFUND", "Refund", True, False, False),
    ("ROLLOVER", "Rollover", True, False, False),
    ("INT", "Interest Credit", False, False, False),
]

REF_COMPENSATION_TYPES = [
    ("BASE", "Base Salary", True, "base", None),
    ("OT", "Overtime", False, "overtime", "hourly"),
    ("SHIFT", "Shift Differential", True, "special_comp", None),
    ("BONUS", "Bonus", False, "special_comp", None),
    ("RETRO", "Retroactive Pay", True, "base", None),
    ("LEAVE_CO", "Leave Cashout", False, "leave_cashout", None),
]

REF_SERVICE_TYPES = [
    ("EARNED", "Earned Service", False, 1.0),
    ("PURCHASED", "Purchased Service", True, 1.0),
    ("MILITARY", "Military Service", True, 1.0),
    ("PRIOR_GOV", "Prior Government Service", True, 0.5),
    ("LEAVE", "Leave of Absence Service", False, 0.0),
]

REF_RELATIONSHIP_TYPES = [
    ("SP", "Spouse"),
    ("CH", "Child"),
    ("TR", "Trust"),
    ("ES", "Estate"),
    ("DP", "Domestic Partner"),
    ("PR", "Parent"),
]

REF_PAYMENT_OPTIONS = [
    ("OPT_A", "Maximum Single Life Annuity", None, False),
    ("OPT_B", "50% Joint and Survivor", 50.0, False),
    ("OPT_C", "100% Joint and Survivor", 100.0, False),
    ("OPT_D", "10-Year Certain and Life", None, False),
    ("OPT_E", "Pop-Up Joint and Survivor", 50.0, True),
]

SCENARIOS: Dict[str, Dict] = {
    "baseline": {
        "bad_ssn_rate": 0.03,
        "null_email_rate": 0.08,
        "weird_email_rate": 0.06,
        "ambiguous_status_rate": 0.04,
        "balance_mismatch_rate": 0.05,
        "summary_boundary_year": 1995,
        "pre_boundary_granularity": "annual",
        "post_boundary_granularity": "biweekly",
        "missing_period_rate": 0.01,
        "recon_error_rate": 0.06,
        "legacy_bug_rate": 0.01,
        "retro_adjustment_rate": 0.04,
    },
    "multi_migration_legacy": {
        "bad_ssn_rate": 0.06,
        "null_email_rate": 0.18,
        "weird_email_rate": 0.12,
        "ambiguous_status_rate": 0.10,
        "balance_mismatch_rate": 0.11,
        "summary_boundary_year": 1998,
        "pre_boundary_granularity": "annual",
        "post_boundary_granularity": "monthly",
        "missing_period_rate": 0.05,
        "recon_error_rate": 0.14,
        "legacy_bug_rate": 0.03,
        "retro_adjustment_rate": 0.09,
    },
    "code_table_chaos": {
        "bad_ssn_rate": 0.05,
        "null_email_rate": 0.10,
        "weird_email_rate": 0.11,
        "ambiguous_status_rate": 0.18,
        "balance_mismatch_rate": 0.08,
        "summary_boundary_year": 1995,
        "pre_boundary_granularity": "annual",
        "post_boundary_granularity": "biweekly",
        "missing_period_rate": 0.03,
        "recon_error_rate": 0.12,
        "legacy_bug_rate": 0.02,
        "retro_adjustment_rate": 0.05,
    },
    "bad_payroll_system": {
        "bad_ssn_rate": 0.04,
        "null_email_rate": 0.07,
        "weird_email_rate": 0.05,
        "ambiguous_status_rate": 0.05,
        "balance_mismatch_rate": 0.16,
        "summary_boundary_year": 1993,
        "pre_boundary_granularity": "annual",
        "post_boundary_granularity": "biweekly",
        "missing_period_rate": 0.08,
        "recon_error_rate": 0.15,
        "legacy_bug_rate": 0.02,
        "retro_adjustment_rate": 0.16,
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def new_uuid() -> str:
    return str(uuid.uuid4())

def daterange_years(start_year: int, end_year: int):
    for y in range(start_year, end_year + 1):
        yield y

def random_date(y1=1945, y2=2000) -> date:
    start = date(y1, 1, 1)
    end = date(y2, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))

def maybe(p: float) -> bool:
    return random.random() < p

def ssn_for(i: int, bad_rate: float) -> str:
    base = f"{100+i%800:03d}{10+i%89:02d}{1000+i%8999:04d}"
    if maybe(bad_rate):
        bads = [f"XXX-{base[3:5]}-{base[5:]}", base[:-1], f"{base[:3]}-{base[3:5]}-{base[5:]}/", ""]
        return random.choice(bads)
    return base if maybe(0.45) else f"{base[:3]}-{base[3:5]}-{base[5:]}"

def email_for(first: str, last: str, null_rate: float, weird_rate: float) -> str:
    if maybe(null_rate):
        return ""
    normal = f"{first.lower()}.{last.lower()}@example.org"
    if maybe(weird_rate):
        return random.choice([
            f"{first.lower()}..{last.lower()}@example.org",
            f"{first.lower()}_{last.lower()}example.org",
            f" {normal} ",
            normal.upper(),
        ])
    return normal

def sql_str(val) -> str:
    """Format a value for SQL INSERT. Returns NULL, quoted string, or number literal."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val)
    if s == "":
        return "NULL"
    # Escape single quotes
    s = s.replace("'", "''")
    return f"'{s}'"

def sql_date(val) -> str:
    """Format a date for SQL."""
    if val is None or val == "":
        return "NULL"
    if isinstance(val, date):
        return f"'{val.isoformat()}'"
    return f"'{val}'"

def sql_uuid(val) -> str:
    """Format a UUID for SQL."""
    return f"'{val}'"

# ---------------------------------------------------------------------------
# SQL output writer
# ---------------------------------------------------------------------------

class SqlWriter:
    def __init__(self, path: Path):
        self.path = path
        self.lines: List[str] = []
        self.lines.append("-- Generated by generate_pas_scenarios.py")
        self.lines.append("-- DO NOT EDIT — regenerate with: python generate_pas_scenarios.py")
        self.lines.append("")
        self.lines.append("BEGIN;")
        self.lines.append("")

    def comment(self, text: str):
        self.lines.append(f"-- {text}")

    def blank(self):
        self.lines.append("")

    def insert(self, schema: str, table: str, columns: List[str], values: List[str]):
        cols = ", ".join(columns)
        vals = ", ".join(values)
        self.lines.append(f"INSERT INTO {schema}.{table} ({cols}) VALUES ({vals});")

    def finish(self):
        self.lines.append("")
        self.lines.append("COMMIT;")
        self.path.write_text("\n".join(self.lines), encoding="utf-8")
        print(f"Wrote {len(self.lines)} lines to {self.path}")


# ---------------------------------------------------------------------------
# Pay period builder
# ---------------------------------------------------------------------------

def build_pay_periods(start_year: int, end_year: int, post_granularity: str, employers):
    """Build payroll periods and return list of dicts with UUIDs."""
    rows = []
    for emp_id, _, _, _, _ in employers:
        for year in daterange_years(start_year, end_year):
            if post_granularity == "monthly":
                for month in range(1, 13):
                    ps = date(year, month, 1)
                    pe = date(year + (month == 12), (month % 12) + 1, 1) - timedelta(days=1)
                    rows.append({
                        "payroll_period_id": new_uuid(),
                        "employer_id": emp_id,
                        "payroll_year": year,
                        "payroll_number": month,
                        "pay_period_begin_date": ps,
                        "pay_period_end_date": pe,
                        "payroll_check_date": pe + timedelta(days=5),
                        "payroll_frequency_code": "M",
                        "batch_id": f"BATCH-{emp_id}-{year}-{month:02d}",
                    })
            else:  # biweekly
                ps = date(year, 1, 1)
                seq = 1
                while ps.year == year:
                    pe = min(ps + timedelta(days=13), date(year, 12, 31))
                    rows.append({
                        "payroll_period_id": new_uuid(),
                        "employer_id": emp_id,
                        "payroll_year": year,
                        "payroll_number": seq,
                        "pay_period_begin_date": ps,
                        "pay_period_end_date": pe,
                        "payroll_check_date": pe + timedelta(days=5),
                        "payroll_frequency_code": "BW",
                        "batch_id": f"BATCH-{emp_id}-{year}-{seq:02d}",
                    })
                    seq += 1
                    ps = pe + timedelta(days=1)
    return rows


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--members", type=int, default=100)
    ap.add_argument("--scenario", choices=sorted(SCENARIOS.keys()), default="baseline")
    ap.add_argument("--start-year", type=int, default=1988)
    ap.add_argument("--end-year", type=int, default=2025)
    args = ap.parse_args()

    cfg = SCENARIOS[args.scenario]
    script_dir = Path(__file__).resolve().parent
    out_path = script_dir / "init" / "02_seed.sql"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    w = SqlWriter(out_path)

    # =======================================================================
    # Reference data
    # =======================================================================
    w.comment("=========================================================")
    w.comment("Reference data")
    w.comment("=========================================================")
    w.blank()

    # ref_plan
    for plan_code, plan_name, plan_type, tier_code, closed, eff_start, eff_end in REF_PLANS:
        w.insert("src_pas", "ref_plan",
            ["plan_code", "plan_name", "plan_type", "tier_code", "closed_to_new_members",
             "effective_start_date", "effective_end_date"],
            [sql_str(plan_code), sql_str(plan_name), sql_str(plan_type), sql_str(tier_code),
             sql_str(closed), sql_date(eff_start), sql_date(eff_end)])
    w.blank()

    # ref_employer
    for emp_id, emp_name, emp_type, payroll_freq, report_grp in EMPLOYERS:
        w.insert("src_pas", "ref_employer",
            ["employer_id", "employer_name", "employer_type", "payroll_frequency_code",
             "reporting_group_code", "active_flag"],
            [sql_str(emp_id), sql_str(emp_name), sql_str(emp_type), sql_str(payroll_freq),
             sql_str(report_grp), "TRUE"])
    w.blank()

    # ref_status_code
    for domain, code, desc, ambig in REF_STATUS_CODES:
        w.insert("src_pas", "ref_status_code",
            ["domain_name", "status_code", "status_description", "ambiguous_flag"],
            [sql_str(domain), sql_str(code), sql_str(desc), sql_str(ambig)])
    w.blank()

    # ref_transaction_type
    for code, desc, affects_c, affects_s, retro in REF_TRANSACTION_TYPES:
        w.insert("src_pas", "ref_transaction_type",
            ["transaction_type_code", "transaction_description", "affects_contributions",
             "affects_service", "retro_adjustment_flag"],
            [sql_str(code), sql_str(desc), sql_str(affects_c), sql_str(affects_s), sql_str(retro)])
    w.blank()

    # ref_compensation_type
    for code, desc, pens, grp, proration in REF_COMPENSATION_TYPES:
        w.insert("src_pas", "ref_compensation_type",
            ["comp_type_code", "comp_type_description", "pensionable_flag",
             "compensation_group", "default_proration_rule"],
            [sql_str(code), sql_str(desc), sql_str(pens), sql_str(grp), sql_str(proration)])
    w.blank()

    # ref_service_type
    for code, desc, purchase, mult in REF_SERVICE_TYPES:
        w.insert("src_pas", "ref_service_type",
            ["service_type_code", "service_type_description", "purchase_eligible_flag",
             "credit_multiplier"],
            [sql_str(code), sql_str(desc), sql_str(purchase), str(mult)])
    w.blank()

    # ref_relationship_type
    for code, desc in REF_RELATIONSHIP_TYPES:
        w.insert("src_pas", "ref_relationship_type",
            ["relationship_type_code", "relationship_description"],
            [sql_str(code), sql_str(desc)])
    w.blank()

    # ref_payment_option
    for code, desc, surv_pct, popup in REF_PAYMENT_OPTIONS:
        w.insert("src_pas", "ref_payment_option",
            ["payment_option_code", "payment_option_description", "survivor_percentage",
             "pop_up_flag"],
            [sql_str(code), sql_str(desc), str(surv_pct) if surv_pct is not None else "NULL",
             sql_str(popup)])
    w.blank()

    # =======================================================================
    # Payroll periods
    # =======================================================================
    w.comment("=========================================================")
    w.comment("Payroll periods")
    w.comment("=========================================================")
    w.blank()

    pay_periods = build_pay_periods(
        cfg["summary_boundary_year"], args.end_year,
        cfg["post_boundary_granularity"], EMPLOYERS)

    for p in pay_periods:
        w.insert("src_pas", "payroll_period",
            ["payroll_period_id", "employer_id", "payroll_year", "payroll_number",
             "pay_period_begin_date", "pay_period_end_date", "payroll_check_date",
             "payroll_frequency_code", "batch_id"],
            [sql_uuid(p["payroll_period_id"]), sql_str(p["employer_id"]),
             str(p["payroll_year"]), str(p["payroll_number"]),
             sql_date(p["pay_period_begin_date"]), sql_date(p["pay_period_end_date"]),
             sql_date(p["payroll_check_date"]), sql_str(p["payroll_frequency_code"]),
             sql_str(p["batch_id"])])

    periods_by_employer_year = defaultdict(list)
    for p in pay_periods:
        periods_by_employer_year[(p["employer_id"], p["payroll_year"])].append(p)

    w.blank()

    # =======================================================================
    # Members + dependent data
    # =======================================================================
    w.comment("=========================================================")
    w.comment("Members and transactional data")
    w.comment("=========================================================")
    w.blank()

    counts = defaultdict(int)

    for member_idx in range(1, args.members + 1):
        member_id = new_uuid()
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        birth = random_date(1948, 1998)
        hire_year = random.randint(args.start_year, min(args.end_year - 8, 2018))
        hire_dt = random_date(hire_year, hire_year)
        employer_id, employer_name, _, _, _ = random.choice(EMPLOYERS)
        legacy_no = f"M{member_idx:07d}"
        status = random.choice(STATUS_CODES)
        if maybe(cfg["ambiguous_status_rate"]):
            status = "A"
        tier = random.choice(["TIER1", "TIER2", "TIER3"])
        plan_code = {"TIER1": "DB-T1", "TIER2": "DB-T2", "TIER3": "DB-T3"}[tier]

        ssn_raw = ssn_for(member_idx, cfg["bad_ssn_rate"])
        ssn_norm = ssn_raw.replace("-", "").replace("/", "").strip() if ssn_raw else None
        email = email_for(first, last, cfg["null_email_rate"], cfg["weird_email_rate"])
        phone = f"555{random.randint(1000000,9999999)}"
        gender = random.choice(["M", "F", "U"])
        middle = "" if maybe(0.3) else chr(65 + member_idx % 26)
        termination_date = None if maybe(0.7) else random_date(max(hire_year + 1, 1990), args.end_year)
        deceased = maybe(0.02)
        dod = random_date(2015, args.end_year) if deceased else None

        # -- member
        w.insert("src_pas", "member",
            ["member_id", "legacy_member_number", "ssn_raw", "ssn_normalized", "tin_last4",
             "first_name", "middle_name", "last_name", "date_of_birth", "date_of_death",
             "gender_code", "member_status_code", "member_status_as_of",
             "original_membership_date", "retirement_system_entry_date",
             "data_quality_score"],
            [sql_uuid(member_id), sql_str(legacy_no), sql_str(ssn_raw),
             sql_str(ssn_norm), sql_str(ssn_norm[-4:] if ssn_norm and len(ssn_norm) >= 4 else None),
             sql_str(first), sql_str(middle), sql_str(last),
             sql_date(birth), sql_date(dod),
             sql_str(gender), sql_str(status), sql_date(hire_dt),
             sql_date(hire_dt), sql_date(hire_dt),
             str(round(random.uniform(60, 100), 2))])
        counts["member"] += 1

        # -- member_address
        addr_id = new_uuid()
        city = random.choice(CITIES)
        state = random.choice(STATES)
        w.insert("src_pas", "member_address",
            ["member_address_id", "member_id", "address_type_code", "line1", "city",
             "state_code", "postal_code", "country_code", "current_flag"],
            [sql_uuid(addr_id), sql_uuid(member_id), sql_str("home"),
             sql_str(f"{random.randint(100,9999)} Main St"), sql_str(city),
             sql_str(state), sql_str(f"{random.randint(10000,99999)}"),
             sql_str("US"), "TRUE"])
        counts["member_address"] += 1

        # -- member_contact (email + phone)
        if email:
            w.insert("src_pas", "member_contact",
                ["member_contact_id", "member_id", "contact_type_code", "contact_value",
                 "preferred_flag"],
                [sql_uuid(new_uuid()), sql_uuid(member_id), sql_str("email"),
                 sql_str(email), "TRUE"])
            counts["member_contact"] += 1
        w.insert("src_pas", "member_contact",
            ["member_contact_id", "member_id", "contact_type_code", "contact_value",
             "preferred_flag"],
            [sql_uuid(new_uuid()), sql_uuid(member_id), sql_str("home_phone"),
             sql_str(phone), "FALSE"])
        counts["member_contact"] += 1

        # -- employment_segment
        emp_seg_id = new_uuid()
        fte = random.choice([0.5, 0.75, 0.8, 1.0])
        w.insert("src_pas", "employment_segment",
            ["employment_segment_id", "member_id", "employer_id", "plan_code", "tier_code",
             "job_class_code", "employment_status_code", "full_time_equivalent",
             "original_hire_date", "segment_start_date", "segment_end_date",
             "source_migration_era", "estimated_flag"],
            [sql_uuid(emp_seg_id), sql_uuid(member_id), sql_str(employer_id),
             sql_str(plan_code), sql_str(tier),
             sql_str(random.choice(JOB_CODES)), sql_str(status), str(fte),
             sql_date(hire_dt), sql_date(hire_dt),
             sql_date(termination_date),
             sql_str("post_1995_detail"), "FALSE"])
        counts["employment_segment"] += 1

        # -- migration_boundary_inference
        w.insert("src_pas", "migration_boundary_inference",
            ["boundary_id", "employer_id", "member_id", "domain_name",
             "inferred_boundary_date", "evidence_type", "evidence_score"],
            [sql_uuid(new_uuid()), sql_str(employer_id), sql_uuid(member_id),
             sql_str(random.choice(["salary", "contributions", "employment"])),
             sql_date(date(cfg["summary_boundary_year"], 1, 1)),
             sql_str(random.choice(["granularity_shift", "null_spike", "code_change"])),
             str(round(random.uniform(0.72, 0.99), 4))])
        counts["migration_boundary_inference"] += 1

        # -- salary, contribution, service histories
        base_annual = round(random.randint(32000, 145000), 2)
        running_balance = 0.0
        retiree = maybe(0.28)
        retirement_date = None
        total_service = 0.0
        recent_salaries = []

        for year in range(hire_year, args.end_year + 1):
            if year < cfg["summary_boundary_year"]:
                # Pre-boundary: annual summary rows
                annual_amount = round(base_annual * random.uniform(0.88, 1.15), 2)
                sal_id = new_uuid()

                w.insert("src_pas", "salary_history",
                    ["salary_history_id", "member_id", "employment_segment_id",
                     "salary_granularity", "period_begin_date", "period_end_date",
                     "reportable_earnings", "pensionable_earnings",
                     "standard_hours", "summarized_flag", "estimated_flag"],
                    [sql_uuid(sal_id), sql_uuid(member_id), sql_uuid(emp_seg_id),
                     sql_str("annual"), sql_date(date(year, 1, 1)), sql_date(date(year, 12, 31)),
                     str(annual_amount), str(annual_amount),
                     "2080", "TRUE", "TRUE" if maybe(0.12) else "FALSE"])
                counts["salary_history"] += 1

                # salary component
                w.insert("src_pas", "salary_component",
                    ["salary_component_id", "salary_history_id", "comp_type_code",
                     "amount", "pensionable_flag"],
                    [sql_uuid(new_uuid()), sql_uuid(sal_id), sql_str("BASE"),
                     str(annual_amount), "TRUE"])
                counts["salary_component"] += 1

                # contribution
                rate = random.choice([0.075, 0.08, 0.0845, 0.09])
                employee_c = round(annual_amount * rate, 2)
                employer_c = round(employee_c * random.uniform(1.2, 1.8), 2)
                expected_bal = round(running_balance + employee_c + employer_c, 2)
                stored_bal = expected_bal
                if maybe(cfg["balance_mismatch_rate"]):
                    stored_bal = round(expected_bal + random.uniform(-125.0, 125.0), 2)

                w.insert("src_pas", "contribution_history",
                    ["contribution_history_id", "member_id", "employment_segment_id",
                     "transaction_type_code", "contribution_granularity",
                     "contribution_begin_date", "contribution_end_date",
                     "member_contribution_amount", "employer_contribution_amount",
                     "summarized_flag", "estimated_flag", "running_balance_amount",
                     "row_balance_check_amount"],
                    [sql_uuid(new_uuid()), sql_uuid(member_id), sql_uuid(emp_seg_id),
                     sql_str("REG"), sql_str("annual"),
                     sql_date(date(year, 1, 1)), sql_date(date(year, 12, 31)),
                     str(employee_c), str(employer_c),
                     "TRUE", "TRUE" if maybe(0.12) else "FALSE",
                     str(stored_bal), str(expected_bal)])
                counts["contribution_history"] += 1
                running_balance = stored_bal

                # service credit
                svc_years = round(random.uniform(0.75, 1.05), 4)
                total_service += svc_years
                w.insert("src_pas", "service_credit_history",
                    ["service_credit_history_id", "member_id", "employment_segment_id",
                     "service_type_code", "granularity",
                     "service_begin_date", "service_end_date",
                     "service_units", "service_unit_type", "credited_service_years",
                     "summarized_flag", "estimated_flag"],
                    [sql_uuid(new_uuid()), sql_uuid(member_id), sql_uuid(emp_seg_id),
                     sql_str("EARNED"), sql_str("annual"),
                     sql_date(date(year, 1, 1)), sql_date(date(year, 12, 31)),
                     "1", sql_str("years"), str(svc_years),
                     "TRUE", "TRUE" if maybe(0.15) else "FALSE"])
                counts["service_credit_history"] += 1

            else:
                # Post-boundary: period-level detail
                periods = periods_by_employer_year.get((employer_id, year), [])
                if not periods:
                    continue
                annual_increase = random.uniform(0.99, 1.045)
                base_annual = round(base_annual * annual_increase, 2)

                for p in periods:
                    if maybe(cfg["missing_period_rate"]):
                        continue
                    factor = 1.0 / len(periods)
                    amt = round(base_annual * factor * random.uniform(0.96, 1.04), 2)
                    sal_id = new_uuid()
                    sal_type = random.choice(["REG", "OT", "REG", "REG", "BON"])

                    w.insert("src_pas", "salary_history",
                        ["salary_history_id", "member_id", "employment_segment_id",
                         "payroll_period_id", "salary_granularity",
                         "period_begin_date", "period_end_date",
                         "reportable_earnings", "pensionable_earnings",
                         "standard_hours", "summarized_flag", "estimated_flag"],
                        [sql_uuid(sal_id), sql_uuid(member_id), sql_uuid(emp_seg_id),
                         sql_uuid(p["payroll_period_id"]), sql_str("pay_period"),
                         sql_date(p["pay_period_begin_date"]), sql_date(p["pay_period_end_date"]),
                         str(amt), str(amt),
                         str(round(2080 / len(periods), 2)),
                         "FALSE", "TRUE" if maybe(0.02) else "FALSE"])
                    counts["salary_history"] += 1
                    recent_salaries.append(amt)

                    # salary components
                    reg_amt = round(amt * random.uniform(0.88, 0.98), 2)
                    w.insert("src_pas", "salary_component",
                        ["salary_component_id", "salary_history_id", "comp_type_code",
                         "amount", "pensionable_flag"],
                        [sql_uuid(new_uuid()), sql_uuid(sal_id), sql_str("BASE"),
                         str(reg_amt), "TRUE"])
                    counts["salary_component"] += 1

                    remaining = round(amt - reg_amt, 2)
                    if remaining != 0:
                        comp_code = random.choice(["OT", "SHIFT", "BONUS"])
                        w.insert("src_pas", "salary_component",
                            ["salary_component_id", "salary_history_id", "comp_type_code",
                             "amount", "pensionable_flag"],
                            [sql_uuid(new_uuid()), sql_uuid(sal_id), sql_str(comp_code),
                             str(remaining), sql_str(comp_code != "BONUS")])
                        counts["salary_component"] += 1

                    if maybe(cfg["retro_adjustment_rate"]):
                        adj_amt = round(amt * random.uniform(-0.08, 0.08), 2)
                        w.insert("src_pas", "salary_component",
                            ["salary_component_id", "salary_history_id", "comp_type_code",
                             "amount", "pensionable_flag"],
                            [sql_uuid(new_uuid()), sql_uuid(sal_id), sql_str("RETRO"),
                             str(adj_amt), "TRUE"])
                        counts["salary_component"] += 1

                    # contribution
                    rate = random.choice([0.075, 0.08, 0.0845, 0.09])
                    employee_c = round(amt * rate, 2)
                    employer_c = round(employee_c * random.uniform(1.1, 1.9), 2)
                    expected_bal = round(running_balance + employee_c + employer_c, 2)
                    stored_bal = expected_bal
                    if maybe(cfg["balance_mismatch_rate"]):
                        stored_bal = round(expected_bal + random.uniform(-50.0, 50.0), 2)

                    w.insert("src_pas", "contribution_history",
                        ["contribution_history_id", "member_id", "employment_segment_id",
                         "payroll_period_id", "transaction_type_code",
                         "contribution_granularity",
                         "contribution_begin_date", "contribution_end_date",
                         "member_contribution_amount", "employer_contribution_amount",
                         "summarized_flag", "estimated_flag",
                         "running_balance_amount", "row_balance_check_amount"],
                        [sql_uuid(new_uuid()), sql_uuid(member_id), sql_uuid(emp_seg_id),
                         sql_uuid(p["payroll_period_id"]), sql_str("REG"),
                         sql_str("pay_period"),
                         sql_date(p["pay_period_begin_date"]), sql_date(p["pay_period_end_date"]),
                         str(employee_c), str(employer_c),
                         "FALSE", "FALSE",
                         str(stored_bal), str(expected_bal)])
                    counts["contribution_history"] += 1
                    running_balance = stored_bal

                    # service credit
                    svc = round(1.0 / len(periods), 6)
                    total_service += svc
                    w.insert("src_pas", "service_credit_history",
                        ["service_credit_history_id", "member_id", "employment_segment_id",
                         "service_type_code", "granularity",
                         "service_begin_date", "service_end_date",
                         "service_units", "service_unit_type", "credited_service_years",
                         "summarized_flag", "estimated_flag"],
                        [sql_uuid(new_uuid()), sql_uuid(member_id), sql_uuid(emp_seg_id),
                         sql_str("EARNED"), sql_str("pay_period"),
                         sql_date(p["pay_period_begin_date"]), sql_date(p["pay_period_end_date"]),
                         "1", sql_str("years"), str(svc),
                         "FALSE", "FALSE"])
                    counts["service_credit_history"] += 1

        # -- beneficiaries
        for _ in range(random.choice([1, 1, 1, 2, 2, 3])):
            bene_first = random.choice(FIRST_NAMES)
            bene_last = random.choice(LAST_NAMES)
            rel = random.choice(REL_CODES)
            w.insert("src_pas", "beneficiary",
                ["beneficiary_id", "member_id", "beneficiary_type_code",
                 "relationship_type_code", "first_name", "last_name",
                 "date_of_birth", "percentage_allocation", "contingent_flag"],
                [sql_uuid(new_uuid()), sql_uuid(member_id),
                 sql_str("primary" if maybe(0.7) else "contingent"),
                 sql_str(rel), sql_str(bene_first), sql_str(bene_last),
                 sql_date(random_date(1940, 2015)),
                 str(random.choice([25, 50, 100])),
                 "FALSE" if maybe(0.7) else "TRUE"])
            counts["beneficiary"] += 1

        # -- DRO
        if maybe(0.08):
            w.insert("src_pas", "domestic_relations_order",
                ["dro_id", "member_id", "alternate_payee_name", "order_type_code",
                 "order_status_code", "order_received_date", "order_effective_date",
                 "case_number", "segregated_percentage"],
                [sql_uuid(new_uuid()), sql_uuid(member_id),
                 sql_str(f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"),
                 sql_str(random.choice(["QDRO", "DRO"])),
                 sql_str(random.choice(["OPEN", "ACTIVE", "CLOSED"])),
                 sql_date(random_date(max(hire_year, 1990), args.end_year)),
                 sql_date(random_date(max(hire_year, 1990), args.end_year)),
                 sql_str(f"C{member_idx:06d}"),
                 str(round(random.uniform(10, 50), 4))])
            counts["domestic_relations_order"] += 1

        # -- cases
        for _ in range(random.choice([0, 1, 1, 2])):
            opened = random_date(max(hire_year, 1990), args.end_year)
            closed = None if maybe(0.4) else opened + timedelta(days=random.randint(7, 300))
            w.insert("src_pas", "case_management",
                ["case_id", "member_id", "case_type_code", "case_status_code",
                 "opened_date", "closed_date", "assigned_team", "priority_code"],
                [sql_uuid(new_uuid()), sql_uuid(member_id),
                 sql_str(random.choice(CASE_TYPES)),
                 sql_str(random.choice(["OPEN", "PEND", "CLOSED"])),
                 sql_date(opened), sql_date(closed),
                 sql_str(random.choice(["Ops", "Benefits", "Legal", "Payroll"])),
                 sql_str(random.choice(["L", "M", "H"]))])
            counts["case_management"] += 1

        # -- retirement award + payments + reconciliation
        if retiree and max(hire_year + 15, 2005) <= args.end_year:
            retirement_date = random_date(max(hire_year + 15, 2005), args.end_year)
            final_avg_salary = (
                round(sum(sorted(recent_salaries)[-36:]) / min(36, max(1, len(sorted(recent_salaries)[-36:]))), 2)
                if recent_salaries else round(base_annual / 12, 2)
            )
            # Tier-specific multiplier from plan-config.yaml
            multiplier = 0.015 if tier in ("TIER2", "TIER3") else 0.020
            gross = final_avg_salary * total_service * multiplier / 12.0
            # Early retirement reduction tables from plan-config.yaml
            REDUCTION_T12 = {55:0.70, 56:0.73, 57:0.76, 58:0.79, 59:0.82,
                             60:0.85, 61:0.88, 62:0.91, 63:0.94, 64:0.97, 65:1.00}
            REDUCTION_T3 = {60:0.70, 61:0.76, 62:0.82, 63:0.88, 64:0.94, 65:1.00}
            red_table = REDUCTION_T3 if tier == "TIER3" else REDUCTION_T12
            age_at_ret = (retirement_date - birth).days / 365.25
            age_int = int(age_at_ret)
            reduction = red_table.get(age_int, 1.0 if age_int >= 65 else 0.0)
            benefit = max(round(gross * reduction, 2), 800.0)
            award_id = new_uuid()
            option_code = random.choice(OPTION_CODES)

            w.insert("src_pas", "retirement_award",
                ["award_id", "member_id", "plan_code", "retirement_type_code",
                 "commencement_date", "retirement_date", "final_average_salary",
                 "credited_service_years", "accrual_factor", "early_reduction_factor",
                 "payment_option_code", "gross_monthly_benefit", "cola_eligibility_flag",
                 "legacy_calc_version", "calculation_as_of_date"],
                [sql_uuid(award_id), sql_uuid(member_id), sql_str(plan_code),
                 sql_str(random.choice(RET_TYPES)),
                 sql_date(retirement_date), sql_date(retirement_date),
                 str(final_avg_salary), str(round(total_service, 4)),
                 str(multiplier), str(round(reduction, 4)),
                 sql_str(option_code), str(benefit),
                 "TRUE" if maybe(0.6) else "FALSE",
                 sql_str("v2"), sql_date(retirement_date)])
            counts["retirement_award"] += 1

            # payments
            for m in range(1, random.randint(3, 18)):
                pay_dt = date(
                    retirement_date.year + ((retirement_date.month - 1 + m) // 12),
                    ((retirement_date.month - 1 + m) % 12) + 1, 1)
                gross = benefit
                if maybe(0.05):
                    gross = round(gross + random.uniform(-10, 10), 2)
                tax = round(gross * 0.12, 2)
                net = round(gross - tax, 2)
                w.insert("src_pas", "benefit_payment",
                    ["benefit_payment_id", "award_id", "member_id", "payment_date",
                     "gross_amount", "tax_withholding_amount", "net_amount",
                     "payment_status_code", "payment_method_code"],
                    [sql_uuid(new_uuid()), sql_uuid(award_id), sql_uuid(member_id),
                     sql_date(pay_dt),
                     str(gross), str(tax), str(net),
                     sql_str(random.choice(["PAID", "PAID", "HELD"])),
                     sql_str(random.choice(["ACH", "CHECK"]))])
                counts["benefit_payment"] += 1

            # -- legacy_calculation_snapshot (recon schema)
            recomputed = benefit
            legacy_val = recomputed
            if maybe(cfg["recon_error_rate"]):
                legacy_val = round(recomputed + random.uniform(-125.0, 125.0), 2)

            calc_name = random.choice(["fas36", "monthly_benefit", "service_total"])
            if calc_name == "fas36":
                recomputed = final_avg_salary
                legacy_val = (recomputed if not maybe(cfg["recon_error_rate"])
                              else round(recomputed + random.uniform(-250.0, 250.0), 2))
            elif calc_name == "service_total":
                recomputed = round(total_service, 4)
                legacy_val = (recomputed if not maybe(cfg["recon_error_rate"])
                              else round(recomputed + random.uniform(-1.5, 1.5), 4))

            snapshot_id = new_uuid()
            tolerance = 0.01 if calc_name == "monthly_benefit" else 0.50
            w.insert("recon", "legacy_calculation_snapshot",
                ["legacy_snapshot_id", "member_id", "valuation_date",
                 "source_system_name", "calc_context_code",
                 "expected_value_numeric", "tolerance_amount", "calc_version"],
                [sql_uuid(snapshot_id), sql_uuid(member_id),
                 sql_date(retirement_date), sql_str("PAS_LEGACY"),
                 sql_str(calc_name),
                 str(legacy_val), str(tolerance), sql_str("v2")])
            counts["legacy_calculation_snapshot"] += 1

            # -- reconciliation_result
            variance = round(legacy_val - recomputed, 4)
            classification = "exact" if abs(variance) < 0.01 else (
                "within_tolerance" if abs(variance) < tolerance else (
                    "systematic" if abs(variance) > 25 else "unexplained"))
            suspected_domain = random.choice(["salary", "dates", "service", "contributions"])
            if maybe(cfg["legacy_bug_rate"]):
                suspected_domain = "legacy_bug"
                classification = "systematic"
            recon_result_id = new_uuid()
            w.insert("recon", "reconciliation_result",
                ["reconciliation_result_id", "member_id", "valuation_date",
                 "calc_context_code", "expected_value_numeric", "actual_value_numeric",
                 "variance_numeric", "variance_classification",
                 "suspected_domain", "legacy_bug_suspected_flag", "triage_status_code"],
                [sql_uuid(recon_result_id), sql_uuid(member_id),
                 sql_date(retirement_date), sql_str(calc_name),
                 str(legacy_val), str(recomputed), str(variance),
                 sql_str(classification), sql_str(suspected_domain),
                 "TRUE" if suspected_domain == "legacy_bug" else "FALSE",
                 sql_str("new")])
            counts["reconciliation_result"] += 1

            # -- reconciliation_evidence
            w.insert("recon", "reconciliation_evidence",
                ["reconciliation_evidence_id", "reconciliation_result_id",
                 "evidence_rank", "evidence_type", "evidence_reference"],
                [sql_uuid(new_uuid()), sql_uuid(recon_result_id),
                 "1",
                 sql_str(random.choice(["input_trace", "rule_path", "source_field", "anomaly"])),
                 sql_str(f"Candidate issue in {suspected_domain} domain")])
            counts["reconciliation_evidence"] += 1

    w.blank()
    w.comment("=========================================================")
    w.comment(f"Seed complete. {args.members} members, scenario={args.scenario}")
    w.comment(f"Table counts: {json.dumps(dict(counts))}")
    w.comment("=========================================================")

    w.finish()

    # Print manifest to stdout
    manifest = {
        "scenario": args.scenario,
        "config": cfg,
        "members": args.members,
        "table_counts": dict(counts),
    }
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
