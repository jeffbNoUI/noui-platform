#!/usr/bin/env python3
"""
MSSQL HR Seed Data Generator for noui-connector-lab.

Creates ERPNext-compatible HR tables in SQL Server and populates them with
the same test data structure as the ERPNext/MariaDB and PostgreSQL targets.
This validates the connector's MSSQL adapters against a live database.

Tables use ERPNext naming conventions (tab-prefixed, space-separated) to
match the monitor adapter's query expectations.

Usage:
    pip install pymssql
    python seed.py
    python seed.py --host 127.0.0.1 --port 1434 --user sa --password "NoUI_Lab2026!" --database hrlab
"""

import argparse
import calendar
import random
import sys
from datetime import date, datetime, timedelta

import pymssql

# ---------------------------------------------------------------------------
# Constants (same as ERPNext/PostgreSQL seeders)
# ---------------------------------------------------------------------------
COMPANY = "NoUI Labs"
COMPANY_ABBR = "NL"
CURRENCY = "USD"
OWNER = "Administrator"

DEPARTMENTS = ["HR", "Engineering", "Finance", "Operations", "Sales", "Legal"]

DESIGNATIONS = [
    "Software Engineer", "Senior Engineer", "Engineering Manager",
    "HR Specialist", "HR Manager", "Accountant", "Finance Manager",
    "Sales Representative", "Operations Analyst", "Legal Counsel",
]

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
def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def dt_str(d):
    return datetime(d.year, d.month, d.day, 10, 0, 0).strftime(
        "%Y-%m-%d %H:%M:%S"
    )


def last_day_of_month(year, month):
    return date(year, month, calendar.monthrange(year, month)[1])


def first_day_of_month(year, month):
    return date(year, month, 1)


def random_date(start, end):
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def generate_months(start_date, end_date):
    months = []
    y, m = start_date.year, start_date.month
    while (y, m) <= (end_date.year, end_date.month):
        months.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def batch_insert(cursor, table, columns, rows, batch_size=500):
    """Insert rows in batches using MSSQL syntax."""
    if not rows:
        return
    col_str = ", ".join(f"[{c}]" for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT INTO [{table}] ({col_str}) VALUES ({placeholders})"
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        cursor.executemany(sql, batch)


# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------
SCHEMA_DDL_DROPS = """
IF OBJECT_ID('[tabAttendance]', 'U') IS NOT NULL DROP TABLE [tabAttendance];
IF OBJECT_ID('[tabLeave Application]', 'U') IS NOT NULL DROP TABLE [tabLeave Application];
IF OBJECT_ID('[tabLeave Allocation]', 'U') IS NOT NULL DROP TABLE [tabLeave Allocation];
IF OBJECT_ID('[tabSalary Slip]', 'U') IS NOT NULL DROP TABLE [tabSalary Slip];
IF OBJECT_ID('[tabPayroll Entry]', 'U') IS NOT NULL DROP TABLE [tabPayroll Entry];
IF OBJECT_ID('[tabSalary Structure Assignment]', 'U') IS NOT NULL DROP TABLE [tabSalary Structure Assignment];
IF OBJECT_ID('[tabSalary Structure]', 'U') IS NOT NULL DROP TABLE [tabSalary Structure];
IF OBJECT_ID('[tabEmployee Separation]', 'U') IS NOT NULL DROP TABLE [tabEmployee Separation];
IF OBJECT_ID('[tabEmployee]', 'U') IS NOT NULL DROP TABLE [tabEmployee];
IF OBJECT_ID('[tabDesignation]', 'U') IS NOT NULL DROP TABLE [tabDesignation];
IF OBJECT_ID('[tabDepartment]', 'U') IS NOT NULL DROP TABLE [tabDepartment];
IF OBJECT_ID('[tabCompany]', 'U') IS NOT NULL DROP TABLE [tabCompany];
"""

SCHEMA_DDL_TABLES = [
    """
    CREATE TABLE [tabCompany] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        company_name VARCHAR(140),
        abbr VARCHAR(10),
        country VARCHAR(100),
        default_currency VARCHAR(10),
        is_group SMALLINT DEFAULT 0,
        lft INT DEFAULT 0,
        rgt INT DEFAULT 0
    )
    """,
    """
    CREATE TABLE [tabDepartment] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        department_name VARCHAR(140),
        company VARCHAR(140) REFERENCES [tabCompany](name),
        is_group SMALLINT DEFAULT 0,
        lft INT DEFAULT 0,
        rgt INT DEFAULT 0
    )
    """,
    """
    CREATE TABLE [tabDesignation] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        designation_name VARCHAR(140)
    )
    """,
    """
    CREATE TABLE [tabEmployee] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        employee VARCHAR(140),
        naming_series VARCHAR(20),
        first_name VARCHAR(140),
        last_name VARCHAR(140),
        employee_name VARCHAR(280),
        gender VARCHAR(20),
        date_of_birth DATE,
        date_of_joining DATE,
        status VARCHAR(20),
        company VARCHAR(140) REFERENCES [tabCompany](name),
        department VARCHAR(140),
        designation VARCHAR(140),
        relieving_date DATE,
        lft INT DEFAULT 0,
        rgt INT DEFAULT 0
    )
    """,
    """
    CREATE TABLE [tabSalary Structure] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        is_active VARCHAR(10),
        company VARCHAR(140) REFERENCES [tabCompany](name),
        currency VARCHAR(10),
        payroll_frequency VARCHAR(20),
        total_earning DECIMAL(18,2),
        net_pay DECIMAL(18,2)
    )
    """,
    """
    CREATE TABLE [tabSalary Structure Assignment] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        salary_structure VARCHAR(140) REFERENCES [tabSalary Structure](name),
        from_date DATE,
        base DECIMAL(18,2),
        company VARCHAR(140),
        currency VARCHAR(10)
    )
    """,
    """
    CREATE TABLE [tabSalary Slip] (
        name VARCHAR(280) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        company VARCHAR(140),
        department VARCHAR(140),
        designation VARCHAR(140),
        posting_date DATE,
        start_date DATE,
        end_date DATE,
        salary_structure VARCHAR(140),
        payroll_frequency VARCHAR(20),
        gross_pay DECIMAL(18,2),
        net_pay DECIMAL(18,2),
        total_deduction DECIMAL(18,2),
        base_gross_pay DECIMAL(18,2),
        base_net_pay DECIMAL(18,2),
        payment_days DECIMAL(10,2),
        total_working_days DECIMAL(10,2),
        status VARCHAR(20),
        currency VARCHAR(10),
        exchange_rate DECIMAL(10,4)
    )
    """,
    """
    CREATE TABLE [tabPayroll Entry] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        posting_date DATE,
        start_date DATE,
        end_date DATE,
        company VARCHAR(140),
        currency VARCHAR(10),
        payroll_frequency VARCHAR(20),
        number_of_employees INT,
        status VARCHAR(20),
        salary_slips_created INT,
        salary_slips_submitted INT
    )
    """,
    """
    CREATE TABLE [tabLeave Allocation] (
        name VARCHAR(280) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        naming_series VARCHAR(20),
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        leave_type VARCHAR(100),
        company VARCHAR(140),
        from_date DATE,
        to_date DATE,
        new_leaves_allocated DECIMAL(10,2),
        total_leaves_allocated DECIMAL(10,2)
    )
    """,
    """
    CREATE TABLE [tabLeave Application] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        naming_series VARCHAR(20),
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        leave_type VARCHAR(100),
        company VARCHAR(140),
        from_date DATE,
        to_date DATE,
        total_leave_days DECIMAL(10,2),
        status VARCHAR(20),
        department VARCHAR(140)
    )
    """,
    """
    CREATE TABLE [tabAttendance] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        naming_series VARCHAR(20),
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        attendance_date DATE,
        status VARCHAR(20),
        company VARCHAR(140),
        department VARCHAR(140)
    )
    """,
    """
    CREATE TABLE [tabEmployee Separation] (
        name VARCHAR(140) PRIMARY KEY,
        creation DATETIME,
        modified DATETIME,
        modified_by VARCHAR(140),
        owner VARCHAR(140),
        docstatus INT DEFAULT 0,
        idx INT DEFAULT 0,
        employee VARCHAR(140) REFERENCES [tabEmployee](name),
        employee_name VARCHAR(280),
        company VARCHAR(140),
        department VARCHAR(140),
        designation VARCHAR(140),
        boarding_status VARCHAR(20),
        resignation_letter_date DATE,
        boarding_begins_on DATE
    )
    """,
]

SCHEMA_DDL_INDEXES = [
    "CREATE INDEX idx_salary_slip_employee ON [tabSalary Slip](employee)",
    "CREATE INDEX idx_salary_slip_start_date ON [tabSalary Slip](start_date)",
    "CREATE INDEX idx_salary_slip_docstatus ON [tabSalary Slip](docstatus)",
    "CREATE INDEX idx_leave_alloc_employee ON [tabLeave Allocation](employee)",
    "CREATE INDEX idx_payroll_entry_start ON [tabPayroll Entry](start_date)",
    "CREATE INDEX idx_attendance_employee ON [tabAttendance](employee)",
    "CREATE INDEX idx_employee_status ON [tabEmployee](status)",
    "CREATE INDEX idx_ssa_employee ON [tabSalary Structure Assignment](employee)",
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------
class MSSQLHRSeeder:
    def __init__(self, conn, num_employees=200, num_years=3, embed_dq=True):
        self.conn = conn
        self.cursor = conn.cursor()
        self.num_employees = num_employees
        self.num_years = num_years
        self.embed_dq = embed_dq

        self.data_start = date(2023, 1, 1)
        self.data_end = date(2023 + num_years - 1, 12, 31)

        self.employees = []
        self.salary_assignments = {}
        self.row_counts = {}
        self.dq_counts = {
            "salary_gaps": 0, "negative_leave": 0,
            "missing_separation": 0, "missing_payroll": 0,
            "invalid_hire_dates": 0, "contribution_imbalance": 0,
        }
        self.dq_salary_gap_emps = set()
        self.dq_negative_leave_emps = set()
        self.dq_invalid_hire_emps = set()
        self.dq_imbalance_emps = set()
        self.dq_missing_separation_emps = set()
        self.dq_missing_payroll_months = set()

    def run(self):
        print("=" * 60)
        print("MSSQL HR Seed Data Generator")
        print(f"  Employees: {self.num_employees}")
        print(f"  Date range: {self.data_start} to {self.data_end}")
        print(f"  DQ issues: {'Yes' if self.embed_dq else 'No'}")
        print("=" * 60)

        self._plan_dq_issues()
        self._create_schema()
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
        # Update statistics for accurate row counts
        print("\n[14/14] Updating statistics...")
        self.cursor.execute("EXEC sp_updatestats")
        self.conn.commit()
        self._print_summary()

    def _plan_dq_issues(self):
        if not self.embed_dq:
            return
        all_indices = list(range(self.num_employees))
        terminated_indices = list(range(self.num_employees - 30, self.num_employees))

        self.dq_salary_gap_emps = set(random.sample(all_indices[:170], 12))
        self.dq_negative_leave_emps = set(random.sample(all_indices[:170], 15))
        self.dq_missing_separation_emps = set(random.sample(terminated_indices, 5))

        all_months = generate_months(self.data_start, self.data_end)
        candidate_months = all_months[1:-1]
        self.dq_missing_payroll_months = set(random.sample(candidate_months, 3))

        self.dq_invalid_hire_emps = set(random.sample(all_indices[:170], 8))

        remaining = [i for i in all_indices[:170] if i not in self.dq_salary_gap_emps]
        self.dq_imbalance_emps = set(random.sample(remaining, 10))

    def _create_schema(self):
        print("\n[1/14] Creating schema (drop + recreate)...")
        # Drop tables (each statement separately for MSSQL)
        for stmt in SCHEMA_DDL_DROPS.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                self.cursor.execute(stmt)
        self.conn.commit()

        # Create tables
        for ddl in SCHEMA_DDL_TABLES:
            self.cursor.execute(ddl)
        self.conn.commit()

        # Create indexes
        for idx_ddl in SCHEMA_DDL_INDEXES:
            self.cursor.execute(idx_ddl)
        self.conn.commit()
        print("  Schema created: 12 tables")

    def _seed_company(self):
        print("\n[2/14] Seeding company...")
        ts = now_str()
        self.cursor.execute(
            """INSERT INTO [tabCompany]
               (name, creation, modified, modified_by, owner,
                docstatus, idx, company_name, abbr, country,
                default_currency, is_group, lft, rgt)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (COMPANY, ts, ts, OWNER, OWNER, 0, 0, COMPANY, COMPANY_ABBR,
             "United States", CURRENCY, 0, 0, 0),
        )
        self.row_counts["tabCompany"] = 1
        print(f"  Created company: {COMPANY}")

    def _seed_departments(self):
        print("\n[3/14] Seeding departments...")
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
        batch_insert(self.cursor, "tabDepartment",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "department_name", "company",
             "is_group", "lft", "rgt"], rows)
        self.row_counts["tabDepartment"] = len(rows)
        print(f"  Created {len(rows)} departments")

    def _seed_designations(self):
        print("\n[4/14] Seeding designations...")
        ts = now_str()
        rows = []
        for i, desig in enumerate(DESIGNATIONS):
            rows.append((desig, ts, ts, OWNER, OWNER, 0, i, desig))
        batch_insert(self.cursor, "tabDesignation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "designation_name"], rows)
        self.row_counts["tabDesignation"] = len(rows)
        print(f"  Created {len(rows)} designations")

    def _seed_employees(self):
        print("\n[5/14] Seeding employees...")
        rows = []
        num_terminated = 30
        num_active = self.num_employees - num_terminated

        for i in range(self.num_employees):
            emp_id = f"HR-EMP-{i + 1:05d}"
            gender = random.choice(["Male", "Female"])
            first_name = random.choice(
                FIRST_NAMES_MALE if gender == "Male" else FIRST_NAMES_FEMALE
            )
            last_name = random.choice(LAST_NAMES)
            employee_name = f"{first_name} {last_name}"

            dob = random_date(date(1960, 1, 1), date(1990, 12, 31))
            doj = random_date(date(2020, 1, 1), date(2023, 6, 30))

            if i in self.dq_invalid_hire_emps:
                doj = random_date(date(2027, 1, 1), date(2027, 12, 31))
                self.dq_counts["invalid_hire_dates"] += 1

            is_terminated = i >= num_active
            status = "Left" if is_terminated else "Active"
            relieving_date = None
            if is_terminated:
                relieving_date = random_date(date(2024, 1, 1), date(2025, 6, 30))

            department = random.choice([f"{d} - {COMPANY_ABBR}" for d in DEPARTMENTS])
            designation = random.choice(DESIGNATIONS)

            self.employees.append({
                "name": emp_id, "employee": emp_id, "idx": i,
                "first_name": first_name, "last_name": last_name,
                "employee_name": employee_name, "gender": gender,
                "date_of_birth": dob, "date_of_joining": doj,
                "status": status, "company": COMPANY,
                "department": department, "designation": designation,
                "relieving_date": relieving_date,
            })

            creation_ts = dt_str(doj)
            rows.append((
                emp_id, creation_ts, creation_ts, OWNER, OWNER, 0, i,
                emp_id, "HR-EMP-", first_name, last_name, employee_name,
                gender, str(dob), str(doj), status, COMPANY,
                department, designation,
                str(relieving_date) if relieving_date else None, 0, 0,
            ))

        batch_insert(self.cursor, "tabEmployee",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "employee", "naming_series",
             "first_name", "last_name", "employee_name",
             "gender", "date_of_birth", "date_of_joining", "status",
             "company", "department", "designation", "relieving_date",
             "lft", "rgt"], rows)
        self.row_counts["tabEmployee"] = len(rows)
        active = sum(1 for e in self.employees if e["status"] == "Active")
        left = sum(1 for e in self.employees if e["status"] == "Left")
        print(f"  Created {len(rows)} employees ({active} active, {left} terminated)")

    def _seed_salary_structures(self):
        print("\n[6/14] Seeding salary structures...")
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
                round(total_earning / 12, 2), round(net_pay / 12, 2),
            ))
        batch_insert(self.cursor, "tabSalary Structure",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "is_active", "company", "currency",
             "payroll_frequency", "total_earning", "net_pay"], rows)
        self.row_counts["tabSalary Structure"] = len(rows)
        print(f"  Created {len(rows)} salary structures")

    def _seed_salary_structure_assignments(self):
        print("\n[7/14] Seeding salary structure assignments...")
        rows = []
        for i, emp in enumerate(self.employees):
            ssa_name = f"SSA-{i + 1:05d}"
            designation = emp["designation"]
            structure = DESIGNATION_STRUCTURE[designation]
            sal_range = DESIGNATION_SALARY_RANGE[designation]
            annual = random.randint(sal_range[0], sal_range[1])
            base = round(annual / 12, 2)

            self.salary_assignments[emp["name"]] = {
                "name": ssa_name, "salary_structure": structure,
                "base": base, "annual": annual,
                "from_date": emp["date_of_joining"],
            }

            creation_ts = dt_str(emp["date_of_joining"])
            rows.append((
                ssa_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                emp["name"], emp["employee_name"], structure,
                str(emp["date_of_joining"]), base, COMPANY, CURRENCY,
            ))

        batch_insert(self.cursor, "tabSalary Structure Assignment",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "employee", "employee_name",
             "salary_structure", "from_date", "base", "company",
             "currency"], rows)
        self.row_counts["tabSalary Structure Assignment"] = len(rows)
        print(f"  Created {len(rows)} salary structure assignments")

    def _seed_salary_slips(self):
        print("\n[8/14] Seeding salary slips...")
        rows = []
        slip_count = 0

        gap_months_per_emp = {}
        if self.embed_dq:
            for emp_idx in self.dq_salary_gap_emps:
                emp = self.employees[emp_idx]
                emp_months = self._get_employee_months(emp)
                if len(emp_months) > 6:
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
                if i in gap_months_per_emp:
                    if (year, month) in gap_months_per_emp[i]:
                        continue

                gross_pay = base
                if i in self.dq_imbalance_emps and month in (3, 7, 11):
                    factor = random.uniform(1.15, 1.25)
                    if random.random() < 0.5:
                        factor = random.uniform(0.75, 0.85)
                    gross_pay = round(base * factor, 2)
                    self.dq_counts["contribution_imbalance"] += 1

                total_deduction = round(gross_pay * 0.20, 2)
                net_pay = round(gross_pay - total_deduction, 2)
                end_d = last_day_of_month(year, month)
                start_d = first_day_of_month(year, month)

                slip_name = f"Salary Slip/{year}{month:02d}/{emp['name']}"
                creation_ts = dt_str(end_d)

                rows.append((
                    slip_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                    emp["name"], emp["employee_name"], COMPANY,
                    emp["department"], emp["designation"],
                    str(end_d), str(start_d), str(end_d),
                    structure, "Monthly",
                    gross_pay, net_pay, total_deduction,
                    gross_pay, net_pay,
                    end_d.day, end_d.day, "Submitted", CURRENCY, 1.0,
                ))
                slip_count += 1

                if len(rows) >= 5000:
                    batch_insert(self.cursor, "tabSalary Slip",
                        self._salary_slip_columns(), rows)
                    rows = []
                    self.conn.commit()

        if rows:
            batch_insert(self.cursor, "tabSalary Slip",
                self._salary_slip_columns(), rows)
            self.conn.commit()

        self.row_counts["tabSalary Slip"] = slip_count
        print(f"  Created {slip_count} salary slips")

    def _salary_slip_columns(self):
        return [
            "name", "creation", "modified", "modified_by", "owner",
            "docstatus", "idx", "employee", "employee_name", "company",
            "department", "designation", "posting_date", "start_date",
            "end_date", "salary_structure", "payroll_frequency",
            "gross_pay", "net_pay", "total_deduction",
            "base_gross_pay", "base_net_pay",
            "payment_days", "total_working_days",
            "status", "currency", "exchange_rate",
        ]

    def _get_employee_months(self, emp):
        start = max(emp["date_of_joining"], self.data_start)
        end = self.data_end
        if emp["status"] == "Left" and emp["relieving_date"]:
            end = min(emp["relieving_date"], self.data_end)
        return generate_months(start, end)

    def _seed_payroll_entries(self):
        print("\n[9/14] Seeding payroll entries...")
        rows = []
        all_months = generate_months(self.data_start, self.data_end)

        for year, month in all_months:
            if (year, month) in self.dq_missing_payroll_months:
                self.dq_counts["missing_payroll"] += 1
                continue

            pe_name = f"PE-{year}-{month:02d}"
            start_d = first_day_of_month(year, month)
            end_d = last_day_of_month(year, month)

            active_count = 0
            for emp in self.employees:
                emp_start = max(emp["date_of_joining"], self.data_start)
                emp_end = self.data_end
                if emp["status"] == "Left" and emp["relieving_date"]:
                    emp_end = emp["relieving_date"]
                if emp_start <= end_d and emp_end >= start_d:
                    active_count += 1

            creation_ts = dt_str(end_d)
            rows.append((
                pe_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                str(end_d), str(start_d), str(end_d),
                COMPANY, CURRENCY, "Monthly", active_count, "Submitted", 1, 1,
            ))

        batch_insert(self.cursor, "tabPayroll Entry",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "posting_date", "start_date", "end_date",
             "company", "currency", "payroll_frequency",
             "number_of_employees", "status",
             "salary_slips_created", "salary_slips_submitted"], rows)
        self.row_counts["tabPayroll Entry"] = len(rows)
        print(f"  Created {len(rows)} payroll entries")

    def _seed_leave_allocations(self):
        print("\n[10/14] Seeding leave allocations...")
        rows = []
        alloc_count = 0

        for i, emp in enumerate(self.employees):
            for year in range(self.data_start.year, self.data_end.year + 1):
                if year < emp["date_of_joining"].year:
                    continue
                if (emp["status"] == "Left" and emp["relieving_date"]
                        and year > emp["relieving_date"].year):
                    continue

                from_date = date(year, 1, 1)
                to_date = date(year, 12, 31)

                for leave_type, days in LEAVE_TYPES:
                    alloc_days = days
                    if (i in self.dq_negative_leave_emps
                            and year == 2024
                            and leave_type == "Casual Leave"):
                        alloc_days = random.randint(-5, -1)
                        self.dq_counts["negative_leave"] += 1

                    la_name = f"LA-{emp['name']}-{year}-{leave_type.replace(' ', '-')}"
                    creation_ts = dt_str(from_date)
                    rows.append((
                        la_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                        "HR-LAL-", emp["name"], emp["employee_name"],
                        leave_type, COMPANY, str(from_date), str(to_date),
                        alloc_days, alloc_days,
                    ))
                    alloc_count += 1

        batch_insert(self.cursor, "tabLeave Allocation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "naming_series",
             "employee", "employee_name", "leave_type", "company",
             "from_date", "to_date",
             "new_leaves_allocated", "total_leaves_allocated"], rows)
        self.row_counts["tabLeave Allocation"] = alloc_count
        print(f"  Created {alloc_count} leave allocations")

    def _seed_leave_applications(self):
        print("\n[11/14] Seeding leave applications...")
        rows = []
        app_count = 0

        for emp in self.employees:
            for year in range(self.data_start.year, self.data_end.year + 1):
                if year < emp["date_of_joining"].year:
                    continue
                if (emp["status"] == "Left" and emp["relieving_date"]
                        and year > emp["relieving_date"].year):
                    continue

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
                        app_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                        "HR-LAP-", emp["name"], emp["employee_name"],
                        leave_type, COMPANY, str(from_d), str(to_d),
                        total_days, "Approved", emp["department"],
                    ))
                    app_count += 1

        batch_insert(self.cursor, "tabLeave Application",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "naming_series",
             "employee", "employee_name", "leave_type", "company",
             "from_date", "to_date", "total_leave_days", "status",
             "department"], rows)
        self.row_counts["tabLeave Application"] = app_count
        print(f"  Created {app_count} leave applications")

    def _seed_attendance(self):
        print("\n[12/14] Seeding attendance (last 6 months)...")
        att_start = date(2025, 7, 1)
        att_end = date(2025, 12, 31)
        rows = []
        att_count = 0

        working_days = []
        d = att_start
        while d <= att_end:
            if d.weekday() < 5:
                working_days.append(d)
            d += timedelta(days=1)

        for emp in self.employees:
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
                    att_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                    "HR-ATT-", emp["name"], emp["employee_name"],
                    str(wd), status, COMPANY, emp["department"],
                ))
                att_count += 1

                if len(rows) >= 5000:
                    batch_insert(self.cursor, "tabAttendance",
                        self._attendance_columns(), rows)
                    rows = []
                    self.conn.commit()
                    print(f"    ... {att_count} attendance records so far")

        if rows:
            batch_insert(self.cursor, "tabAttendance",
                self._attendance_columns(), rows)
            self.conn.commit()

        self.row_counts["tabAttendance"] = att_count
        print(f"  Created {att_count} attendance records")

    def _attendance_columns(self):
        return [
            "name", "creation", "modified", "modified_by", "owner",
            "docstatus", "idx", "naming_series",
            "employee", "employee_name",
            "attendance_date", "status", "company", "department",
        ]

    def _seed_employee_separations(self):
        print("\n[13/14] Seeding employee separations...")
        rows = []
        sep_count = 0

        for i, emp in enumerate(self.employees):
            if emp["status"] != "Left":
                continue
            if i in self.dq_missing_separation_emps:
                self.dq_counts["missing_separation"] += 1
                continue
            if not emp["relieving_date"]:
                continue

            sep_name = f"HR-SEP-{sep_count + 1:05d}"
            relieving = emp["relieving_date"]
            resignation_date = relieving - timedelta(days=random.randint(14, 60))
            boarding_begins = relieving - timedelta(days=random.randint(7, 30))
            creation_ts = dt_str(resignation_date)

            rows.append((
                sep_name, creation_ts, creation_ts, OWNER, OWNER, 1, 0,
                emp["name"], emp["employee_name"], COMPANY,
                emp["department"], emp["designation"],
                "Completed", str(resignation_date), str(boarding_begins),
            ))
            sep_count += 1

        batch_insert(self.cursor, "tabEmployee Separation",
            ["name", "creation", "modified", "modified_by", "owner",
             "docstatus", "idx", "employee", "employee_name", "company",
             "department", "designation", "boarding_status",
             "resignation_letter_date", "boarding_begins_on"], rows)
        self.row_counts["tabEmployee Separation"] = sep_count
        print(f"  Created {sep_count} employee separations")

    def _print_summary(self):
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
        print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Seed MSSQL with ERPNext-compatible HR test data"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=1434)
    parser.add_argument("--user", default="sa")
    parser.add_argument("--password", default="NoUI_Lab2026!")
    parser.add_argument("--database", default="hrlab")
    parser.add_argument("--employees", type=int, default=200)
    parser.add_argument("--years", type=int, default=3)
    parser.add_argument("--dq-issues", action="store_true", default=True)
    parser.add_argument("--no-dq-issues", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.employees < 50:
        parser.error("--employees must be at least 50")

    embed_dq = not args.no_dq_issues
    random.seed(args.seed)

    print(f"Connecting to MSSQL at {args.host}:{args.port}...")

    # First connect to master to create the database if needed
    try:
        conn = pymssql.connect(
            server=args.host, port=args.port,
            user=args.user, password=args.password,
            database="master",
            autocommit=True,
        )
        cursor = conn.cursor()
        cursor.execute(f"""
            IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '{args.database}')
            CREATE DATABASE [{args.database}]
        """)
        conn.close()
    except pymssql.OperationalError as e:
        print(f"ERROR: Could not connect: {e}")
        print("\nMake sure SQL Server is running:")
        print("  docker compose -f targets/mssql-hr/docker-compose.yml up -d")
        sys.exit(1)

    # Now connect to the target database
    try:
        conn = pymssql.connect(
            server=args.host, port=args.port,
            user=args.user, password=args.password,
            database=args.database,
            autocommit=False,
        )
    except pymssql.OperationalError as e:
        print(f"ERROR: Could not connect to {args.database}: {e}")
        sys.exit(1)

    print(f"Connected to {args.database} successfully.")

    try:
        seeder = MSSQLHRSeeder(conn, args.employees, args.years, embed_dq)
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
