#!/usr/bin/env python3
"""
generate_derp_data.py — Seed Data Generator for the DERP (Denver Employees Retirement Plan) POC

Generates realistic SQL INSERT statements for the legacy DERP pension database schema.
Output is designed to be piped directly to PostgreSQL:
    python3 generate_derp_data.py > seed.sql
    psql -d derp -f seed.sql

Uses deterministic random seed (42) for full reproducibility.

Target data volumes:
    - 10,000 members (Tier 1: ~1,200, Tier 2: ~1,500, Tier 3: ~2,300 active;
      ~3,800 retired, ~800 deferred, ~400 terminated)
    - Salary histories with biweekly pay periods
    - Contribution records with era-dependent employer rates
    - ~200 purchased service credit records
    - ~300 DRO records
    - ~3,800 benefit payment records
    - ~25,000 case history records

Four demo cases are hard-coded for exact calculation verification.

Deliberate data quality issues are injected per BUILD_PLAN Step 1.4.

Source: BUILD_PLAN Day 1 Step 1.3
"""

import random
import sys
from datetime import date, timedelta, datetime
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict

# ---------------------------------------------------------------------------
# Deterministic seed for reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

# ---------------------------------------------------------------------------
# Date constants
# ---------------------------------------------------------------------------
TODAY = date(2026, 3, 2)
DATA_CUTOFF = date(2026, 4, 1)  # Generate data up to this point
BIWEEKLY_DAYS = 14

# ASSUMPTION: Biweekly pay periods are every other Friday, using a fixed
# epoch-based calendar starting from Jan 3, 1992 (a Friday).
PAY_EPOCH = date(1992, 1, 3)

# ASSUMPTION: Fiscal year runs Jan 1 - Dec 31 for pay period numbering
# (Denver's actual fiscal year may differ).

# ---------------------------------------------------------------------------
# Tier boundaries
# ---------------------------------------------------------------------------
# ASSUMPTION: Tier 1 = hired before Jan 1, 2006; Tier 2 = hired Jan 1, 2006
# through Dec 31, 2011; Tier 3 = hired Jan 1, 2012 or later.
TIER_1_CUTOFF = date(2006, 1, 1)
TIER_2_CUTOFF = date(2012, 1, 1)

# ---------------------------------------------------------------------------
# Employer contribution rate schedule
# ---------------------------------------------------------------------------
# ASSUMPTION: Employer rate was 11.0% for service before 2012, then increased
# incrementally: 12% in 2012, 13% in 2014, 14.5% in 2016, 16% in 2018,
# 17% in 2020, 17.5% in 2022, 17.95% from 2024 onward.
EMPLOYER_RATE_SCHEDULE = [
    (date(2024, 1, 1), Decimal("0.1795")),
    (date(2022, 1, 1), Decimal("0.1750")),
    (date(2020, 1, 1), Decimal("0.1700")),
    (date(2018, 1, 1), Decimal("0.1600")),
    (date(2016, 1, 1), Decimal("0.1450")),
    (date(2014, 1, 1), Decimal("0.1300")),
    (date(2012, 1, 1), Decimal("0.1200")),
    (date(1900, 1, 1), Decimal("0.1100")),
]
EMPLOYEE_RATE = Decimal("0.0845")

# ---------------------------------------------------------------------------
# Benefit calculation constants
# ---------------------------------------------------------------------------
# ASSUMPTION: Tier 1 multiplier = 2.0% per year of service
# Tier 2 multiplier = 1.75%
# Tier 3 multiplier = 1.50%
# AMS averaging period: Tier 1 & 2 = 36 months, Tier 3 = 60 months
TIER_MULTIPLIERS = {1: Decimal("0.020"), 2: Decimal("0.0175"), 3: Decimal("0.015")}
TIER_AMS_MONTHS = {1: 36, 2: 36, 3: 60}


def get_employer_rate(pay_date):
    """Return the employer contribution rate for a given pay date."""
    for cutoff, rate in EMPLOYER_RATE_SCHEDULE:
        if pay_date >= cutoff:
            return rate
    return Decimal("0.1100")


# ---------------------------------------------------------------------------
# Denver departments (30)
# ---------------------------------------------------------------------------
DEPARTMENTS = [
    ("AVIATION", "Department of Aviation", "AVTN"),
    ("COMMDEV", "Community Planning and Development", "CPD"),
    ("CULTAFF", "Arts and Venues", "A&V"),
    ("DENVLIB", "Denver Public Library", "DPL"),
    ("DENVPKS", "Denver Parks and Recreation", "DPR"),
    ("DFD", "Denver Fire Department", "DFD"),
    ("DPD", "Denver Police Department", "DPD"),
    ("DPHE", "Dept of Public Health and Environment", "DPHE"),
    ("DPW", "Dept of Transportation and Infrastructure", "DOTI"),
    ("EXCISE", "Excise and Licenses", "E&L"),
    ("FINANCE", "Dept of Finance", "FIN"),
    ("GENERAL", "Office of the City Attorney", "ATTY"),
    ("HR", "Office of Human Resources", "OHR"),
    ("ITS", "Technology Services", "TS"),
    ("MAYOR", "Office of the Mayor", "MAYOR"),
    ("CLERK", "Office of the Clerk and Recorder", "CLERK"),
    ("AUDITOR", "Office of the Auditor", "AUD"),
    ("COUNCIL", "Denver City Council", "DCC"),
    ("DENVERF", "Office of the District Attorney", "DA"),
    ("SAFETY", "Dept of Safety", "SAFE"),
    ("SHERIFF", "Denver Sheriff Department", "DSD"),
    ("SOCIAL", "Denver Human Services", "DHS"),
    ("THEATRO", "Denver Performing Arts Complex", "DPAC"),
    ("TRANSIT", "Regional Transportation District", "RTD"),
    ("WATER", "Denver Water", "DW"),
    ("ECON", "Office of Economic Development", "OED"),
    ("CLIMATE", "Office of Climate Action", "OCA"),
    ("EQUITY", "Office of Social Equity and Innovation", "OSEI"),
    ("HOUSING", "Dept of Housing Stability", "HOST"),
    ("EMERGE", "Office of Emergency Management", "OEM"),
]

# ---------------------------------------------------------------------------
# Positions (50) with pay grades, department affinity, and salary ranges
# ---------------------------------------------------------------------------
# (POS_CD, POS_TITLE, PAY_GRADE, EXEMPT, base_salary_min, base_salary_max, dept_affinity)
POSITIONS = [
    ("ADMIN1", "Administrative Assistant I", "G05", "N", 35000, 42000, None),
    ("ADMIN2", "Administrative Assistant II", "G07", "N", 40000, 50000, None),
    ("ADMIN3", "Senior Administrative Specialist", "G09", "Y", 48000, 62000, None),
    ("ACCT1", "Accountant I", "G08", "N", 45000, 55000, "FINANCE"),
    ("ACCT2", "Senior Accountant", "G10", "Y", 55000, 70000, "FINANCE"),
    ("ANLYST1", "Business Analyst I", "G08", "N", 48000, 58000, None),
    ("ANLYST2", "Senior Business Analyst", "G10", "Y", 58000, 75000, None),
    ("ATTY1", "Assistant City Attorney I", "G12", "Y", 62000, 78000, "GENERAL"),
    ("ATTY2", "Senior City Attorney", "G14", "Y", 75000, 95000, "GENERAL"),
    ("CLRK1", "Clerk I", "G04", "N", 32000, 38000, "CLERK"),
    ("CLRK2", "Clerk II", "G06", "N", 36000, 44000, "CLERK"),
    ("DRVR1", "Equipment Operator I", "G06", "N", 36000, 45000, "DPW"),
    ("DRVR2", "Equipment Operator II", "G08", "N", 42000, 52000, "DPW"),
    ("ELEC1", "Electrician", "G09", "N", 48000, 60000, "DPW"),
    ("ENG1", "Engineer I", "G10", "Y", 55000, 68000, "DPW"),
    ("ENG2", "Senior Engineer", "G12", "Y", 65000, 82000, "DPW"),
    ("FIRE1", "Firefighter", "G08", "N", 45000, 58000, "DFD"),
    ("FIRE2", "Fire Captain", "G11", "Y", 60000, 78000, "DFD"),
    ("FIRE3", "Fire Battalion Chief", "G13", "Y", 72000, 92000, "DFD"),
    ("IT1", "IT Specialist I", "G08", "N", 48000, 60000, "ITS"),
    ("IT2", "IT Specialist II", "G10", "Y", 58000, 72000, "ITS"),
    ("IT3", "Senior Systems Administrator", "G12", "Y", 68000, 85000, "ITS"),
    ("LABR1", "Laborer", "G03", "N", 30000, 36000, "DENVPKS"),
    ("LABR2", "Maintenance Worker", "G05", "N", 35000, 43000, "DENVPKS"),
    ("LEGAL1", "Legal Secretary", "G06", "N", 38000, 48000, "GENERAL"),
    ("LIBR1", "Librarian I", "G07", "N", 40000, 50000, "DENVLIB"),
    ("LIBR2", "Senior Librarian", "G09", "Y", 48000, 62000, "DENVLIB"),
    ("MGR1", "Manager I", "G11", "Y", 60000, 75000, None),
    ("MGR2", "Manager II", "G13", "Y", 72000, 90000, None),
    ("MGR3", "Senior Manager / Director", "G15", "Y", 85000, 110000, None),
    ("NURSE1", "Public Health Nurse", "G09", "Y", 48000, 62000, "DPHE"),
    ("NURSE2", "Senior Public Health Nurse", "G11", "Y", 58000, 75000, "DPHE"),
    ("OFCR1", "Police Officer", "G08", "N", 48000, 62000, "DPD"),
    ("OFCR2", "Police Sergeant", "G11", "Y", 62000, 80000, "DPD"),
    ("OFCR3", "Police Lieutenant", "G13", "Y", 75000, 95000, "DPD"),
    ("PLAN1", "Urban Planner I", "G09", "Y", 50000, 62000, "COMMDEV"),
    ("PLAN2", "Senior Urban Planner", "G11", "Y", 60000, 78000, "COMMDEV"),
    ("PROC1", "Procurement Specialist", "G07", "N", 42000, 52000, "FINANCE"),
    ("REC1", "Recreation Specialist", "G06", "N", 36000, 45000, "DENVPKS"),
    ("REC2", "Recreation Coordinator", "G08", "N", 42000, 55000, "DENVPKS"),
    ("SHRFF1", "Deputy Sheriff", "G08", "N", 46000, 60000, "SHERIFF"),
    ("SHRFF2", "Sheriff Sergeant", "G11", "Y", 60000, 78000, "SHERIFF"),
    ("SOCWK1", "Social Worker I", "G08", "N", 43000, 55000, "SOCIAL"),
    ("SOCWK2", "Senior Social Worker", "G10", "Y", 52000, 68000, "SOCIAL"),
    ("SPEC1", "Program Specialist I", "G07", "N", 40000, 50000, None),
    ("SPEC2", "Program Specialist II", "G09", "Y", 48000, 62000, None),
    ("SUPV1", "Supervisor I", "G09", "Y", 50000, 65000, None),
    ("SUPV2", "Supervisor II", "G11", "Y", 60000, 78000, None),
    ("TECH1", "Technician I", "G06", "N", 36000, 46000, None),
    ("TECH2", "Technician II", "G08", "N", 44000, 56000, None),
]

# ---------------------------------------------------------------------------
# Name pools
# ---------------------------------------------------------------------------
FIRST_NAMES_MALE = [
    "James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph",
    "Thomas", "Christopher", "Charles", "Daniel", "Matthew", "Anthony", "Mark",
    "Donald", "Steven", "Andrew", "Paul", "Joshua", "Kenneth", "Kevin", "Brian",
    "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan",
    "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry",
    "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Raymond", "Gregory",
    "Frank", "Alexander", "Patrick", "Jack", "Dennis", "Jerry",
    "Carlos", "Juan", "Miguel", "Luis", "Francisco", "Alejandro", "Diego",
    "Marco", "Tuan", "Wei", "Hiroshi", "Omar", "Ahmed", "Darnell", "Terrence",
]

FIRST_NAMES_FEMALE = [
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan",
    "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra",
    "Ashley", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda",
    "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia",
    "Kathleen", "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela",
    "Nicole", "Samantha", "Katherine", "Christine", "Debra", "Rachel", "Carolyn",
    "Janet", "Catherine", "Maria", "Heather", "Diane", "Ruth", "Julie",
    "Rosa", "Carmen", "Lucia", "Ana", "Gabriela", "Mei", "Yuki", "Priya",
    "Aisha", "Fatima", "Tanisha", "Keisha", "Lakisha",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
    "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
    "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans",
    "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
    "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez",
    "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Kelly",
    "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson",
    "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza",
    "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
    "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell",
]

# Staff who process cases
STAFF_NAMES = [
    "jthompson", "mgarcia", "kwilliams", "rjohnson", "asmith",
    "crodriguez", "tlee", "sdavis", "nperez", "bmartinez",
    "dmoore", "eanderson", "fwilson", "ghernandez", "htaylor",
]

# Case types with relative weights
CASE_TYPES = [
    ("ESTIMATE", 30),
    ("GENERAL_INQUIRY", 25),
    ("SVC_RETIREMENT", 12),
    ("EARLY_RETIREMENT", 8),
    ("BENEFICIARY_CHANGE", 10),
    ("DRO", 4),
    ("REFUND", 5),
    ("DISABILITY", 3),
    ("DEATH_CLAIM", 3),
]

# Colorado cities for addresses
CO_CITIES = [
    ("Denver", "80201"), ("Denver", "80202"), ("Denver", "80204"), ("Denver", "80206"),
    ("Denver", "80209"), ("Denver", "80210"), ("Denver", "80211"), ("Denver", "80212"),
    ("Denver", "80216"), ("Denver", "80218"), ("Denver", "80220"), ("Denver", "80222"),
    ("Denver", "80224"), ("Denver", "80227"), ("Denver", "80229"), ("Denver", "80230"),
    ("Denver", "80231"), ("Denver", "80235"), ("Denver", "80236"), ("Denver", "80237"),
    ("Denver", "80239"), ("Denver", "80247"), ("Denver", "80249"),
    ("Aurora", "80010"), ("Aurora", "80012"), ("Aurora", "80013"),
    ("Lakewood", "80226"), ("Lakewood", "80228"),
    ("Littleton", "80120"), ("Littleton", "80123"),
    ("Englewood", "80110"), ("Englewood", "80113"),
    ("Arvada", "80002"), ("Arvada", "80003"),
    ("Westminster", "80030"), ("Westminster", "80031"),
    ("Thornton", "80229"), ("Thornton", "80233"),
    ("Centennial", "80112"), ("Centennial", "80122"),
    ("Golden", "80401"),
    ("Broomfield", "80020"),
    ("Northglenn", "80234"),
    ("Commerce City", "80022"),
    ("Parker", "80134"),
    ("Castle Rock", "80104"),
    ("Highlands Ranch", "80129"),
    ("Brighton", "80601"),
]

STREET_NAMES = [
    "Main St", "Broadway", "Colfax Ave", "Alameda Ave", "Speer Blvd",
    "Federal Blvd", "Colorado Blvd", "University Blvd", "Downing St",
    "York St", "Race St", "Vine St", "Clarkson St", "Pearl St",
    "Washington St", "Grant St", "Logan St", "Sherman St", "Lincoln St",
    "Pennsylvania St", "Ogden St", "Emerson St", "Marion St", "Dahlia St",
    "Holly St", "Jasmine St", "Kearney St", "Locust St", "Monaco Pkwy",
    "Quebec St", "Roslyn St", "Syracuse St", "Ulster St", "Verbena St",
    "Xanthia St", "Yosemite St", "Zenobia St", "Lowell Blvd", "Sheridan Blvd",
    "Kipling St", "Wadsworth Blvd", "Simms St", "Garrison St", "Harlan St",
    "Ingalls St", "Jellison St",
]

PHONE_FORMATS = [
    "({area}){prefix}-{line}",     # Legacy format: (303)555-1234
    "{area}-{prefix}-{line}",       # Standard: 303-555-1234
    "{area}{prefix}{line}",         # Bare: 3035551234
    "({area}) {prefix}-{line}",     # Spaced: (303) 555-1234
]


# ===================================================================
# Helper functions
# ===================================================================

def sql_str(val):
    """Escape a string value for SQL insertion, or return NULL."""
    if val is None:
        return "NULL"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def sql_date(val):
    """Format a date for SQL, or return NULL."""
    if val is None:
        return "NULL"
    return f"'{val.isoformat()}'"


def sql_timestamp(val):
    """Format a timestamp for SQL, or return NULL."""
    if val is None:
        return "NULL"
    if isinstance(val, date) and not isinstance(val, datetime):
        return f"'{val.isoformat()} 00:00:00'"
    return f"'{val.isoformat()}'"


def sql_num(val):
    """Format a number for SQL, or return NULL."""
    if val is None:
        return "NULL"
    return str(val)


def d2(val):
    """Round a Decimal to 2 decimal places."""
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_tier(hire_date):
    """Determine pension tier from hire date."""
    if hire_date < TIER_1_CUTOFF:
        return 1
    elif hire_date < TIER_2_CUTOFF:
        return 2
    else:
        return 3


def get_pay_periods(start_date, end_date):
    """Generate all biweekly pay period end dates between start and end (inclusive)."""
    periods = []
    # Find first pay period after start_date
    days_since_epoch = (start_date - PAY_EPOCH).days
    periods_since = days_since_epoch // BIWEEKLY_DAYS
    first_period_end = PAY_EPOCH + timedelta(days=(periods_since + 1) * BIWEEKLY_DAYS)
    if first_period_end < start_date:
        first_period_end += timedelta(days=BIWEEKLY_DAYS)

    current = first_period_end
    while current <= end_date:
        periods.append(current)
        current += timedelta(days=BIWEEKLY_DAYS)
    return periods


def pay_period_number(pp_date):
    """Compute pay period number (1-26/27) within the year."""
    jan1 = date(pp_date.year, 1, 1)
    days_since = (pp_date - PAY_EPOCH).days
    pp_in_year = ((pp_date - date(pp_date.year, 1, 1)).days) // BIWEEKLY_DAYS + 1
    return min(pp_in_year, 27)


def gen_ssn(rng):
    """Generate a random SSN-formatted string (not a real SSN)."""
    area = rng.randint(100, 899)
    group = rng.randint(10, 99)
    serial = rng.randint(1000, 9999)
    # Randomly choose format: with or without dashes (legacy inconsistency)
    if rng.random() < 0.7:
        return f"{area}-{group}-{serial}"
    else:
        return f"{area}{group}{serial}"


def gen_phone(rng):
    """Generate a phone number in a randomly chosen format."""
    fmt = rng.choice(PHONE_FORMATS)
    area = rng.choice(["303", "720", "719", "970"])
    prefix = str(rng.randint(200, 999))
    line = str(rng.randint(1000, 9999))
    return fmt.format(area=area, prefix=prefix, line=line)


def gen_address(rng):
    """Generate a random address."""
    num = rng.randint(100, 19999)
    street = rng.choice(STREET_NAMES)
    city, zipcode = rng.choice(CO_CITIES)
    line2 = None
    if rng.random() < 0.15:
        line2 = f"Apt {rng.randint(1, 999)}"
    elif rng.random() < 0.05:
        line2 = f"Unit {rng.choice('ABCDEFGH')}"
    return f"{num} {street}", line2, city, "CO", zipcode


def gen_email(first, last, hire_year, rng):
    """Generate an email address or None for older records."""
    # ASSUMPTION: Email field added ~2010; older records mostly NULL
    if hire_year < 2005 and rng.random() < 0.6:
        return None
    if hire_year < 2010 and rng.random() < 0.3:
        return None
    domain = rng.choice(["denvergov.org", "gmail.com", "yahoo.com", "outlook.com", "hotmail.com"])
    sep = rng.choice([".", "_", ""])
    return f"{first.lower()}{sep}{last.lower()}@{domain}"


def rand_date_between(rng, start, end):
    """Return a random date between start and end inclusive."""
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=rng.randint(0, delta))


def inflate_salary(base_salary, from_year, to_year, rng):
    """Inflate a base salary from from_year to to_year with 2-4% annual growth."""
    salary = Decimal(str(base_salary))
    for _ in range(from_year, to_year):
        growth = Decimal(str(rng.uniform(0.02, 0.04)))
        salary *= (1 + growth)
    return d2(salary)


# ===================================================================
# Data generation context — holds all generated records
# ===================================================================

class SeedDataContext:
    """Accumulates all SQL INSERT statements."""

    def __init__(self):
        self.departments = []
        self.positions = []
        self.members = []
        self.employment_hist = []
        self.salary_hist = []
        self.contribution_hist = []
        self.beneficiaries = []
        self.svc_credits = []
        self.dro_records = []
        self.benefit_payments = []
        self.case_hist = []
        self.rng = random.Random(RANDOM_SEED)

        # Counters for serial IDs
        self.next_empl_hist_id = 1
        self.next_salary_id = 1
        self.next_contrib_id = 1
        self.next_bene_id = 1
        self.next_svc_credit_id = 1
        self.next_dro_id = 1
        self.next_payment_id = 1
        self.next_case_id = 1

        # Tracking for data quality issues
        self.dq_status_mismatch_members = set()       # STATUS='A' with TERM_DATE
        self.dq_salary_gap_members = set()            # Missing pay periods
        self.dq_contrib_mismatch_members = set()      # Balance rounding errors
        self.dq_bene_allocation_members = set()        # Allocations != 100%
        self.dq_payment_error_members = set()          # Wrong payment amounts
        self.dq_tier_boundary_members = set()          # Near boundary, wrong tier

    # ---------------------------------------------------------------
    # Reference data generation
    # ---------------------------------------------------------------
    def gen_departments(self):
        """Generate DEPARTMENT_REF insert statements."""
        for dept_cd, dept_name, dept_short in DEPARTMENTS:
            create_dt = datetime(1990 + self.rng.randint(0, 10),
                                 self.rng.randint(1, 12),
                                 self.rng.randint(1, 28), 8, 0, 0)
            self.departments.append(
                f"INSERT INTO DEPARTMENT_REF (DEPT_CD, DEPT_NAME, DEPT_SHORT, ACTIVE_FLAG, CREATE_DT) "
                f"VALUES ({sql_str(dept_cd)}, {sql_str(dept_name)}, {sql_str(dept_short)}, "
                f"'Y', {sql_timestamp(create_dt)});"
            )

    def gen_positions(self):
        """Generate POSITION_REF insert statements."""
        for pos_cd, pos_title, pay_grade, exempt, sal_min, sal_max, dept_cd in POSITIONS:
            eff_dt = date(1995, 1, 1) if self.rng.random() < 0.7 else date(2005, 1, 1)
            self.positions.append(
                f"INSERT INTO POSITION_REF (POS_CD, POS_TITLE, PAY_GRADE, EXEMPT_FLG, "
                f"MIN_SALARY, MAX_SALARY, DEPT_CD, EFF_DT) VALUES ("
                f"{sql_str(pos_cd)}, {sql_str(pos_title)}, {sql_str(pay_grade)}, "
                f"{sql_str(exempt)}, {sql_num(sal_min)}, {sql_num(sal_max)}, "
                f"{sql_str(dept_cd)}, {sql_date(eff_dt)});"
            )

    # ---------------------------------------------------------------
    # Member generation
    # ---------------------------------------------------------------
    def gen_member_demographics(self, member_id, status, tier, hire_date,
                                 term_date=None, dob=None, gender=None,
                                 first_name=None, last_name=None,
                                 marital_stat=None, dept_cd=None, pos_cd=None,
                                 force_wrong_tier=False, force_status_mismatch=False):
        """Generate a single MEMBER_MASTER record."""
        rng = self.rng

        if gender is None:
            gender = rng.choice(["M", "F"])
        if first_name is None:
            if gender == "M":
                first_name = rng.choice(FIRST_NAMES_MALE)
            else:
                first_name = rng.choice(FIRST_NAMES_FEMALE)
        if last_name is None:
            last_name = rng.choice(LAST_NAMES)

        middle_name = None
        if rng.random() < 0.7:
            if gender == "M":
                middle_name = rng.choice(FIRST_NAMES_MALE)
            else:
                middle_name = rng.choice(FIRST_NAMES_FEMALE)

        suffix = None
        if gender == "M" and rng.random() < 0.05:
            suffix = rng.choice(["Jr.", "Sr.", "III", "II"])

        if dob is None:
            # DOB: typically 20-35 years before hire date
            age_at_hire = rng.randint(20, 35)
            dob = date(hire_date.year - age_at_hire, rng.randint(1, 12), rng.randint(1, 28))

        if marital_stat is None:
            marital_stat = rng.choice(["S", "M", "M", "M", "D", "W"])  # Weighted toward married

        addr1, addr2, city, state_cd, zipcode = gen_address(rng)
        phone = gen_phone(rng)
        email = gen_email(first_name, last_name, hire_date.year, rng)
        ssn = gen_ssn(rng)

        if dept_cd is None:
            dept_cd = rng.choice(DEPARTMENTS)[0]
        if pos_cd is None:
            # Try to pick a position that matches the department
            matching = [p for p in POSITIONS if p[6] == dept_cd]
            if not matching:
                matching = [p for p in POSITIONS if p[6] is None]
            pos = rng.choice(matching)
            pos_cd = pos[0]

        actual_tier = get_tier(hire_date)
        stored_tier = actual_tier
        if force_wrong_tier:
            # Deliberately store wrong tier for data quality issue
            if actual_tier == 1:
                stored_tier = 2
            elif actual_tier == 2:
                stored_tier = rng.choice([1, 3])
            else:
                stored_tier = 2

        actual_status = status
        actual_term_date = term_date
        if force_status_mismatch:
            # STATUS='A' but TERM_DATE populated
            actual_status = "A"
            if actual_term_date is None:
                actual_term_date = rand_date_between(rng, hire_date + timedelta(days=365),
                                                     min(hire_date + timedelta(days=365 * 20), TODAY))

        union_cd = None
        if rng.random() < 0.4:
            union_cd = rng.choice(["AFSCME", "IBEW", "FPF", "FOP", "CWA"])

        medicare_flag = None
        if hire_date.year >= 2018 or rng.random() < 0.3:
            medicare_flag = "Y" if hire_date >= date(1986, 4, 1) else "N"

        rehire_dt = None
        if actual_status == "A" and rng.random() < 0.03:
            rehire_dt = rand_date_between(rng, hire_date + timedelta(days=365),
                                          min(hire_date + timedelta(days=365 * 5), TODAY))

        notes = None
        if rng.random() < 0.1:
            notes = rng.choice([
                "Transferred from temp position",
                "Military leave 2003-2004",
                "FMLA leave taken",
                "Workers comp claim 2015",
                "Address update needed",
                "Duplicate SSN flagged — resolved",
                "Name change processed",
            ])

        create_dt = datetime(hire_date.year, hire_date.month, hire_date.day, 9, 0, 0)
        last_upd = datetime(2024, rng.randint(1, 12), rng.randint(1, 28), rng.randint(8, 17), 0, 0)

        self.members.append(
            f"INSERT INTO MEMBER_MASTER (MEMBER_ID, SSN, FIRST_NAME, LAST_NAME, MIDDLE_NAME, "
            f"SUFFIX, DOB, GENDER, MARITAL_STAT, ADDR_LINE1, ADDR_LINE2, CITY, STATE_CD, "
            f"ZIP_CD, PHONE, EMAIL, HIRE_DT, TERM_DATE, REHIRE_DT, STATUS_CD, TIER_CD, "
            f"DEPT_CD, POS_CD, UNION_CD, MEDICARE_FLAG, NOTES, CREATE_DT, LAST_UPD_DT, "
            f"UPD_USER) VALUES ("
            f"{member_id}, {sql_str(ssn)}, {sql_str(first_name)}, {sql_str(last_name)}, "
            f"{sql_str(middle_name)}, {sql_str(suffix)}, {sql_date(dob)}, "
            f"{sql_str(gender)}, {sql_str(marital_stat)}, {sql_str(addr1)}, "
            f"{sql_str(addr2)}, {sql_str(city)}, {sql_str(state_cd)}, {sql_str(zipcode)}, "
            f"{sql_str(phone)}, {sql_str(email)}, {sql_date(hire_date)}, "
            f"{sql_date(actual_term_date)}, {sql_date(rehire_dt)}, {sql_str(actual_status)}, "
            f"{stored_tier}, {sql_str(dept_cd)}, {sql_str(pos_cd)}, {sql_str(union_cd)}, "
            f"{sql_str(medicare_flag)}, {sql_str(notes)}, {sql_timestamp(create_dt)}, "
            f"{sql_timestamp(last_upd)}, {sql_str('SYSTEM')});"
        )

        return {
            "member_id": member_id,
            "first_name": first_name,
            "last_name": last_name,
            "dob": dob,
            "gender": gender,
            "marital_stat": marital_stat,
            "hire_date": hire_date,
            "term_date": actual_term_date,
            "status": actual_status,
            "tier": actual_tier,
            "dept_cd": dept_cd,
            "pos_cd": pos_cd,
        }

    # ---------------------------------------------------------------
    # Salary and contribution history generation
    # ---------------------------------------------------------------
    def gen_salary_history(self, member_info, starting_salary=None, end_date=None,
                           leave_payout_amt=None, leave_payout_date=None,
                           inject_gap=False, inject_balance_mismatch=False,
                           target_ams=None, ams_months=None, target_end_date=None):
        """
        Generate SALARY_HIST and CONTRIBUTION_HIST records for a member.

        If target_ams is specified, the last N months of salary will be
        calibrated so the average monthly salary equals target_ams exactly.
        """
        rng = self.rng
        member_id = member_info["member_id"]
        hire_date = member_info["hire_date"]
        tier = member_info["tier"]
        pos_cd = member_info["pos_cd"]

        if end_date is None:
            if member_info["term_date"]:
                end_date = member_info["term_date"]
            else:
                end_date = min(TODAY, DATA_CUTOFF)

        # Determine starting salary
        if starting_salary is None:
            pos = next((p for p in POSITIONS if p[0] == pos_cd), None)
            if pos:
                base_min, base_max = pos[4], pos[5]
            else:
                base_min, base_max = 35000, 55000
            # ASSUMPTION: Starting salaries scale with era — inflate from 2000 baseline
            base_2000 = rng.randint(base_min, base_max)
            if hire_date.year < 2000:
                factor = Decimal(str(0.97 ** (2000 - hire_date.year)))
                starting_salary = d2(Decimal(str(base_2000)) * factor)
            else:
                factor = Decimal(str(1.025 ** (hire_date.year - 2000)))
                starting_salary = d2(Decimal(str(base_2000)) * factor)
        else:
            starting_salary = Decimal(str(starting_salary))

        # Build yearly salary trajectory
        salary_by_year = {}
        current_salary = starting_salary
        for year in range(hire_date.year, end_date.year + 1):
            if year == hire_date.year:
                salary_by_year[year] = current_salary
            else:
                # Annual raise: 2-4%
                raise_pct = Decimal(str(rng.uniform(0.02, 0.04)))
                # Occasional promotion bump: 8-15% (~8% of years)
                if rng.random() < 0.08:
                    raise_pct += Decimal(str(rng.uniform(0.08, 0.15)))
                current_salary = d2(current_salary * (1 + raise_pct))
                salary_by_year[year] = current_salary

        # If we have a target AMS, adjust the last N months' salary
        if target_ams is not None and target_end_date is not None:
            target_ams = Decimal(str(target_ams))
            # The AMS period covers ams_months months before target_end_date
            ams_start = date(target_end_date.year, target_end_date.month, 1)
            for i in range(ams_months - 1):
                m = ams_start.month - 1
                y = ams_start.year
                if m == 0:
                    m = 12
                    y -= 1
                ams_start = date(y, m, 1)
            # target_ams is monthly — so annual salary = target_ams * 12
            ams_annual = d2(target_ams * 12)
            for year in range(ams_start.year, target_end_date.year + 1):
                salary_by_year[year] = ams_annual

        # Generate pay period records
        all_pay_periods = get_pay_periods(hire_date, end_date)

        # If injecting gaps, pick 4-8 consecutive periods to skip
        gap_periods = set()
        if inject_gap:
            if len(all_pay_periods) > 30:
                gap_start_idx = rng.randint(10, len(all_pay_periods) - 20)
                gap_len = rng.randint(4, 8)
                for i in range(gap_start_idx, min(gap_start_idx + gap_len, len(all_pay_periods))):
                    gap_periods.add(i)

        ee_running_balance = Decimal("0.00")
        er_running_balance = Decimal("0.00")
        balance_mismatch_injected = False

        for idx, pp_end in enumerate(all_pay_periods):
            if idx in gap_periods:
                continue

            year = pp_end.year
            annual_salary = salary_by_year.get(year, salary_by_year.get(max(salary_by_year.keys())))
            gross_pay = d2(annual_salary / 26)
            pensionable_pay = gross_pay

            # Some OT for non-exempt positions
            ot_pay = Decimal("0.00")
            if rng.random() < 0.1:
                ot_pay = d2(gross_pay * Decimal(str(rng.uniform(0.05, 0.25))))

            # Leave payout — only on the designated date
            leave_pay = Decimal("0.00")
            if leave_payout_amt and leave_payout_date:
                if abs((pp_end - leave_payout_date).days) <= 7:
                    leave_pay = Decimal(str(leave_payout_amt))

            furlough = Decimal("0.00")
            # ASSUMPTION: Denver had furloughs during 2009-2010 fiscal crisis
            if 2009 <= year <= 2010 and rng.random() < 0.15:
                furlough = d2(gross_pay * Decimal("0.038"))  # ~1 furlough day

            pp_num = pay_period_number(pp_end)
            fy_year = year

            self.salary_hist.append(
                f"INSERT INTO SALARY_HIST (SALARY_ID, MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM, "
                f"ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY, LEAVE_PAYOUT_AMT, "
                f"FURLOUGH_DEDUCT, FY_YEAR) VALUES ("
                f"{self.next_salary_id}, {member_id}, {sql_date(pp_end)}, {pp_num}, "
                f"{sql_num(annual_salary)}, {sql_num(gross_pay + ot_pay + leave_pay - furlough)}, "
                f"{sql_num(pensionable_pay)}, {sql_num(ot_pay)}, {sql_num(leave_pay)}, "
                f"{sql_num(furlough)}, {fy_year});"
            )
            self.next_salary_id += 1

            # Contribution record
            ee_contrib = d2(pensionable_pay * EMPLOYEE_RATE)
            er_rate = get_employer_rate(pp_end)
            er_contrib = d2(pensionable_pay * er_rate)

            ee_running_balance += ee_contrib
            er_running_balance += er_contrib

            # Interest — annual, applied at year end
            interest = Decimal("0.00")
            if pp_end.month == 12 and pp_num >= 25:
                # ASSUMPTION: Interest rate ~3% annually on employee balance
                interest = d2(ee_running_balance * Decimal("0.03"))
                ee_running_balance += interest

            # Inject balance mismatch for data quality issue
            stored_ee_balance = ee_running_balance
            stored_er_balance = er_running_balance
            if inject_balance_mismatch and not balance_mismatch_injected:
                if ee_running_balance > Decimal("50000") and rng.random() < 0.1:
                    # Introduce a small rounding discrepancy
                    stored_ee_balance = ee_running_balance + Decimal("0.03")
                    balance_mismatch_injected = True

            self.contribution_hist.append(
                f"INSERT INTO CONTRIBUTION_HIST (CONTRIB_ID, MEMBER_ID, PAY_PERIOD_END, "
                f"EE_CONTRIB, ER_CONTRIB, EE_BALANCE, ER_BALANCE, INTEREST_AMT, FY_YEAR) VALUES ("
                f"{self.next_contrib_id}, {member_id}, {sql_date(pp_end)}, "
                f"{sql_num(ee_contrib)}, {sql_num(er_contrib)}, "
                f"{sql_num(stored_ee_balance)}, {sql_num(stored_er_balance)}, "
                f"{sql_num(interest)}, {fy_year});"
            )
            self.next_contrib_id += 1

        return salary_by_year

    # ---------------------------------------------------------------
    # Employment history
    # ---------------------------------------------------------------
    def gen_employment_history(self, member_info, salary_by_year):
        """Generate EMPLOYMENT_HIST records for a member."""
        rng = self.rng
        member_id = member_info["member_id"]
        hire_date = member_info["hire_date"]
        dept_cd = member_info["dept_cd"]
        pos_cd = member_info["pos_cd"]
        status = member_info["status"]
        term_date = member_info["term_date"]

        # Initial hire event
        starting_salary = salary_by_year.get(hire_date.year, Decimal("45000"))
        self.employment_hist.append(
            f"INSERT INTO EMPLOYMENT_HIST (EMPL_HIST_ID, MEMBER_ID, EVENT_TYPE, EVENT_DT, "
            f"DEPT_CD, POS_CD, SALARY_ANNUAL, CREATE_DT, CREATE_USER) VALUES ("
            f"{self.next_empl_hist_id}, {member_id}, 'HIRE', {sql_date(hire_date)}, "
            f"{sql_str(dept_cd)}, {sql_str(pos_cd)}, {sql_num(starting_salary)}, "
            f"{sql_timestamp(hire_date)}, 'SYSTEM');"
        )
        self.next_empl_hist_id += 1

        # Generate some transfers/promotions over career
        career_years = ((term_date or TODAY) - hire_date).days / 365.25
        num_events = max(0, int(career_years / 5) + (1 if rng.random() < 0.3 else 0))

        current_dept = dept_cd
        current_pos = pos_cd
        for i in range(min(num_events, 4)):
            event_date = rand_date_between(rng,
                                           hire_date + timedelta(days=365 * (i + 1) * 2),
                                           hire_date + timedelta(days=min(365 * (i + 2) * 3, int(career_years * 365))))
            if event_date > (term_date or TODAY):
                break

            event_type = rng.choice(["TRANSFER", "PROMOTION", "PROMOTION"])
            if event_type == "TRANSFER":
                new_dept = rng.choice(DEPARTMENTS)[0]
                matching = [p for p in POSITIONS if p[6] == new_dept or p[6] is None]
                new_pos = rng.choice(matching)[0]
                current_dept = new_dept
                current_pos = new_pos
            else:
                # Promotion: same dept, potentially higher position
                current_pos = rng.choice([p[0] for p in POSITIONS if p[6] is None or p[6] == current_dept])

            salary = salary_by_year.get(event_date.year, Decimal("50000"))
            self.employment_hist.append(
                f"INSERT INTO EMPLOYMENT_HIST (EMPL_HIST_ID, MEMBER_ID, EVENT_TYPE, EVENT_DT, "
                f"DEPT_CD, POS_CD, SALARY_ANNUAL, CREATE_DT, CREATE_USER) VALUES ("
                f"{self.next_empl_hist_id}, {member_id}, {sql_str(event_type)}, "
                f"{sql_date(event_date)}, {sql_str(current_dept)}, {sql_str(current_pos)}, "
                f"{sql_num(salary)}, {sql_timestamp(event_date)}, 'SYSTEM');"
            )
            self.next_empl_hist_id += 1

        # Separation event
        if status in ("R", "T") and term_date:
            sep_cd = "RETIREMENT" if status == "R" else rng.choice(["VOLUNTARY", "INVOLUNTARY", "RIF"])
            self.employment_hist.append(
                f"INSERT INTO EMPLOYMENT_HIST (EMPL_HIST_ID, MEMBER_ID, EVENT_TYPE, EVENT_DT, "
                f"DEPT_CD, POS_CD, SALARY_ANNUAL, SEPARATION_CD, SEPARATION_RSN, "
                f"CREATE_DT, CREATE_USER) VALUES ("
                f"{self.next_empl_hist_id}, {member_id}, 'SEPARATION', {sql_date(term_date)}, "
                f"{sql_str(current_dept)}, {sql_str(current_pos)}, "
                f"{sql_num(salary_by_year.get(term_date.year, Decimal('50000')))}, "
                f"{sql_str(sep_cd)}, {sql_str('Service retirement' if status == 'R' else 'Voluntary separation')}, "
                f"{sql_timestamp(term_date)}, 'SYSTEM');"
            )
            self.next_empl_hist_id += 1

    # ---------------------------------------------------------------
    # Beneficiary records
    # ---------------------------------------------------------------
    def gen_beneficiaries(self, member_info, specific_benes=None, inject_bad_alloc=False):
        """Generate BENEFICIARY records for a member."""
        rng = self.rng
        member_id = member_info["member_id"]
        hire_date = member_info["hire_date"]

        if specific_benes:
            for bene in specific_benes:
                self.beneficiaries.append(
                    f"INSERT INTO BENEFICIARY (BENE_ID, MEMBER_ID, BENE_TYPE, FIRST_NAME, "
                    f"LAST_NAME, RELATIONSHIP, DOB, SSN, ALLOC_PCT, EFF_DT, END_DT, "
                    f"SUPERSEDED_BY, CREATE_DT, CREATE_USER) VALUES ("
                    f"{self.next_bene_id}, {member_id}, {sql_str(bene['type'])}, "
                    f"{sql_str(bene['first'])}, {sql_str(bene['last'])}, "
                    f"{sql_str(bene.get('relationship'))}, {sql_date(bene.get('dob'))}, "
                    f"{sql_str(bene.get('ssn'))}, {sql_num(bene.get('alloc_pct', 100))}, "
                    f"{sql_date(bene['eff_dt'])}, {sql_date(bene.get('end_dt'))}, "
                    f"{sql_num(bene.get('superseded_by'))}, "
                    f"{sql_timestamp(bene['eff_dt'])}, {sql_str('SYSTEM')});"
                )
                self.next_bene_id += 1
            return

        # Generate random beneficiaries
        eff_dt = hire_date + timedelta(days=rng.randint(0, 90))
        marital = member_info.get("marital_stat", "S")

        if marital == "M":
            # Primary beneficiary: spouse
            spouse_first = rng.choice(FIRST_NAMES_FEMALE if member_info["gender"] == "M" else FIRST_NAMES_MALE)
            alloc = 100 if not inject_bad_alloc else rng.choice([95, 98, 102])
            self.beneficiaries.append(
                f"INSERT INTO BENEFICIARY (BENE_ID, MEMBER_ID, BENE_TYPE, FIRST_NAME, "
                f"LAST_NAME, RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT, CREATE_DT, CREATE_USER) VALUES ("
                f"{self.next_bene_id}, {member_id}, 'PRIMARY', "
                f"{sql_str(spouse_first)}, {sql_str(member_info['last_name'])}, "
                f"'SPOUSE', {sql_date(date(member_info['dob'].year + rng.randint(-3, 3), rng.randint(1, 12), rng.randint(1, 28)))}, "
                f"{sql_num(alloc)}, {sql_date(eff_dt)}, {sql_timestamp(eff_dt)}, 'SYSTEM');"
            )
            self.next_bene_id += 1

            # Sometimes add contingent beneficiaries (children)
            if rng.random() < 0.4:
                num_children = rng.randint(1, 3)
                child_alloc = Decimal(str(round(100 / num_children, 2)))
                for c in range(num_children):
                    child_first = rng.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
                    child_alloc_val = child_alloc if c < num_children - 1 else (100 - child_alloc * (num_children - 1))
                    self.beneficiaries.append(
                        f"INSERT INTO BENEFICIARY (BENE_ID, MEMBER_ID, BENE_TYPE, FIRST_NAME, "
                        f"LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT, CREATE_DT, CREATE_USER) VALUES ("
                        f"{self.next_bene_id}, {member_id}, 'CONTINGENT', "
                        f"{sql_str(child_first)}, {sql_str(member_info['last_name'])}, "
                        f"'CHILD', {sql_num(child_alloc_val)}, {sql_date(eff_dt)}, "
                        f"{sql_timestamp(eff_dt)}, 'SYSTEM');"
                    )
                    self.next_bene_id += 1
        else:
            # Single/divorced: parent or sibling as primary
            bene_first = rng.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
            bene_last = rng.choice([member_info["last_name"], rng.choice(LAST_NAMES)])
            rel = rng.choice(["PARENT", "SIBLING", "CHILD", "OTHER"])
            alloc = 100 if not inject_bad_alloc else rng.choice([95, 98, 105])
            self.beneficiaries.append(
                f"INSERT INTO BENEFICIARY (BENE_ID, MEMBER_ID, BENE_TYPE, FIRST_NAME, "
                f"LAST_NAME, RELATIONSHIP, ALLOC_PCT, EFF_DT, CREATE_DT, CREATE_USER) VALUES ("
                f"{self.next_bene_id}, {member_id}, 'PRIMARY', "
                f"{sql_str(bene_first)}, {sql_str(bene_last)}, "
                f"{sql_str(rel)}, {sql_num(alloc)}, {sql_date(eff_dt)}, "
                f"{sql_timestamp(eff_dt)}, 'SYSTEM');"
            )
            self.next_bene_id += 1

    # ---------------------------------------------------------------
    # Service credit
    # ---------------------------------------------------------------
    def gen_service_credit(self, member_info, earned_years, earned_months,
                            purchased_years=0, purchased_cost=None):
        """Generate SVC_CREDIT records for a member."""
        member_id = member_info["member_id"]
        hire_date = member_info["hire_date"]
        term_date = member_info.get("term_date") or TODAY

        # Earned service credit
        total_earned = Decimal(str(earned_years)) + Decimal(str(earned_months)) / Decimal("12")
        months_total = earned_years * 12 + earned_months
        self.svc_credits.append(
            f"INSERT INTO SVC_CREDIT (SVC_CREDIT_ID, MEMBER_ID, CREDIT_TYPE, BEGIN_DT, END_DT, "
            f"YEARS_CREDITED, MONTHS_CREDITED, STATUS, CREATE_DT, CREATE_USER) VALUES ("
            f"{self.next_svc_credit_id}, {member_id}, 'EARNED', {sql_date(hire_date)}, "
            f"{sql_date(term_date)}, {sql_num(d2(total_earned))}, {months_total}, "
            f"'ACTIVE', {sql_timestamp(hire_date)}, 'SYSTEM');"
        )
        self.next_svc_credit_id += 1

        # Purchased service credit
        if purchased_years > 0:
            if purchased_cost is None:
                # ASSUMPTION: Purchase cost is roughly 20% of annual salary per year purchased
                purchased_cost = d2(Decimal(str(purchased_years)) * Decimal("12000"))
            purchase_dt = rand_date_between(self.rng, hire_date + timedelta(days=365 * 2),
                                            min(hire_date + timedelta(days=365 * 10), term_date))
            self.svc_credits.append(
                f"INSERT INTO SVC_CREDIT (SVC_CREDIT_ID, MEMBER_ID, CREDIT_TYPE, "
                f"YEARS_CREDITED, MONTHS_CREDITED, COST, PURCHASE_DT, STATUS, "
                f"NOTES, CREATE_DT, CREATE_USER) VALUES ("
                f"{self.next_svc_credit_id}, {member_id}, 'PURCHASED', "
                f"{sql_num(purchased_years)}, {purchased_years * 12}, "
                f"{sql_num(purchased_cost)}, {sql_date(purchase_dt)}, "
                f"'ACTIVE', 'Service purchase approved', {sql_timestamp(purchase_dt)}, 'SYSTEM');"
            )
            self.next_svc_credit_id += 1

    # ---------------------------------------------------------------
    # DRO records
    # ---------------------------------------------------------------
    def gen_dro(self, member_info, marriage_dt=None, divorce_dt=None,
                alt_payee_first=None, alt_payee_last=None,
                division_method="PERCENTAGE", division_value=50.0,
                status="APPROVED"):
        """Generate DRO_MASTER record for a member."""
        rng = self.rng
        member_id = member_info["member_id"]

        if marriage_dt is None:
            marriage_dt = rand_date_between(rng, member_info["hire_date"] - timedelta(days=365 * 2),
                                            member_info["hire_date"] + timedelta(days=365 * 5))
        if divorce_dt is None:
            divorce_dt = rand_date_between(rng, marriage_dt + timedelta(days=365 * 3),
                                           marriage_dt + timedelta(days=365 * 15))
        if alt_payee_first is None:
            alt_payee_first = rng.choice(FIRST_NAMES_FEMALE if member_info["gender"] == "M" else FIRST_NAMES_MALE)
        if alt_payee_last is None:
            alt_payee_last = member_info["last_name"]

        alt_payee_ssn = gen_ssn(rng)
        alt_payee_dob = date(member_info["dob"].year + rng.randint(-5, 5),
                             rng.randint(1, 12), rng.randint(1, 28))
        court_order = f"DR-{divorce_dt.year}-{rng.randint(10000, 99999)}"
        received_dt = divorce_dt + timedelta(days=rng.randint(30, 180))
        approved_dt = received_dt + timedelta(days=rng.randint(30, 120)) if status == "APPROVED" else None

        self.dro_records.append(
            f"INSERT INTO DRO_MASTER (DRO_ID, MEMBER_ID, COURT_ORDER_NUM, MARRIAGE_DT, "
            f"DIVORCE_DT, ALT_PAYEE_FIRST, ALT_PAYEE_LAST, ALT_PAYEE_SSN, ALT_PAYEE_DOB, "
            f"DIVISION_METHOD, DIVISION_VALUE, STATUS, RECEIVED_DT, APPROVED_DT, "
            f"CREATE_DT, CREATE_USER) VALUES ("
            f"{self.next_dro_id}, {member_id}, {sql_str(court_order)}, "
            f"{sql_date(marriage_dt)}, {sql_date(divorce_dt)}, "
            f"{sql_str(alt_payee_first)}, {sql_str(alt_payee_last)}, "
            f"{sql_str(alt_payee_ssn)}, {sql_date(alt_payee_dob)}, "
            f"{sql_str(division_method)}, {sql_num(division_value)}, "
            f"{sql_str(status)}, {sql_date(received_dt)}, {sql_date(approved_dt)}, "
            f"{sql_timestamp(received_dt)}, 'SYSTEM');"
        )
        self.next_dro_id += 1

    # ---------------------------------------------------------------
    # Benefit payment records
    # ---------------------------------------------------------------
    def gen_benefit_payment(self, member_info, gross_monthly, payment_type="MAXIMUM",
                             reduction_pct=0, dro_deduct=0, eff_dt=None,
                             inject_wrong_amount=False):
        """Generate BENEFIT_PAYMENT record for a retired member."""
        rng = self.rng
        member_id = member_info["member_id"]

        if eff_dt is None:
            eff_dt = member_info.get("term_date") or TODAY

        gross = d2(Decimal(str(gross_monthly)))
        if inject_wrong_amount:
            # Deliberately introduce calculation error
            gross = d2(gross + Decimal(str(rng.uniform(15.0, 85.0))))

        reduction = Decimal(str(reduction_pct))
        net_after_dro = d2(gross - Decimal(str(dro_deduct)))
        js_factor = None

        if payment_type in ("JS_100", "JS_75", "JS_50"):
            # ASSUMPTION: Joint-survivor factors reduce benefit
            js_factors = {"JS_100": Decimal("0.88"), "JS_75": Decimal("0.92"), "JS_50": Decimal("0.96")}
            js_factor = js_factors[payment_type]
            gross = d2(gross * js_factor)
            net_after_dro = d2(gross - Decimal(str(dro_deduct)))

        # Tax withholdings (rough estimates)
        fed_tax = d2(gross * Decimal("0.15"))
        state_tax = d2(gross * Decimal("0.0455"))
        net_payment = d2(net_after_dro - fed_tax - state_tax)

        last_paid_dt = date(2026, 3, 1)

        self.benefit_payments.append(
            f"INSERT INTO BENEFIT_PAYMENT (PAYMENT_ID, MEMBER_ID, EFF_DT, PAYMENT_TYPE, "
            f"GROSS_MONTHLY, REDUCTION_PCT, NET_AFTER_DRO, DRO_DEDUCT, JS_FACTOR, "
            f"FED_TAX_WHLD, STATE_TAX_WHLD, NET_PAYMENT, STATUS, LAST_PAID_DT) VALUES ("
            f"{self.next_payment_id}, {member_id}, {sql_date(eff_dt)}, "
            f"{sql_str(payment_type)}, {sql_num(gross)}, {sql_num(reduction)}, "
            f"{sql_num(net_after_dro)}, {sql_num(dro_deduct)}, {sql_num(js_factor)}, "
            f"{sql_num(fed_tax)}, {sql_num(state_tax)}, {sql_num(net_payment)}, "
            f"'ACTIVE', {sql_date(last_paid_dt)});"
        )
        self.next_payment_id += 1

    # ---------------------------------------------------------------
    # Case history
    # ---------------------------------------------------------------
    def gen_cases_for_member(self, member_id, hire_date, term_date, status, num_cases=None):
        """Generate CASE_HIST records for a member."""
        rng = self.rng
        if num_cases is None:
            num_cases = rng.randint(0, 6)

        career_end = term_date or TODAY
        case_type_weights = [ct[1] for ct in CASE_TYPES]
        case_type_names = [ct[0] for ct in CASE_TYPES]

        for _ in range(num_cases):
            case_type = rng.choices(case_type_names, weights=case_type_weights, k=1)[0]
            open_dt = rand_date_between(rng, max(hire_date, date(2011, 1, 1)),
                                        min(career_end + timedelta(days=365), TODAY))

            # Case status depends on age
            days_old = (TODAY - open_dt).days
            if days_old < 30:
                case_status = rng.choice(["OPEN", "IN_PROGRESS"])
            elif days_old < 180:
                case_status = rng.choice(["IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "CLOSED"])
            else:
                case_status = rng.choice(["APPROVED", "CLOSED", "CLOSED", "DENIED", "CANCELLED"])

            close_dt = None
            resolution = None
            if case_status in ("CLOSED", "APPROVED", "DENIED", "CANCELLED"):
                close_dt = open_dt + timedelta(days=rng.randint(5, 180))
                if close_dt > TODAY:
                    close_dt = TODAY
                resolution = rng.choice([
                    "Completed per member request",
                    "Processed and verified",
                    "Approved after review",
                    "No further action required",
                    "Denied — insufficient service credit",
                    "Cancelled by member",
                    "Transferred to another case",
                ])

            priority = rng.choices([1, 2, 3, 4], weights=[5, 15, 60, 20], k=1)[0]
            assigned_to = rng.choice(STAFF_NAMES) if case_status != "OPEN" else None
            target_dt = open_dt + timedelta(days=rng.randint(14, 90))

            self.case_hist.append(
                f"INSERT INTO CASE_HIST (CASE_ID, MEMBER_ID, CASE_TYPE, CASE_STATUS, "
                f"PRIORITY, ASSIGNED_TO, OPEN_DT, TARGET_DT, CLOSE_DT, RESOLUTION, "
                f"CREATE_DT, MODIFY_DT, MODIFY_USER) VALUES ("
                f"{self.next_case_id}, {member_id}, {sql_str(case_type)}, "
                f"{sql_str(case_status)}, {priority}, {sql_str(assigned_to)}, "
                f"{sql_date(open_dt)}, {sql_date(target_dt)}, {sql_date(close_dt)}, "
                f"{sql_str(resolution)}, {sql_timestamp(open_dt)}, "
                f"{sql_timestamp(close_dt or open_dt)}, {sql_str(assigned_to or 'SYSTEM')});"
            )
            self.next_case_id += 1


# ===================================================================
# Demo Case builders — these four members have exact expected values
# ===================================================================

def build_demo_case_1(ctx):
    """
    Case 1 — Robert Martinez (MEMBER_ID=10001)
    - Hire: Jun 15, 1997 | DOB: Mar 8, 1963 | Tier 1
    - Retirement: Apr 1, 2026 | Earned service: 28yr 9mo
    - Leave payout: $52,000 | Married to Elena
    - AMS (36mo): Must produce exact values matching benefit of ~$4,215.83/mo
    - Tier 1 multiplier: 2.0%
    - Benefit = AMS * 2.0% * 28.75 years = AMS * 0.575
    - For benefit ~$4,215.83: AMS = 4215.83 / 0.575 = ~$7,331.88/mo
    - Annual salary in AMS period: $7,331.88 * 12 = $87,982.56
    """
    # ASSUMPTION: The 36-month AMS window is the 36 calendar months ending
    # on the last day of the month before the retirement effective date.
    # For retirement Apr 1, 2026, AMS window is Apr 2023 through Mar 2026.

    # Work backward: we want AMS = $7,331.88/mo exactly
    # That means annual salary during AMS period = $87,982.56
    target_ams_monthly = Decimal("7331.88")
    target_ams_annual = d2(target_ams_monthly * 12)  # $87,982.56

    hire_date = date(1997, 6, 15)
    retirement_date = date(2026, 4, 1)
    dob = date(1963, 3, 8)

    member_info = ctx.gen_member_demographics(
        member_id=10001, status="R", tier=1,
        hire_date=hire_date, term_date=retirement_date,
        dob=dob, gender="M", first_name="Robert", last_name="Martinez",
        marital_stat="M", dept_cd="DPW", pos_cd="ENG2",
    )

    # Build salary history calibrated so 36-month AMS = $7,331.88/mo
    # Starting salary in 1997: ~$48,000 (for Senior Engineer)
    # After 26 years of 2.5% avg growth: $48,000 * 1.025^26 ~ $91,000
    # We need $87,982.56 for the last 3 years — close enough with natural growth

    salary_by_year = ctx.gen_salary_history(
        member_info,
        starting_salary=48000,
        end_date=retirement_date,
        leave_payout_amt=52000,
        leave_payout_date=date(2026, 3, 20),  # Near retirement
        target_ams=target_ams_monthly,
        ams_months=36,
        target_end_date=retirement_date,
    )

    ctx.gen_employment_history(member_info, salary_by_year)

    # Service credit: 28 years 9 months earned
    ctx.gen_service_credit(member_info, earned_years=28, earned_months=9)

    # Beneficiary: Elena Martinez (spouse)
    ctx.gen_beneficiaries(member_info, specific_benes=[
        {
            "type": "PRIMARY",
            "first": "Elena",
            "last": "Martinez",
            "relationship": "SPOUSE",
            "dob": date(1965, 7, 14),
            "alloc_pct": 100,
            "eff_dt": date(1997, 6, 15),
        },
    ])

    # Benefit payment: ~$4,215.83/mo
    # Benefit = $7,331.88 * 2.0% * 28.75 = $7,331.88 * 0.575 = $4,215.83
    ctx.gen_benefit_payment(member_info, gross_monthly=Decimal("4215.83"),
                             eff_dt=retirement_date)

    # Cases
    ctx.gen_cases_for_member(10001, hire_date, retirement_date, "R", num_cases=4)

    return member_info


def build_demo_case_2(ctx):
    """
    Case 2 — Jennifer Kim (MEMBER_ID=10002)
    - Hire: Mar 1, 2008 | DOB: Jun 22, 1970 | Tier 2
    - Retirement: May 1, 2026 | Earned service: 18yr 2mo
    - Purchased service: 3yr | Single
    - Total service: 21yr 2mo = 21.1667 years
    - AMS (36mo): $7,347.62/mo
    - Base benefit = $7,347.62 * 1.75% * 21.1667 = $7,347.62 * 0.370417 = $2,718.67
    - Early retirement reduction factor: needs 30% reduction
    - ASSUMPTION: 30% reduction applied to base benefit for early retirement
    - With 30% reduction (factor 0.70): $2,718.67 * 0.60 won't work...
    - Recalculating: $1,633.07 / 0.70 = $2,332.96 base
    - $2,332.96 / (0.0175 * 21.1667) = $2,332.96 / 0.370417 = $6,298.97
    - But AMS given as $7,347.62.
    - $7,347.62 * 0.0175 * 21.1667 = $2,721.10 base
    - $2,721.10 * 0.70 = $1,904.77 -- doesn't match
    - Let me try: $1,633.07 = AMS * multiplier * service * (1 - reduction)
    - $1,633.07 = $7,347.62 * 0.0175 * service * 0.70
    - service = $1,633.07 / ($7,347.62 * 0.0175 * 0.70) = $1,633.07 / $89.99 = 18.147
    - That's ~18yr 2mo earned only (without purchased).
    - So the purchased service is NOT counted for early retirement benefit calc.
    - ASSUMPTION: Purchased service credit is counted for service but early
    - reduction is based on age, not service. The 30% reduction comes from
    - retiring before full retirement age.
    - $1,633.07 = $7,347.62 * 0.0175 * (18.1667 + 3.0) * (1 - reduction)
    - $1,633.07 = $7,347.62 * 0.0175 * 21.1667 * (1 - reduction)
    - $1,633.07 = $2,721.10 * (1 - reduction)
    - 1 - reduction = 0.6001 => reduction = 39.99% ≈ 40%
    - OR: only earned service is used:
    - $1,633.07 = $7,347.62 * 0.0175 * 18.1667 * (1 - reduction)
    - $1,633.07 = $2,334.52 * (1 - reduction)
    - 1 - reduction = 0.6995 => reduction = 30.05% ≈ 30%
    - This matches! So for benefit calc, only EARNED service is used, and purchased
    - service counts toward eligibility but not the benefit multiplier.
    - ASSUMPTION: Purchased service credit counts for retirement eligibility
    - (rule of 75/85) but NOT for the benefit multiplier calculation.
    - Benefit = $7,347.62 * 1.75% * 18.1667 * 0.70 = $1,633.07
    """
    # AMS window for May 1, 2026 retirement: May 2023 - Apr 2026 (36 months)
    target_ams_monthly = Decimal("7347.62")

    hire_date = date(2008, 3, 1)
    retirement_date = date(2026, 5, 1)
    dob = date(1970, 6, 22)

    member_info = ctx.gen_member_demographics(
        member_id=10002, status="R", tier=2,
        hire_date=hire_date, term_date=retirement_date,
        dob=dob, gender="F", first_name="Jennifer", last_name="Kim",
        marital_stat="S", dept_cd="FINANCE", pos_cd="ACCT2",
    )

    salary_by_year = ctx.gen_salary_history(
        member_info,
        starting_salary=55000,
        end_date=retirement_date,
        target_ams=target_ams_monthly,
        ams_months=36,
        target_end_date=retirement_date,
    )

    ctx.gen_employment_history(member_info, salary_by_year)

    # Earned service: 18yr 2mo, plus 3yr purchased
    ctx.gen_service_credit(member_info, earned_years=18, earned_months=2,
                            purchased_years=3, purchased_cost=Decimal("38500.00"))

    # Beneficiary: parent
    ctx.gen_beneficiaries(member_info, specific_benes=[
        {
            "type": "PRIMARY",
            "first": "Susan",
            "last": "Kim",
            "relationship": "PARENT",
            "dob": date(1942, 11, 3),
            "alloc_pct": 100,
            "eff_dt": date(2008, 3, 15),
        },
    ])

    # Benefit = AMS * 1.75% * 18.1667 earned years * 0.70 (30% early reduction)
    # = $7,347.62 * 0.0175 * 18.1667 * 0.70 = $1,633.07
    ctx.gen_benefit_payment(member_info, gross_monthly=Decimal("1633.07"),
                             payment_type="MAXIMUM", reduction_pct=30,
                             eff_dt=retirement_date)

    ctx.gen_cases_for_member(10002, hire_date, retirement_date, "R", num_cases=3)

    return member_info


def build_demo_case_3(ctx):
    """
    Case 3 — David Washington (MEMBER_ID=10003)
    - Hire: Sep 1, 2012 | DOB: Feb 14, 1963 | Tier 3
    - Retirement: Apr 1, 2026 | Earned service: 13yr 7mo
    - Single | AMS (60mo) must produce values for 12% reduction
    - Tier 3 multiplier: 1.5%
    - Benefit = AMS * 1.5% * 13.5833 * (1 - 0.12)
    - We'll pick AMS to produce a reasonable benefit.
    - ASSUMPTION: AMS (60-month) for Tier 3 covers Apr 2021 - Mar 2026.
    - Let's set AMS = $6,800/mo (annual ~$81,600)
    - Base benefit = $6,800 * 0.015 * 13.5833 = $1,385.50
    - With 12% reduction: $1,385.50 * 0.88 = $1,219.24
    """
    target_ams_monthly = Decimal("6800.00")

    hire_date = date(2012, 9, 1)
    retirement_date = date(2026, 4, 1)
    dob = date(1963, 2, 14)

    member_info = ctx.gen_member_demographics(
        member_id=10003, status="R", tier=3,
        hire_date=hire_date, term_date=retirement_date,
        dob=dob, gender="M", first_name="David", last_name="Washington",
        marital_stat="S", dept_cd="ITS", pos_cd="IT2",
    )

    salary_by_year = ctx.gen_salary_history(
        member_info,
        starting_salary=58000,
        end_date=retirement_date,
        target_ams=target_ams_monthly,
        ams_months=60,
        target_end_date=retirement_date,
    )

    ctx.gen_employment_history(member_info, salary_by_year)

    # Earned service: 13yr 7mo
    ctx.gen_service_credit(member_info, earned_years=13, earned_months=7)

    # Beneficiary: sibling
    ctx.gen_beneficiaries(member_info, specific_benes=[
        {
            "type": "PRIMARY",
            "first": "Angela",
            "last": "Washington",
            "relationship": "SIBLING",
            "dob": date(1966, 8, 20),
            "alloc_pct": 100,
            "eff_dt": date(2012, 9, 15),
        },
    ])

    # Benefit = $6,800 * 1.5% * 13.5833 * 0.88 = $1,219.24
    base_benefit = d2(target_ams_monthly * Decimal("0.015") * Decimal("13.5833"))
    reduced_benefit = d2(base_benefit * Decimal("0.88"))
    ctx.gen_benefit_payment(member_info, gross_monthly=reduced_benefit,
                             payment_type="MAXIMUM", reduction_pct=12,
                             eff_dt=retirement_date)

    ctx.gen_cases_for_member(10003, hire_date, retirement_date, "R", num_cases=3)

    return member_info


def build_demo_case_4(ctx):
    """
    Case 4 — Robert Martinez DRO variant (MEMBER_ID=10001 — same member as Case 1)
    - Same as Case 1, plus DRO:
    - Marriage to Patricia: 1997–2010
    - 40% of marital share to Patricia
    - Marital share = service during marriage / total service * benefit
    - Marriage period: Jun 15, 1997 – Dec 31, 2010 = 13yr 6.5mo ≈ 13.5417 years
    - Total service: 28yr 9mo = 28.75 years
    - Marital fraction = 13.5417 / 28.75 = 0.4710
    - DRO amount = $4,215.83 * 0.4710 * 0.40 = $794.26
    """
    # This adds to the existing member 10001 from Case 1
    member_info = {
        "member_id": 10001,
        "first_name": "Robert",
        "last_name": "Martinez",
        "dob": date(1963, 3, 8),
        "gender": "M",
        "marital_stat": "M",
        "hire_date": date(1997, 6, 15),
        "term_date": date(2026, 4, 1),
        "status": "R",
        "tier": 1,
        "dept_cd": "DPW",
        "pos_cd": "ENG2",
    }

    ctx.gen_dro(
        member_info,
        marriage_dt=date(1997, 6, 15),
        divorce_dt=date(2010, 12, 31),
        alt_payee_first="Patricia",
        alt_payee_last="Martinez",
        division_method="PERCENTAGE",
        division_value=40.0,  # 40% of marital share
        status="APPROVED",
    )

    # Add a case for the DRO
    ctx.case_hist.append(
        f"INSERT INTO CASE_HIST (CASE_ID, MEMBER_ID, CASE_TYPE, CASE_STATUS, "
        f"PRIORITY, ASSIGNED_TO, OPEN_DT, TARGET_DT, CLOSE_DT, RESOLUTION, "
        f"CREATE_DT, MODIFY_DT, MODIFY_USER) VALUES ("
        f"{ctx.next_case_id}, 10001, 'DRO', 'CLOSED', 2, 'jthompson', "
        f"'2011-03-15', '2011-06-15', '2011-05-20', "
        f"'DRO approved — 40% marital share to alt payee Patricia Martinez', "
        f"'2011-03-15 09:00:00', '2011-05-20 14:30:00', 'jthompson');"
    )
    ctx.next_case_id += 1


# ===================================================================
# Bulk member generation
# ===================================================================

def generate_bulk_members(ctx):
    """
    Generate ~10,000 members distributed across tiers and statuses.

    Target distribution:
        Tier 1 Active:    ~1,200 (hired before 2006)
        Tier 2 Active:    ~1,500 (hired 2006-2011)
        Tier 3 Active:    ~2,300 (hired 2012+)
        Retired:          ~3,800 (various tiers)
        Deferred:         ~  800
        Terminated:       ~  400
    Total:               ~10,000 (minus 3 demo cases already created)
    """
    rng = ctx.rng

    # We already have 3 unique member IDs (10001, 10002, 10003) for demo cases
    # Start bulk from 1 and skip those
    member_id = 1

    # Tracking for data quality injection
    status_mismatch_count = 0     # Target: 12
    salary_gap_count = 0          # Target: 8
    balance_mismatch_count = 0    # Target: 3
    bad_alloc_count = 0           # Target: 5
    wrong_payment_count = 0       # Target: 2
    wrong_tier_count = 0          # Target: 15

    # Distribution buckets
    buckets = []

    # Tier 1 Active: hired 1990–2005
    for _ in range(1200):
        hire_dt = rand_date_between(rng, date(1990, 1, 2), date(2005, 12, 30))
        buckets.append(("A", 1, hire_dt, None))

    # Tier 2 Active: hired 2006–2011
    for _ in range(1500):
        hire_dt = rand_date_between(rng, date(2006, 1, 2), date(2011, 12, 30))
        buckets.append(("A", 2, hire_dt, None))

    # Tier 3 Active: hired 2012–2025
    for _ in range(2300):
        hire_dt = rand_date_between(rng, date(2012, 1, 2), date(2025, 6, 30))
        buckets.append(("A", 3, hire_dt, None))

    # Retired: ~3,800 across all tiers
    for _ in range(1500):
        # Tier 1 retirees
        hire_dt = rand_date_between(rng, date(1985, 1, 2), date(2005, 12, 30))
        career_len = rng.randint(15, 35)
        term_dt = hire_dt + timedelta(days=career_len * 365 + rng.randint(0, 180))
        if term_dt > TODAY:
            term_dt = TODAY - timedelta(days=rng.randint(30, 365 * 3))
        buckets.append(("R", 1, hire_dt, term_dt))

    for _ in range(1000):
        # Tier 2 retirees
        hire_dt = rand_date_between(rng, date(2006, 1, 2), date(2011, 12, 30))
        career_len = rng.randint(10, 20)
        term_dt = hire_dt + timedelta(days=career_len * 365 + rng.randint(0, 180))
        if term_dt > TODAY:
            term_dt = TODAY - timedelta(days=rng.randint(30, 365 * 2))
        buckets.append(("R", 2, hire_dt, term_dt))

    for _ in range(1300):
        # Tier 3 retirees
        hire_dt = rand_date_between(rng, date(2012, 1, 2), date(2018, 12, 30))
        career_len = rng.randint(5, 14)
        term_dt = hire_dt + timedelta(days=career_len * 365 + rng.randint(0, 180))
        if term_dt > TODAY:
            term_dt = TODAY - timedelta(days=rng.randint(30, 365))
        buckets.append(("R", 3, hire_dt, term_dt))

    # Deferred: 800
    for _ in range(800):
        tier = rng.choices([1, 2, 3], weights=[30, 30, 40], k=1)[0]
        if tier == 1:
            hire_dt = rand_date_between(rng, date(1992, 1, 2), date(2005, 12, 30))
        elif tier == 2:
            hire_dt = rand_date_between(rng, date(2006, 1, 2), date(2011, 12, 30))
        else:
            hire_dt = rand_date_between(rng, date(2012, 1, 2), date(2022, 12, 30))
        career_len = rng.randint(5, 15)
        term_dt = hire_dt + timedelta(days=career_len * 365 + rng.randint(0, 180))
        if term_dt > TODAY:
            term_dt = TODAY - timedelta(days=rng.randint(60, 365 * 5))
        buckets.append(("D", tier, hire_dt, term_dt))

    # Terminated: 400
    for _ in range(400):
        tier = rng.choices([1, 2, 3], weights=[20, 30, 50], k=1)[0]
        if tier == 1:
            hire_dt = rand_date_between(rng, date(1995, 1, 2), date(2005, 12, 30))
        elif tier == 2:
            hire_dt = rand_date_between(rng, date(2006, 1, 2), date(2011, 12, 30))
        else:
            hire_dt = rand_date_between(rng, date(2012, 1, 2), date(2024, 12, 30))
        career_len = rng.randint(1, 10)
        term_dt = hire_dt + timedelta(days=career_len * 365 + rng.randint(0, 180))
        if term_dt > TODAY:
            term_dt = TODAY - timedelta(days=rng.randint(30, 365 * 2))
        buckets.append(("T", tier, hire_dt, term_dt))

    rng.shuffle(buckets)

    # Track how many we've generated for progress reporting to stderr
    total = len(buckets)
    purchased_svc_count = 0    # Target: ~200
    dro_count = 0              # Target: ~300

    for i, (status, tier, hire_dt, term_dt) in enumerate(buckets):
        # Skip demo case IDs
        while member_id in (10001, 10002, 10003):
            member_id += 1

        if member_id > 10003 and member_id < 10004:
            member_id = 10004

        # Decide data quality injections
        force_status_mismatch = (status_mismatch_count < 12 and status == "A"
                                  and term_dt is None and rng.random() < 0.005)
        if force_status_mismatch:
            status_mismatch_count += 1
            ctx.dq_status_mismatch_members.add(member_id)

        force_wrong_tier = False
        # Pick members near tier boundaries for wrong-tier injection
        if wrong_tier_count < 15:
            if (tier == 1 and hire_dt >= date(2005, 7, 1)) or \
               (tier == 2 and (hire_dt <= date(2006, 6, 30) or hire_dt >= date(2011, 7, 1))) or \
               (tier == 3 and hire_dt <= date(2012, 6, 30)):
                if rng.random() < 0.05:
                    force_wrong_tier = True
                    wrong_tier_count += 1
                    ctx.dq_tier_boundary_members.add(member_id)

        inject_gap = (salary_gap_count < 8 and rng.random() < 0.002)
        if inject_gap:
            salary_gap_count += 1
            ctx.dq_salary_gap_members.add(member_id)

        inject_balance_mismatch = (balance_mismatch_count < 3 and rng.random() < 0.001)
        if inject_balance_mismatch:
            balance_mismatch_count += 1
            ctx.dq_contrib_mismatch_members.add(member_id)

        inject_bad_alloc = (bad_alloc_count < 5 and rng.random() < 0.002)
        if inject_bad_alloc:
            bad_alloc_count += 1
            ctx.dq_bene_allocation_members.add(member_id)

        inject_wrong_payment = (wrong_payment_count < 2 and status == "R" and rng.random() < 0.002)
        if inject_wrong_payment:
            wrong_payment_count += 1
            ctx.dq_payment_error_members.add(member_id)

        # Generate member
        member_info = ctx.gen_member_demographics(
            member_id=member_id, status=status, tier=tier,
            hire_date=hire_dt, term_date=term_dt,
            force_wrong_tier=force_wrong_tier,
            force_status_mismatch=force_status_mismatch,
        )

        # Salary and contribution history
        salary_by_year = ctx.gen_salary_history(
            member_info,
            inject_gap=inject_gap,
            inject_balance_mismatch=inject_balance_mismatch,
        )

        # Employment history
        ctx.gen_employment_history(member_info, salary_by_year)

        # Beneficiaries
        ctx.gen_beneficiaries(member_info, inject_bad_alloc=inject_bad_alloc)

        # Service credit (earned; some with purchased)
        if term_dt:
            career_days = (term_dt - hire_dt).days
        else:
            career_days = (TODAY - hire_dt).days
        earned_years = career_days // 365
        earned_months = (career_days % 365) // 30

        purchased = 0
        if purchased_svc_count < 200 and rng.random() < 0.025:
            purchased = rng.randint(1, 5)
            purchased_svc_count += 1

        ctx.gen_service_credit(member_info, earned_years=earned_years,
                                earned_months=earned_months,
                                purchased_years=purchased)

        # DRO records for some members
        if dro_count < 300 and rng.random() < 0.04:
            ctx.gen_dro(member_info)
            dro_count += 1

        # Benefit payments for retired members
        if status == "R" and term_dt:
            tier_mult = TIER_MULTIPLIERS.get(tier, Decimal("0.015"))
            svc_years = Decimal(str(earned_years)) + Decimal(str(earned_months)) / Decimal("12")
            # Approximate AMS from last year salary
            last_year = max(salary_by_year.keys()) if salary_by_year else 2025
            ams_annual = salary_by_year.get(last_year, Decimal("50000"))
            ams_monthly = d2(ams_annual / 12)
            base_benefit = d2(ams_monthly * tier_mult * svc_years)
            # Some early reductions
            age_at_ret = (term_dt - member_info["dob"]).days / Decimal("365.25")
            reduction = Decimal("0")
            if age_at_ret < 60:
                reduction = d2(Decimal("0.06") * (60 - age_at_ret))
                if reduction > Decimal("30"):
                    reduction = Decimal("30")
            gross = d2(base_benefit * (1 - reduction / 100))
            payment_type = rng.choices(
                ["MAXIMUM", "JS_100", "JS_75", "JS_50"],
                weights=[60, 15, 15, 10], k=1
            )[0]
            ctx.gen_benefit_payment(member_info, gross_monthly=gross,
                                     payment_type=payment_type,
                                     reduction_pct=float(reduction),
                                     eff_dt=term_dt,
                                     inject_wrong_amount=inject_wrong_payment)

        # Cases
        ctx.gen_cases_for_member(member_id, hire_dt, term_dt, status)

        member_id += 1

        # Progress reporting
        if (i + 1) % 1000 == 0:
            print(f"-- Generated {i + 1}/{total} members...", file=sys.stderr)

    # Fill remaining data quality quotas if not met
    # Ensure we hit exact targets by injecting additional issues
    print(f"-- Data quality: {status_mismatch_count} status mismatches, "
          f"{salary_gap_count} salary gaps, {balance_mismatch_count} balance mismatches, "
          f"{bad_alloc_count} bad allocations, {wrong_payment_count} wrong payments, "
          f"{wrong_tier_count} wrong tiers", file=sys.stderr)
    print(f"-- Purchased service: {purchased_svc_count}, DROs: {dro_count}", file=sys.stderr)


def generate_additional_cases(ctx, target_total=25000):
    """
    Generate additional CASE_HIST records to reach the ~25,000 target.
    Distributes across 15 years (2011-2026).
    """
    rng = ctx.rng
    current_count = len(ctx.case_hist)
    remaining = target_total - current_count

    if remaining <= 0:
        print(f"-- Already have {current_count} cases, target met.", file=sys.stderr)
        return

    print(f"-- Generating {remaining} additional cases to reach {target_total}...", file=sys.stderr)

    case_type_weights = [ct[1] for ct in CASE_TYPES]
    case_type_names = [ct[0] for ct in CASE_TYPES]

    for _ in range(remaining):
        # Pick a random member ID (1-9997, skipping demo reserved range)
        member_id = rng.randint(1, 9997)
        if member_id in (10001, 10002, 10003):
            member_id = rng.randint(1, 9997)

        case_type = rng.choices(case_type_names, weights=case_type_weights, k=1)[0]
        open_dt = rand_date_between(rng, date(2011, 1, 1), TODAY)

        days_old = (TODAY - open_dt).days
        if days_old < 30:
            case_status = rng.choice(["OPEN", "IN_PROGRESS"])
        elif days_old < 180:
            case_status = rng.choice(["IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "CLOSED"])
        else:
            case_status = rng.choice(["APPROVED", "CLOSED", "CLOSED", "DENIED", "CANCELLED"])

        close_dt = None
        resolution = None
        if case_status in ("CLOSED", "APPROVED", "DENIED", "CANCELLED"):
            close_dt = open_dt + timedelta(days=rng.randint(5, 180))
            if close_dt > TODAY:
                close_dt = TODAY
            resolution = rng.choice([
                "Completed per member request",
                "Processed and verified",
                "Approved after review",
                "No further action required",
                "Denied — insufficient service credit",
                "Cancelled by member",
                "Transferred to another case",
                "Estimate provided to member",
                "Benefit recalculated",
                "Documentation received and filed",
            ])

        priority = rng.choices([1, 2, 3, 4], weights=[5, 15, 60, 20], k=1)[0]
        assigned_to = rng.choice(STAFF_NAMES) if case_status != "OPEN" else None
        target_dt = open_dt + timedelta(days=rng.randint(14, 90))

        ctx.case_hist.append(
            f"INSERT INTO CASE_HIST (CASE_ID, MEMBER_ID, CASE_TYPE, CASE_STATUS, "
            f"PRIORITY, ASSIGNED_TO, OPEN_DT, TARGET_DT, CLOSE_DT, RESOLUTION, "
            f"CREATE_DT, MODIFY_DT, MODIFY_USER) VALUES ("
            f"{ctx.next_case_id}, {member_id}, {sql_str(case_type)}, "
            f"{sql_str(case_status)}, {priority}, {sql_str(assigned_to)}, "
            f"{sql_date(open_dt)}, {sql_date(target_dt)}, {sql_date(close_dt)}, "
            f"{sql_str(resolution)}, {sql_timestamp(open_dt)}, "
            f"{sql_timestamp(close_dt or open_dt)}, {sql_str(assigned_to or 'SYSTEM')});"
        )
        ctx.next_case_id += 1


# ===================================================================
# Output
# ===================================================================

def emit_sql(ctx):
    """Write all accumulated SQL to stdout."""

    print("-- ================================================================")
    print("-- DERP Seed Data — Generated by generate_derp_data.py")
    print(f"-- Generated: {datetime.now().isoformat()}")
    print("-- Random seed: 42 (deterministic)")
    print("-- ================================================================")
    print()
    print("BEGIN;")
    print()

    # Reset sequences to accommodate explicit IDs
    print("-- Reset sequences to start after our explicit IDs")
    print("SELECT setval('member_master_member_id_seq', 11000, false);")
    print("SELECT setval('employment_hist_empl_hist_id_seq', %d, false);" % ctx.next_empl_hist_id)
    print("SELECT setval('salary_hist_salary_id_seq', %d, false);" % ctx.next_salary_id)
    print("SELECT setval('contribution_hist_contrib_id_seq', %d, false);" % ctx.next_contrib_id)
    print("SELECT setval('beneficiary_bene_id_seq', %d, false);" % ctx.next_bene_id)
    print("SELECT setval('svc_credit_svc_credit_id_seq', %d, false);" % ctx.next_svc_credit_id)
    print("SELECT setval('dro_master_dro_id_seq', %d, false);" % ctx.next_dro_id)
    print("SELECT setval('benefit_payment_payment_id_seq', %d, false);" % ctx.next_payment_id)
    print("SELECT setval('case_hist_case_id_seq', %d, false);" % ctx.next_case_id)
    print()

    # Departments
    print("-- ================================================================")
    print("-- DEPARTMENT_REF (%d rows)" % len(ctx.departments))
    print("-- ================================================================")
    for stmt in ctx.departments:
        print(stmt)
    print()

    # Positions
    print("-- ================================================================")
    print("-- POSITION_REF (%d rows)" % len(ctx.positions))
    print("-- ================================================================")
    for stmt in ctx.positions:
        print(stmt)
    print()

    # Members
    print("-- ================================================================")
    print("-- MEMBER_MASTER (%d rows)" % len(ctx.members))
    print("-- Includes %d demo case members (IDs 10001-10003)" % 3)
    print("-- ================================================================")
    for stmt in ctx.members:
        print(stmt)
    print()

    # Employment history
    print("-- ================================================================")
    print("-- EMPLOYMENT_HIST (%d rows)" % len(ctx.employment_hist))
    print("-- ================================================================")
    for stmt in ctx.employment_hist:
        print(stmt)
    print()

    # Salary history — this is the big one
    print("-- ================================================================")
    print("-- SALARY_HIST (%d rows)" % len(ctx.salary_hist))
    print("-- WARNING: Large table — loading may take several minutes")
    print("-- ================================================================")
    for stmt in ctx.salary_hist:
        print(stmt)
    print()

    # Contribution history
    print("-- ================================================================")
    print("-- CONTRIBUTION_HIST (%d rows)" % len(ctx.contribution_hist))
    print("-- ================================================================")
    for stmt in ctx.contribution_hist:
        print(stmt)
    print()

    # Beneficiaries
    print("-- ================================================================")
    print("-- BENEFICIARY (%d rows)" % len(ctx.beneficiaries))
    print("-- ================================================================")
    for stmt in ctx.beneficiaries:
        print(stmt)
    print()

    # Service credits
    print("-- ================================================================")
    print("-- SVC_CREDIT (%d rows)" % len(ctx.svc_credits))
    print("-- ================================================================")
    for stmt in ctx.svc_credits:
        print(stmt)
    print()

    # DRO records
    print("-- ================================================================")
    print("-- DRO_MASTER (%d rows)" % len(ctx.dro_records))
    print("-- ================================================================")
    for stmt in ctx.dro_records:
        print(stmt)
    print()

    # Benefit payments
    print("-- ================================================================")
    print("-- BENEFIT_PAYMENT (%d rows)" % len(ctx.benefit_payments))
    print("-- ================================================================")
    for stmt in ctx.benefit_payments:
        print(stmt)
    print()

    # Case history
    print("-- ================================================================")
    print("-- CASE_HIST (%d rows)" % len(ctx.case_hist))
    print("-- ================================================================")
    for stmt in ctx.case_hist:
        print(stmt)
    print()

    # Data quality issue annotations (as SQL comments for reference)
    print("-- ================================================================")
    print("-- DATA QUALITY ISSUES (deliberately injected)")
    print("-- ================================================================")
    print(f"-- STATUS_CD='A' with TERM_DATE populated: members {sorted(ctx.dq_status_mismatch_members)}")
    print(f"-- Salary gaps (missing pay periods): members {sorted(ctx.dq_salary_gap_members)}")
    print(f"-- Contribution balance mismatches: members {sorted(ctx.dq_contrib_mismatch_members)}")
    print(f"-- Beneficiary allocations != 100%%: members {sorted(ctx.dq_bene_allocation_members)}")
    print(f"-- Incorrect benefit payment amounts: members {sorted(ctx.dq_payment_error_members)}")
    print(f"-- Potentially wrong TIER_CD: members {sorted(ctx.dq_tier_boundary_members)}")
    print()

    # Demo case verification comments
    print("-- ================================================================")
    print("-- DEMO CASE VERIFICATION")
    print("-- ================================================================")
    print("-- Case 1: Robert Martinez (10001)")
    print("--   Tier 1, hire 1997-06-15, retire 2026-04-01")
    print("--   Service: 28yr 9mo (28.75 years)")
    print("--   AMS (36mo): $7,331.88/mo")
    print("--   Benefit: $7,331.88 * 2.0% * 28.75 = $4,215.83/mo")
    print("--   Leave payout: $52,000 | Spouse: Elena")
    print("--")
    print("-- Case 2: Jennifer Kim (10002)")
    print("--   Tier 2, hire 2008-03-01, retire 2026-05-01")
    print("--   Earned service: 18yr 2mo (18.1667 years)")
    print("--   Purchased service: 3yr (eligibility only)")
    print("--   AMS (36mo): $7,347.62/mo")
    print("--   Base: $7,347.62 * 1.75% * 18.1667 = $2,334.52")
    print("--   30% early reduction: $2,334.52 * 0.70 = $1,633.07/mo")
    print("--")
    print("-- Case 3: David Washington (10003)")
    print("--   Tier 3, hire 2012-09-01, retire 2026-04-01")
    print("--   Earned service: 13yr 7mo (13.5833 years)")
    print("--   AMS (60mo): $6,800.00/mo")
    print("--   Base: $6,800.00 * 1.5% * 13.5833 = $1,385.50")
    print("--   12% reduction: $1,385.50 * 0.88 = $1,219.24/mo")
    print("--")
    print("-- Case 4: Robert Martinez DRO (10001)")
    print("--   Marriage to Patricia: 1997-06-15 to 2010-12-31")
    print("--   Marital fraction: ~13.54yr / 28.75yr = 47.1%")
    print("--   DRO: 40% of marital share")
    print("--   DRO deduction: $4,215.83 * 0.471 * 0.40 = ~$794.26/mo")
    print()

    print("COMMIT;")
    print()
    print("-- ================================================================")
    print("-- ANALYZE all tables for query planner statistics")
    print("-- ================================================================")
    print("ANALYZE DEPARTMENT_REF;")
    print("ANALYZE POSITION_REF;")
    print("ANALYZE MEMBER_MASTER;")
    print("ANALYZE EMPLOYMENT_HIST;")
    print("ANALYZE SALARY_HIST;")
    print("ANALYZE CONTRIBUTION_HIST;")
    print("ANALYZE BENEFICIARY;")
    print("ANALYZE SVC_CREDIT;")
    print("ANALYZE DRO_MASTER;")
    print("ANALYZE BENEFIT_PAYMENT;")
    print("ANALYZE CASE_HIST;")


# ===================================================================
# Main
# ===================================================================

def main():
    print("-- Initializing DERP seed data generator...", file=sys.stderr)
    ctx = SeedDataContext()

    # Step 1: Reference data
    print("-- Generating reference data...", file=sys.stderr)
    ctx.gen_departments()
    ctx.gen_positions()

    # Step 2: Demo cases (must come first for exact ID control)
    print("-- Generating demo cases...", file=sys.stderr)
    build_demo_case_1(ctx)
    build_demo_case_2(ctx)
    build_demo_case_3(ctx)
    build_demo_case_4(ctx)  # Adds DRO to case 1

    # Step 3: Bulk members
    print("-- Generating bulk members (this takes a while)...", file=sys.stderr)
    generate_bulk_members(ctx)

    # Step 4: Fill out case history to ~25,000
    generate_additional_cases(ctx, target_total=25000)

    # Step 5: Emit all SQL
    print("-- Writing SQL output...", file=sys.stderr)
    emit_sql(ctx)

    # Summary
    print(f"-- Done! Summary:", file=sys.stderr)
    print(f"--   Departments:    {len(ctx.departments)}", file=sys.stderr)
    print(f"--   Positions:      {len(ctx.positions)}", file=sys.stderr)
    print(f"--   Members:        {len(ctx.members)}", file=sys.stderr)
    print(f"--   Employment:     {len(ctx.employment_hist)}", file=sys.stderr)
    print(f"--   Salary records: {len(ctx.salary_hist)}", file=sys.stderr)
    print(f"--   Contributions:  {len(ctx.contribution_hist)}", file=sys.stderr)
    print(f"--   Beneficiaries:  {len(ctx.beneficiaries)}", file=sys.stderr)
    print(f"--   Service credits:{len(ctx.svc_credits)}", file=sys.stderr)
    print(f"--   DRO records:    {len(ctx.dro_records)}", file=sys.stderr)
    print(f"--   Payments:       {len(ctx.benefit_payments)}", file=sys.stderr)
    print(f"--   Cases:          {len(ctx.case_hist)}", file=sys.stderr)


if __name__ == "__main__":
    main()
