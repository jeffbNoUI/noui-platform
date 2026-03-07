#!/usr/bin/env python3
"""
ERPNext Seed Data Generator for noui-connector-lab.

Populates the ERPNext MariaDB database with realistic HR/payroll test data
via direct SQL inserts. Generates 200 employees with 3 years of salary,
leave, attendance, and payroll data, plus embedded data quality issues
for monitoring/anomaly detection validation.

Usage:
    pip install pymysql
    python seed.py
    python seed.py --employees 200 --years 3 --dq-issues
    python seed.py --host 127.0.0.1 --port 3307 --user root --password admin --database _0919b4e09c48d335
"""

import argparse
import calendar
import random
import sys
from datetime import date, datetime, timedelta
from typing import Optional

import pymysql

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
COMPANY = "NoUI Labs"
COMPANY_ABBR = "NL"
CURRENCY = "USD"
OWNER = "Administrator"

DEPARTMENTS = ["HR", "Engineering", "Finance", "Operations", "Sales", "Legal"]

DESIGNATIONS = [
    "Software Engineer",
    "Senior Engineer",
    "Engineering Manager",
    "HR Specialist",
    "HR Manager",
    "Accountant",
    "Finance Manager",
    "Sales Representative",
    "Operations Analyst",
    "Legal Counsel",
]

# Designation -> salary structure mapping
DESIGNATION_STRUCTURE = {
    "Software Engineer": "Basic Salary Structure",
    "Senior Engineer": "Senior Salary Structure",
    "Engineering Manager": "Management Salary Structure",
    "HR Specialist": "Basic Salary Structure",
    "HR Manager": "Management Salary Structure",
    "Accountant": "Basic Salary Structure",
    "Finance Manager": "Management Salary Structure",
    "Sales Representative": "Basic Salary Structure",
    "Operations Analyst": "Basic Salary Structure",
    "Legal Counsel": "Senior Salary Structure",
}

# Designation -> annual salary range
DESIGNATION_SALARY_RANGE = {
    "Software Engineer": (55000, 85000),
    "Senior Engineer": (85000, 120000),
    "Engineering Manager": (110000, 150000),
    "HR Specialist": (45000, 65000),
    "HR Manager": (80000, 110000),
    "Accountant": (50000, 75000),
    "Finance Manager": (90000, 130000),
    "Sales Representative": (40000, 70000),
    "Operations Analyst": (50000, 75000),
    "Legal Counsel": (90000, 140000),
}

LEAVE_TYPES = [
    ("Casual Leave", 12),
    ("Sick Leave", 10),
    ("Privilege Leave", 15),
]

FIRST_NAMES_MALE = [
    "James", "Robert", "John", "Michael", "David", "William", "Richard",
    "Joseph", "Thomas", "Charles", "Daniel", "Matthew", "Anthony", "Mark",
    "Steven", "Paul", "Andrew", "Kenneth", "Joshua", "Kevin", "Brian",
    "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob",
    "Gary", "Nicholas",
]

FIRST_NAMES_FEMALE = [
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth",
    "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty",
    "Margaret", "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily",
    "Donna", "Michelle", "Carol", "Amanda", "Melissa", "Deborah",
    "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_str() -> str:
    """Return current datetime as string for creation/modified fields."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")


def dt_str(d: date) -> str:
    """Convert date to datetime string."""
    return datetime(d.year, d.month, d.day, 10, 0, 0).strftime(
        "%Y-%m-%d %H:%M:%S.%f"
    )


def last_day_of_month(year: int, month: int) -> date:
    """Return last day of the given month."""
    return date(year, month, calendar.monthrange(year, month)[1])


def first_day_of_month(year: int, month: int) -> date:
    """Return first day of the given month."""
    return date(year, month, 1)


def random_date(start: date, end: date) -> date:
    """Return a random date between start and end inclusive."""
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def _validate_identifier(name: str) -> str:
    """Validate SQL identifier contains only safe characters."""
    import re
    if not re.match(r'^[a-zA-Z0-9_ ]+$', name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


def batch_insert(cursor, table: str, columns: list[str], rows: list[tuple],
                 batch_size: int = 500):
    """Insert rows in batches for performance."""
    if not rows:
        return
    _validate_identifier(table)
    for c in columns:
        _validate_identifier(c)
    placeholders = ", ".join(["%s"] * len(columns))
    col_str = ", ".join(f"`{c}`" for c in columns)
    sql = f"INSERT INTO `{table}` ({col_str}) VALUES ({placeholders})"
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        cursor.executemany(sql, batch)


def generate_months(start_date: date, end_date: date) -> list[tuple[int, int]]:
    """Generate list of (year, month) tuples between two dates."""
    months = []
    y, m = start_date.year, start_date.month
    while (y, m) <= (end_date.year, end_date.month):
        months.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


# ---------------------------------------------------------------------------
# Data generators
# ---------------------------------------------------------------------------
class ERPNextSeeder:
    def __init__(self, conn, num_employees: int = 200, num_years: int = 3,
                 embed_dq: bool = True):
        self.conn = conn
        self.cursor = conn.cursor()
        self.num_employees = num_employees
        self.num_years = num_years
        self.embed_dq = embed_dq

        self.data_start = date(2023, 1, 1)
        self.data_end = date(2023 + num_years - 1, 12, 31)

        # Tracking
        self.employees = []  # list of dicts
        self.salary_assignments = {}  # emp_name -> assignment dict
        self.row_counts = {}
        self.dq_counts = {
            "salary_gaps": 0,
            "negative_leave": 0,
            "missing_separation": 0,
            "missing_payroll": 0,
            "invalid_hire_dates": 0,
            "contribution_imbalance": 0,
        }

        # DQ issue targets (employee indices)
        self.dq_salary_gap_emps = set()
        self.dq_negative_leave_emps = set()
        self.dq_invalid_hire_emps = set()
        self.dq_imbalance_emps = set()
        self.dq_missing_separation_emps = set()
        self.dq_missing_payroll_months = set()

    def run(self):
        """Execute the full seeding process."""
        print("=" * 60)
        print("ERPNext Seed Data Generator")
        print(f"  Employees: {self.num_employees}")
        print(f"  Date range: {self.data_start} to {self.data_end}")
        print(f"  DQ issues: {'Yes' if self.embed_dq else 'No'}")
        print("=" * 60)

        self._plan_dq_issues()
        self._clean()
        self._seed_company()
        self._seed_departments()
        self._seed_designations()
        self._seed_employees()
        self._seed_salary_structures()
        self._seed_salary_structure_assignments()
        self._seed_salary_slips()
        self._seed_payroll_entries()
        self._seed_leave_allocations()
        self._seed_leave_applications()
        self._seed_attendance()
        self._seed_employee_separations()

        self.conn.commit()
        self._print_summary()

    def _plan_dq_issues(self):
        """Pre-select which employees/months get DQ issues."""
        if not self.embed_dq:
            return

        all_indices = list(range(self.num_employees))
        terminated_indices = list(range(
            self.num_employees - 30, self.num_employees
        ))  # last 30 are terminated

        # 1. Salary history gaps: 12 employees
        self.dq_salary_gap_emps = set(random.sample(all_indices[:170], 12))

        # 2. Negative leave balances: 15 employees
        self.dq_negative_leave_emps = set(random.sample(all_indices[:170], 15))

        # 3. Missing separation records: 5 of the 30 terminated
        self.dq_missing_separation_emps = set(
            random.sample(terminated_indices, 5)
        )

        # 4. Missing payroll runs: 3 random months
        all_months = generate_months(self.data_start, self.data_end)
        # Avoid first and last month for cleaner testing
        candidate_months = all_months[1:-1]
        missing = random.sample(candidate_months, 3)
        self.dq_missing_payroll_months = set(missing)

        # 5. Invalid hire dates: 8 employees
        self.dq_invalid_hire_emps = set(random.sample(all_indices[:170], 8))

        # 6. Contribution imbalance: 10 employees
        remaining = [
            i for i in all_indices[:170]
            if i not in self.dq_salary_gap_emps
        ]
        self.dq_imbalance_emps = set(random.sample(remaining, 10))

    def _clean(self):
        """Remove previously seeded data."""
        print("\n[1/13] Cleaning existing seed data...")
        tables_to_clean = [
            ("tabAttendance", "company"),
            ("tabLeave Application", "company"),
            ("tabLeave Allocation", "company"),
            ("tabPayroll Entry", "company"),
            ("tabSalary Slip", "company"),
            ("tabSalary Structure Assignment", "company"),
            ("tabSalary Structure", "company"),
            ("tabEmployee Separation", "company"),
            ("tabEmployee", "company"),
            ("tabDepartment", "company"),
            ("tabDesignation", None),  # No company field on designation
        ]
        for table, company_col in tables_to_clean:
            try:
                if company_col:
                    self.cursor.execute(
                        f"DELETE FROM `{table}` WHERE `{company_col}` = %s",
                        (COMPANY,),
                    )
                else:
                    # For designations, delete by name match
                    placeholders = ", ".join(["%s"] * len(DESIGNATIONS))
                    self.cursor.execute(
                        f"DELETE FROM `{table}` WHERE `name` IN ({placeholders})",
                        DESIGNATIONS,
                    )
                deleted = self.cursor.rowcount
                if deleted > 0:
                    print(f"  Cleaned {deleted} rows from {table}")
            except pymysql.err.ProgrammingError:
                pass  # Table may not exist
            except pymysql.err.OperationalError:
                pass

        # Clean company record
        try:
            self.cursor.execute(
                "DELETE FROM `tabCompany` WHERE `name` = %s", (COMPANY,)
            )
        except Exception:
            pass

        self.conn.commit()
        print("  Clean complete.")

    def _seed_company(self):
        """Create the NoUI Labs company record."""
        print("\n[2/13] Seeding company...")
        ts = now_str()
        self.cursor.execute(
            """INSERT INTO `tabCompany`
               (`name`, `creation`, `modified`, `modified_by`, `owner`,
                `docstatus`, `idx`, `company_name`, `abbr`, `country`,
                `default_currency`, `is_group`, `lft`, `rgt`)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (COMPANY, ts, ts, OWNER, OWNER, 0, 0, COMPANY, COMPANY_ABBR,
             "United States", CURRENCY, 0, 0, 0),
        )
        self.row_counts["tabCompany"] = 1
        print(f"  Created company: {COMPANY}")

    def _seed_departments(self):
        """Create department records."""
        print("\n[3/13] Seeding departments...")
        ts = now_str()
        rows = []
        for i, dept in enumerate(DEPARTMENTS):
            dept_name = f"{dept} - {COMPANY_ABBR}"
            lft = (i + 1) * 2
            rgt = lft + 1
            rows.append((
                dept_name, ts, ts, OWNER, OWNER, 0, i,
                dept, COMPANY, 0, lft, rgt,
            ))
        batch_insert(
            self.cursor,
            "tabDepartment",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "department_name", "company",
             "is_group", "lft", "rgt"],
            rows,
        )
        self.row_counts["tabDepartment"] = len(rows)
        print(f"  Created {len(rows)} departments")

    def _seed_designations(self):
        """Create designation records."""
        print("\n[4/13] Seeding designations...")
        ts = now_str()
        rows = []
        for i, desig in enumerate(DESIGNATIONS):
            rows.append((desig, ts, ts, OWNER, OWNER, 0, i, desig))
        batch_insert(
            self.cursor,
            "tabDesignation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "designation_name"],
            rows,
        )
        self.row_counts["tabDesignation"] = len(rows)
        print(f"  Created {len(rows)} designations")

    def _seed_employees(self):
        """Generate and insert employee records."""
        print("\n[5/13] Seeding employees...")
        ts = now_str()
        rows = []
        num_terminated = 30
        num_active = self.num_employees - num_terminated

        for i in range(self.num_employees):
            emp_id = f"HR-EMP-{i + 1:05d}"
            gender = random.choice(["Male", "Female"])
            if gender == "Male":
                first_name = random.choice(FIRST_NAMES_MALE)
            else:
                first_name = random.choice(FIRST_NAMES_FEMALE)
            last_name = random.choice(LAST_NAMES)
            employee_name = f"{first_name} {last_name}"

            dob = random_date(date(1960, 1, 1), date(1990, 12, 31))
            doj = random_date(date(2020, 1, 1), date(2023, 6, 30))

            # DQ: Invalid hire dates
            if i in self.dq_invalid_hire_emps:
                doj = random_date(date(2027, 1, 1), date(2027, 12, 31))
                self.dq_counts["invalid_hire_dates"] += 1

            is_terminated = i >= num_active
            status = "Left" if is_terminated else "Active"

            # For terminated employees, set a relieving date
            relieving_date = None
            if is_terminated:
                relieving_date = random_date(
                    date(2024, 1, 1), date(2025, 6, 30)
                )

            department = random.choice(
                [f"{d} - {COMPANY_ABBR}" for d in DEPARTMENTS]
            )
            designation = random.choice(DESIGNATIONS)

            emp_data = {
                "name": emp_id,
                "employee": emp_id,
                "idx": i,
                "first_name": first_name,
                "last_name": last_name,
                "employee_name": employee_name,
                "gender": gender,
                "date_of_birth": dob,
                "date_of_joining": doj,
                "status": status,
                "company": COMPANY,
                "department": department,
                "designation": designation,
                "relieving_date": relieving_date,
            }
            self.employees.append(emp_data)

            creation_ts = dt_str(doj)
            rows.append((
                emp_id, creation_ts, creation_ts, OWNER, OWNER, 0, i,
                emp_id, "HR-EMP-", first_name, last_name, employee_name,
                gender, str(dob), str(doj), status, COMPANY,
                department, designation,
                str(relieving_date) if relieving_date else None,
                0, 0,
            ))

        batch_insert(
            self.cursor,
            "tabEmployee",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "employee", "naming_series",
             "first_name", "last_name", "employee_name",
             "gender", "date_of_birth", "date_of_joining", "status",
             "company", "department", "designation", "relieving_date",
             "lft", "rgt"],
            rows,
        )
        self.row_counts["tabEmployee"] = len(rows)
        active = sum(1 for e in self.employees if e["status"] == "Active")
        left = sum(1 for e in self.employees if e["status"] == "Left")
        print(f"  Created {len(rows)} employees ({active} active, {left} terminated)")

    def _seed_salary_structures(self):
        """Create salary structure records."""
        print("\n[6/13] Seeding salary structures...")
        ts = now_str()
        structures = [
            ("Basic Salary Structure", 55000, 55000),
            ("Senior Salary Structure", 95000, 95000),
            ("Management Salary Structure", 120000, 120000),
        ]
        rows = []
        for name, total_earning, net_pay in structures:
            rows.append((
                name, ts, ts, OWNER, OWNER, 0, 0,
                "Yes", COMPANY, CURRENCY, "Monthly",
                round(total_earning / 12, 2),
                round(net_pay / 12, 2),
            ))
        batch_insert(
            self.cursor,
            "tabSalary Structure",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "is_active", "company", "currency",
             "payroll_frequency", "total_earning", "net_pay"],
            rows,
        )
        self.row_counts["tabSalary Structure"] = len(rows)
        print(f"  Created {len(rows)} salary structures")

    def _seed_salary_structure_assignments(self):
        """Create salary structure assignment for each employee."""
        print("\n[7/13] Seeding salary structure assignments...")
        ts = now_str()
        rows = []
        for i, emp in enumerate(self.employees):
            ssa_name = f"SSA-{i + 1:05d}"
            designation = emp["designation"]
            structure = DESIGNATION_STRUCTURE[designation]
            sal_range = DESIGNATION_SALARY_RANGE[designation]
            annual = random.randint(sal_range[0], sal_range[1])
            base = round(annual / 12, 2)

            self.salary_assignments[emp["name"]] = {
                "name": ssa_name,
                "salary_structure": structure,
                "base": base,
                "annual": annual,
                "from_date": emp["date_of_joining"],
            }

            creation_ts = dt_str(emp["date_of_joining"])
            rows.append((
                ssa_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                emp["name"], emp["employee_name"], structure,
                str(emp["date_of_joining"]), base, COMPANY,
                CURRENCY,
            ))

        batch_insert(
            self.cursor,
            "tabSalary Structure Assignment",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "employee", "employee_name",
             "salary_structure", "from_date", "base", "company",
             "currency"],
            rows,
        )
        self.row_counts["tabSalary Structure Assignment"] = len(rows)
        print(f"  Created {len(rows)} salary structure assignments")

    def _seed_salary_slips(self):
        """Generate monthly salary slips for each employee."""
        print("\n[8/13] Seeding salary slips...")
        rows = []
        slip_count = 0

        # Pre-compute months with gaps per employee
        gap_months_per_emp = {}
        if self.embed_dq:
            for emp_idx in self.dq_salary_gap_emps:
                emp = self.employees[emp_idx]
                emp_months = self._get_employee_months(emp)
                if len(emp_months) > 6:
                    # Skip 2-3 random months (not first or last)
                    n_skip = random.randint(2, 3)
                    skippable = emp_months[1:-1]
                    gaps = set(random.sample(skippable, min(n_skip, len(skippable))))
                    gap_months_per_emp[emp_idx] = gaps
                    self.dq_counts["salary_gaps"] += len(gaps)

        for i, emp in enumerate(self.employees):
            assignment = self.salary_assignments[emp["name"]]
            base = assignment["base"]
            structure = assignment["salary_structure"]
            emp_months = self._get_employee_months(emp)

            for year, month in emp_months:
                # DQ: salary history gaps
                if i in gap_months_per_emp:
                    if (year, month) in gap_months_per_emp[i]:
                        continue

                gross_pay = base
                # DQ: contribution imbalance
                if i in self.dq_imbalance_emps and month in (3, 7, 11):
                    # Vary gross by 15-25% from base
                    factor = random.uniform(1.15, 1.25)
                    if random.random() < 0.5:
                        factor = random.uniform(0.75, 0.85)
                    gross_pay = round(base * factor, 2)
                    self.dq_counts["contribution_imbalance"] += 1

                total_deduction = round(gross_pay * 0.20, 2)
                net_pay = round(gross_pay - total_deduction, 2)

                end_d = last_day_of_month(year, month)
                start_d = first_day_of_month(year, month)
                posting_date = end_d
                payment_days = end_d.day
                working_days = end_d.day

                slip_name = f"Salary Slip/{year}{month:02d}/{emp['name']}"
                creation_ts = dt_str(posting_date)

                rows.append((
                    slip_name, creation_ts, creation_ts, OWNER, OWNER,
                    1, 0,
                    emp["name"], emp["employee_name"], COMPANY,
                    emp["department"], emp["designation"],
                    str(posting_date), str(start_d), str(end_d),
                    structure, "Monthly",
                    gross_pay, net_pay, total_deduction,
                    gross_pay, net_pay,
                    payment_days, working_days,
                    "Submitted", CURRENCY, 1.0,
                ))
                slip_count += 1

                # Flush in large batches to avoid memory issues
                if len(rows) >= 5000:
                    batch_insert(
                        self.cursor,
                        "tabSalary Slip",
                        self._salary_slip_columns(),
                        rows,
                    )
                    rows = []
                    self.conn.commit()

        # Insert remaining
        if rows:
            batch_insert(
                self.cursor, "tabSalary Slip",
                self._salary_slip_columns(), rows,
            )
            self.conn.commit()

        self.row_counts["tabSalary Slip"] = slip_count
        print(f"  Created {slip_count} salary slips")

    def _salary_slip_columns(self) -> list[str]:
        return [
            "name", "creation", "modified", "modified_by", "owner",
            "docstatus", "idx",
            "employee", "employee_name", "company",
            "department", "designation",
            "posting_date", "start_date", "end_date",
            "salary_structure", "payroll_frequency",
            "gross_pay", "net_pay", "total_deduction",
            "base_gross_pay", "base_net_pay",
            "payment_days", "total_working_days",
            "status", "currency", "exchange_rate",
        ]

    def _get_employee_months(self, emp: dict) -> list[tuple[int, int]]:
        """Get list of (year, month) tuples for an employee's active period."""
        start = max(emp["date_of_joining"], self.data_start)
        end = self.data_end
        if emp["status"] == "Left" and emp["relieving_date"]:
            end = min(emp["relieving_date"], self.data_end)
        return generate_months(start, end)

    def _seed_payroll_entries(self):
        """Create monthly payroll entry records."""
        print("\n[9/13] Seeding payroll entries...")
        rows = []
        all_months = generate_months(self.data_start, self.data_end)

        for year, month in all_months:
            # DQ: missing payroll runs
            if (year, month) in self.dq_missing_payroll_months:
                self.dq_counts["missing_payroll"] += 1
                continue

            pe_name = f"PE-{year}-{month:02d}"
            start_d = first_day_of_month(year, month)
            end_d = last_day_of_month(year, month)
            posting_date = end_d

            # Count active employees for this month
            active_count = 0
            for emp in self.employees:
                emp_start = max(emp["date_of_joining"], self.data_start)
                emp_end = self.data_end
                if emp["status"] == "Left" and emp["relieving_date"]:
                    emp_end = emp["relieving_date"]
                if emp_start <= end_d and emp_end >= start_d:
                    active_count += 1

            creation_ts = dt_str(posting_date)
            rows.append((
                pe_name, creation_ts, creation_ts, OWNER, OWNER,
                1, 0,
                str(posting_date), str(start_d), str(end_d),
                COMPANY, CURRENCY, "Monthly",
                active_count, "Submitted",
                1, 1,
            ))

        batch_insert(
            self.cursor,
            "tabPayroll Entry",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx",
             "posting_date", "start_date", "end_date",
             "company", "currency", "payroll_frequency",
             "number_of_employees", "status",
             "salary_slips_created", "salary_slips_submitted"],
            rows,
        )
        self.row_counts["tabPayroll Entry"] = len(rows)
        print(f"  Created {len(rows)} payroll entries")

    def _seed_leave_allocations(self):
        """Create annual leave allocations for each employee."""
        print("\n[10/13] Seeding leave allocations...")
        rows = []
        alloc_count = 0

        for i, emp in enumerate(self.employees):
            for year in range(self.data_start.year, self.data_end.year + 1):
                # Skip years before employee joined
                if year < emp["date_of_joining"].year:
                    continue
                # Skip years after termination
                if (emp["status"] == "Left" and emp["relieving_date"]
                        and year > emp["relieving_date"].year):
                    continue

                from_date = date(year, 1, 1)
                to_date = date(year, 12, 31)

                for leave_type, days in LEAVE_TYPES:
                    alloc_days = days

                    # DQ: negative leave balances
                    if (i in self.dq_negative_leave_emps
                            and year == 2024
                            and leave_type == "Casual Leave"):
                        alloc_days = random.randint(-5, -1)
                        self.dq_counts["negative_leave"] += 1

                    la_name = (
                        f"LA-{emp['name']}-{year}-"
                        f"{leave_type.replace(' ', '-')}"
                    )
                    creation_ts = dt_str(from_date)

                    rows.append((
                        la_name, creation_ts, creation_ts, OWNER, OWNER,
                        1, 0,
                        "HR-LAL-",
                        emp["name"], emp["employee_name"],
                        leave_type, COMPANY,
                        str(from_date), str(to_date),
                        alloc_days, alloc_days,
                    ))
                    alloc_count += 1

        batch_insert(
            self.cursor,
            "tabLeave Allocation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx",
             "naming_series",
             "employee", "employee_name",
             "leave_type", "company",
             "from_date", "to_date",
             "new_leaves_allocated", "total_leaves_allocated"],
            rows,
        )
        self.row_counts["tabLeave Allocation"] = alloc_count
        print(f"  Created {alloc_count} leave allocations")

    def _seed_leave_applications(self):
        """Create random leave applications for employees."""
        print("\n[11/13] Seeding leave applications...")
        rows = []
        app_count = 0

        for emp in self.employees:
            for year in range(self.data_start.year, self.data_end.year + 1):
                # Skip years before employee joined
                if year < emp["date_of_joining"].year:
                    continue
                # Skip years after termination
                if (emp["status"] == "Left" and emp["relieving_date"]
                        and year > emp["relieving_date"].year):
                    continue

                # 3-5 leave applications per year
                num_apps = random.randint(3, 5)
                year_start = max(date(year, 1, 1), emp["date_of_joining"])
                year_end = date(year, 12, 31)
                if (emp["status"] == "Left" and emp["relieving_date"]
                        and emp["relieving_date"].year == year):
                    year_end = emp["relieving_date"]

                for _ in range(num_apps):
                    leave_type = random.choice(
                        ["Casual Leave", "Sick Leave", "Privilege Leave"]
                    )
                    duration = random.randint(1, 5)
                    from_d = random_date(year_start, year_end)
                    to_d = from_d + timedelta(days=duration - 1)
                    if to_d > year_end:
                        to_d = year_end
                    total_days = (to_d - from_d).days + 1

                    app_name = f"HR-LAP-{app_count + 1:06d}"
                    creation_ts = dt_str(from_d)

                    rows.append((
                        app_name, creation_ts, creation_ts, OWNER, OWNER,
                        1, 0,
                        "HR-LAP-",
                        emp["name"], emp["employee_name"],
                        leave_type, COMPANY,
                        str(from_d), str(to_d),
                        total_days, "Approved",
                        emp["department"],
                    ))
                    app_count += 1

        batch_insert(
            self.cursor,
            "tabLeave Application",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx",
             "naming_series",
             "employee", "employee_name",
             "leave_type", "company",
             "from_date", "to_date",
             "total_leave_days", "status",
             "department"],
            rows,
        )
        self.row_counts["tabLeave Application"] = app_count
        print(f"  Created {app_count} leave applications")

    def _seed_attendance(self):
        """Generate daily attendance records for the last 6 months."""
        print("\n[12/13] Seeding attendance (last 6 months)...")
        att_start = date(2025, 7, 1)
        att_end = date(2025, 12, 31)
        rows = []
        att_count = 0

        # Pre-build list of working days
        working_days = []
        d = att_start
        while d <= att_end:
            if d.weekday() < 5:  # Mon-Fri
                working_days.append(d)
            d += timedelta(days=1)

        for emp in self.employees:
            # Skip employees not active during attendance period
            if emp["date_of_joining"] > att_end:
                continue
            if (emp["status"] == "Left" and emp["relieving_date"]
                    and emp["relieving_date"] < att_start):
                continue

            emp_start = max(emp["date_of_joining"], att_start)
            emp_end = att_end
            if (emp["status"] == "Left" and emp["relieving_date"]
                    and emp["relieving_date"] < att_end):
                emp_end = emp["relieving_date"]

            for wd in working_days:
                if wd < emp_start or wd > emp_end:
                    continue

                # 90% present, 5% absent, 5% on leave
                roll = random.random()
                if roll < 0.90:
                    status = "Present"
                elif roll < 0.95:
                    status = "Absent"
                else:
                    status = "On Leave"

                att_name = f"HR-ATT-{att_count + 1:08d}"
                creation_ts = dt_str(wd)

                rows.append((
                    att_name, creation_ts, creation_ts, OWNER, OWNER,
                    1, 0,
                    "HR-ATT-",
                    emp["name"], emp["employee_name"],
                    str(wd), status, COMPANY,
                    emp["department"],
                ))
                att_count += 1

                # Flush in large batches
                if len(rows) >= 10000:
                    batch_insert(
                        self.cursor,
                        "tabAttendance",
                        self._attendance_columns(),
                        rows,
                    )
                    rows = []
                    self.conn.commit()
                    print(f"    ... {att_count} attendance records so far")

        # Insert remaining
        if rows:
            batch_insert(
                self.cursor, "tabAttendance",
                self._attendance_columns(), rows,
            )
            self.conn.commit()

        self.row_counts["tabAttendance"] = att_count
        print(f"  Created {att_count} attendance records")

    def _attendance_columns(self) -> list[str]:
        return [
            "name", "creation", "modified", "modified_by", "owner",
            "docstatus", "idx",
            "naming_series",
            "employee", "employee_name",
            "attendance_date", "status", "company",
            "department",
        ]

    def _seed_employee_separations(self):
        """Create separation records for terminated employees."""
        print("\n[13/13] Seeding employee separations...")
        rows = []
        sep_count = 0

        for i, emp in enumerate(self.employees):
            if emp["status"] != "Left":
                continue

            # DQ: missing separation records
            if i in self.dq_missing_separation_emps:
                self.dq_counts["missing_separation"] += 1
                continue

            if not emp["relieving_date"]:
                continue

            sep_name = f"HR-SEP-{sep_count + 1:05d}"
            relieving = emp["relieving_date"]
            resignation_date = relieving - timedelta(
                days=random.randint(14, 60)
            )
            boarding_begins = relieving - timedelta(
                days=random.randint(7, 30)
            )
            creation_ts = dt_str(resignation_date)

            rows.append((
                sep_name, creation_ts, creation_ts, OWNER, OWNER,
                1, 0,
                emp["name"], emp["employee_name"], COMPANY,
                emp["department"], emp["designation"],
                "Completed",
                str(resignation_date), str(boarding_begins),
            ))
            sep_count += 1

        batch_insert(
            self.cursor,
            "tabEmployee Separation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx",
             "employee", "employee_name", "company",
             "department", "designation",
             "boarding_status",
             "resignation_letter_date", "boarding_begins_on"],
            rows,
        )
        self.row_counts["tabEmployee Separation"] = sep_count
        print(f"  Created {sep_count} employee separations")

    def _print_summary(self):
        """Print final summary of seeded data."""
        print("\n" + "=" * 60)
        print("SEED COMPLETE")
        print("=" * 60)
        print("\nRow Counts:")
        total = 0
        for table, count in sorted(self.row_counts.items()):
            print(f"  {table:40s} {count:>8,}")
            total += count
        print(f"  {'TOTAL':40s} {total:>8,}")

        if self.embed_dq:
            print("\nEmbedded DQ Issues:")
            labels = {
                "salary_gaps": "Salary history gaps (missing slip months)",
                "negative_leave": "Negative leave balance allocations",
                "missing_separation": "Missing termination records",
                "missing_payroll": "Missing payroll entry months",
                "invalid_hire_dates": "Invalid hire dates (year 2027)",
                "contribution_imbalance": "Contribution imbalance slip months",
            }
            for key, label in labels.items():
                print(f"  {label:50s} {self.dq_counts[key]:>5}")

            print("\nDQ Employee Indices (0-based):")
            print(f"  Salary gaps:          "
                  f"{sorted(self.dq_salary_gap_emps)}")
            print(f"  Negative leave:       "
                  f"{sorted(self.dq_negative_leave_emps)}")
            print(f"  Invalid hire dates:   "
                  f"{sorted(self.dq_invalid_hire_emps)}")
            print(f"  Imbalance:            "
                  f"{sorted(self.dq_imbalance_emps)}")
            print(f"  Missing separation:   "
                  f"{sorted(self.dq_missing_separation_emps)}")
            print(f"  Missing payroll:      "
                  f"{sorted(self.dq_missing_payroll_months)}")
        print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Seed ERPNext with HR/payroll test data"
    )
    parser.add_argument(
        "--host", default="127.0.0.1", help="Database host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port", type=int, default=3307, help="Database port (default: 3307)"
    )
    parser.add_argument(
        "--user", default="root", help="Database user (default: root)"
    )
    parser.add_argument(
        "--password", default="admin", help="Database password (default: admin)"
    )
    parser.add_argument(
        "--database",
        default="_0919b4e09c48d335",
        help="Database name (default: _0919b4e09c48d335)",
    )
    parser.add_argument(
        "--employees",
        type=int,
        default=200,
        help="Number of employees (default: 200)",
    )
    parser.add_argument(
        "--years",
        type=int,
        default=3,
        help="Years of data (default: 3)",
    )
    parser.add_argument(
        "--dq-issues",
        action="store_true",
        default=True,
        help="Embed data quality issues (default: True)",
    )
    parser.add_argument(
        "--no-dq-issues",
        action="store_true",
        help="Do not embed data quality issues",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )

    args = parser.parse_args()

    if args.employees < 50:
        parser.error("--employees must be at least 50 for DQ issue planning")
    if args.years < 1:
        parser.error("--years must be at least 1")

    embed_dq = not args.no_dq_issues

    # Set random seed
    random.seed(args.seed)

    print(f"Connecting to MariaDB at {args.host}:{args.port}/{args.database}...")
    try:
        conn = pymysql.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.database,
            charset="utf8mb4",
            autocommit=False,
        )
    except pymysql.err.OperationalError as e:
        print(f"ERROR: Could not connect to database: {e}")
        print(
            "\nMake sure ERPNext is running:"
            "\n  docker compose -f targets/erpnext/docker-compose.yml up -d"
        )
        sys.exit(1)

    print("Connected successfully.")

    try:
        seeder = ERPNextSeeder(
            conn,
            num_employees=args.employees,
            num_years=args.years,
            embed_dq=embed_dq,
        )
        seeder.run()
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: Seeding failed: {e}")
        raise
    finally:
        conn.close()
        print("Database connection closed.")


if __name__ == "__main__":
    main()
