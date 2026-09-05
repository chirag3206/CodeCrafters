"""
PeoplePay360 — Enterprise Seed Script (Realistic Indian Tech Salaries & Pre-August Historical Payroll)
Populates the database with:
- 5 demo personas & 12 employees with realistic monthly compensation (₹44,000 - ₹90,000 / mo)
- 3 departments & 12 job positions
- Working schedule (Mon-Fri 09:00 - 18:00, 40h/week)
- Standard salary structure with 10 sequenced mathematical rules (HRA 40%, Conveyance ₹2,000, PF 12%, TDS 10%)
- 12 active contracts + historical expired contracts
- Time-off types & allocations
- 6 months of realistic time-off requests (March 2026 - September 2026)
- 6 months of realistic attendance logs (March 1 - Sep 4, 2026, Mon-Fri only, weekends OFF)
- 5 completed monthly payroll batches strictly BEFORE the month of August (March - July 2026, Paid status)
  with itemized payslips and outbox emails.
- August 2026 and September 2026 are left OPEN & UNPROCESSED so the user can test the Payroll Wizard hands-on!
- 3-day broadcast office hours notification

Run: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from datetime import date, datetime, timedelta
import random

from sqlalchemy.orm import Session

from auth import hash_password
from database import Base, SessionLocal, engine
from models import (
    Attendance, AttendanceStatus, AllocationStatus, ComputationType,
    Contract, ContractStatus, Department, EmailOutbox, EmailStatus,
    Employee, EmployeeStatus, EmploymentType, JobPosition, LeaveUnit,
    OfficeHoursNotification, Payrun, PayrunStatus, Payslip, PayslipLine,
    PayslipStatus, RuleCategory, SalaryRule, SalaryStructure, ScheduleDayLine,
    TimeOffAllocation, TimeOffRequest, TimeOffRequestStatus, TimeOffType,
    User, UserRole, VerificationStatus, WorkingSchedule,
)
from services.salary_engine import compute_payslip


def _count_business_days(start: date, end: date) -> int:
    cur = start
    cnt = 0
    while cur <= end:
        if cur.weekday() < 5:
            cnt += 1
        cur += timedelta(days=1)
    return cnt


def seed():
    print("🌱 Dropping and recreating database tables…")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    random.seed(42)

    try:
        # ─── 1. Departments ───────────────────────────────────────────────
        print("📁 Seeding departments…")
        dept_eng = Department(name="Engineering", code="ENG")
        dept_hr = Department(name="Human Resources", code="HR")
        dept_ops = Department(name="Operations", code="OPS")
        db.add_all([dept_eng, dept_hr, dept_ops])
        db.flush()

        # ─── 2. Job Positions ─────────────────────────────────────────────
        print("💼 Seeding job positions…")
        jobs = {
            "Senior Frontend Engineer": JobPosition(title="Senior Frontend Engineer", department_id=dept_eng.id),
            "Backend Engineer": JobPosition(title="Backend Engineer", department_id=dept_eng.id),
            "QA Engineer": JobPosition(title="QA Engineer", department_id=dept_eng.id),
            "DevOps Engineer": JobPosition(title="DevOps Engineer", department_id=dept_eng.id),
            "HR Manager": JobPosition(title="HR Manager", department_id=dept_hr.id),
            "HR Business Partner": JobPosition(title="HR Business Partner", department_id=dept_hr.id),
            "Payroll Specialist": JobPosition(title="Payroll Specialist", department_id=dept_hr.id),
            "Payroll Manager": JobPosition(title="Payroll Manager", department_id=dept_hr.id),
            "Operations Lead": JobPosition(title="Operations Lead", department_id=dept_ops.id),
            "Business Analyst": JobPosition(title="Business Analyst", department_id=dept_ops.id),
            "System Administrator": JobPosition(title="System Administrator", department_id=dept_ops.id),
            "Product Manager": JobPosition(title="Product Manager", department_id=dept_ops.id),
        }
        db.add_all(jobs.values())
        db.flush()

        # ─── 3. Working Schedules ─────────────────────────────────────────
        print("⏰ Seeding working schedules (Mon-Fri 09:00 - 18:00)…")
        std_schedule = WorkingSchedule(
            name="Standard 40h/week",
            total_weekly_hours=40.0,
            work_days_summary="Mon - Fri, 09:00 - 18:00",
        )
        db.add(std_schedule)
        db.flush()

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        for day in days:
            db.add(ScheduleDayLine(
                schedule_id=std_schedule.id,
                day_of_week=day,
                start_time="09:00",
                end_time="18:00",
                break_hours=1.0,
                net_hours=8.0,
            ))
        db.flush()

        # ─── 4. Salary Structures & Sequenced Rules ───────────────────────
        print("💰 Seeding salary structures & mathematical rules…")
        std_structure = SalaryStructure(
            name="Standard Regular Salary Structure",
            code="STANDARD_REGULAR",
            is_active=True,
        )
        db.add(std_structure)
        db.flush()

        # Realistic Indian corporate allowances: 40% HRA, ₹2,000 Conveyance, 12% PF, 10% TDS
        rules_data = [
            ("Basic Salary",              "BASIC",                      RuleCategory.BASIC,      10, ComputationType.FORMULA,    0,    None,    0,    "contract.wage"),
            ("House Rent Allowance",      "HRA",                        RuleCategory.ALLOWANCE,  20, ComputationType.PERCENTAGE, 0,    "BASIC", 40.0, None),
            ("Conveyance Allowance",      "CONVEYANCE",                 RuleCategory.ALLOWANCE,  30, ComputationType.FIXED,      2000, None,    0,    None),
            ("Gross Before LOP",          "GROSS_BEFORE_LOP",           RuleCategory.GROSS,      40, ComputationType.FORMULA,    0,    None,    0,    "rules['BASIC'] + rules['HRA'] + rules['CONVEYANCE']"),
            ("Loss of Pay Deduction",     "LOP_DEDUCTION",              RuleCategory.DEDUCTION,  50, ComputationType.FORMULA,    0,    None,    0,    "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
            ("Gross After LOP",           "GROSS_AFTER_LOP",            RuleCategory.GROSS,      60, ComputationType.FORMULA,    0,    None,    0,    "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
            ("Provident Fund (PF)",       "PF_DEDUCTION",               RuleCategory.DEDUCTION,  70, ComputationType.PERCENTAGE, 0,    "BASIC", 12.0, None),
            ("Income Tax / TDS",          "TAX_DEDUCTION",              RuleCategory.DEDUCTION,  80, ComputationType.PERCENTAGE, 0,    "GROSS_AFTER_LOP", 10.0, None),
            ("Total Statutory Deductions","TOTAL_STATUTORY_DEDUCTIONS", RuleCategory.DEDUCTION,  90, ComputationType.FORMULA,    0,    None,    0,    "rules['PF_DEDUCTION'] + rules['TAX_DEDUCTION']"),
            ("Net Salary",                "NET_SALARY",                 RuleCategory.NET,       100, ComputationType.FORMULA,    0,    None,    0,    "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
        ]

        for (name, code, cat, seq, comp, fixed, pct_base, pct_val, formula) in rules_data:
            r = SalaryRule(
                structure_id=std_structure.id,
                name=name, code=code, category=cat, sequence=seq,
                computation_type=comp, fixed_amount=fixed,
                percentage_base_code=pct_base, percentage_value=pct_val,
                formula_expression=formula, is_active=True,
            )
            db.add(r)
        db.flush()

        # Differentiated structure definitions
        extra_structures = [
            {
                'name': 'Executive & Leadership Structure',
                'code': 'EXECUTIVE_LEADERSHIP',
                'rules': [
                    ('Basic Salary', 'BASIC', RuleCategory.BASIC, 10, ComputationType.FORMULA, 0, None, 0, 'contract.wage'),
                    ('Metro HRA (50%)', 'HRA', RuleCategory.ALLOWANCE, 20, ComputationType.PERCENTAGE, 0, 'BASIC', 50.0, None),
                    ('Executive Special Allowance', 'SPECIAL_ALLOWANCE', RuleCategory.ALLOWANCE, 25, ComputationType.PERCENTAGE, 0, 'BASIC', 25.0, None),
                    ('Executive Conveyance Allowance', 'CONVEYANCE', RuleCategory.ALLOWANCE, 30, ComputationType.FIXED, 5000.0, None, 0, None),
                    ('Executive Medical Allowance', 'MEDICAL', RuleCategory.ALLOWANCE, 35, ComputationType.FIXED, 2500.0, None, 0, None),
                    ('Gross Before LOP', 'GROSS_BEFORE_LOP', RuleCategory.GROSS, 40, ComputationType.FORMULA, 0, None, 0, "rules['BASIC'] + rules['HRA'] + rules['SPECIAL_ALLOWANCE'] + rules['CONVEYANCE'] + rules['MEDICAL']"),
                    ('Loss of Pay Deduction', 'LOP_DEDUCTION', RuleCategory.DEDUCTION, 50, ComputationType.FORMULA, 0, None, 0, "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
                    ('Gross After LOP', 'GROSS_AFTER_LOP', RuleCategory.GROSS, 60, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
                    ('Provident Fund (PF)', 'PF_DEDUCTION', RuleCategory.DEDUCTION, 70, ComputationType.PERCENTAGE, 0, 'BASIC', 12.0, None),
                    ('Income Tax / TDS (15%)', 'TAX_DEDUCTION', RuleCategory.DEDUCTION, 80, ComputationType.PERCENTAGE, 0, 'GROSS_AFTER_LOP', 15.0, None),
                    ('Total Statutory Deductions', 'TOTAL_STATUTORY_DEDUCTIONS', RuleCategory.DEDUCTION, 90, ComputationType.FORMULA, 0, None, 0, "rules['PF_DEDUCTION'] + rules['TAX_DEDUCTION']"),
                    ('Net Salary', 'NET_SALARY', RuleCategory.NET, 100, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
                ]
            },
            {
                'name': 'Tech Specialist & Engineering Structure',
                'code': 'TECH_SPECIALIST',
                'rules': [
                    ('Basic Salary', 'BASIC', RuleCategory.BASIC, 10, ComputationType.FORMULA, 0, None, 0, 'contract.wage'),
                    ('House Rent Allowance (40%)', 'HRA', RuleCategory.ALLOWANCE, 20, ComputationType.PERCENTAGE, 0, 'BASIC', 40.0, None),
                    ('Tech & Internet Allowance', 'TECH_ALLOWANCE', RuleCategory.ALLOWANCE, 25, ComputationType.FIXED, 4000.0, None, 0, None),
                    ('Learning & Development Stipend', 'LND_ALLOWANCE', RuleCategory.ALLOWANCE, 28, ComputationType.FIXED, 3000.0, None, 0, None),
                    ('Conveyance Allowance', 'CONVEYANCE', RuleCategory.ALLOWANCE, 30, ComputationType.FIXED, 2000.0, None, 0, None),
                    ('Gross Before LOP', 'GROSS_BEFORE_LOP', RuleCategory.GROSS, 40, ComputationType.FORMULA, 0, None, 0, "rules['BASIC'] + rules['HRA'] + rules['TECH_ALLOWANCE'] + rules['LND_ALLOWANCE'] + rules['CONVEYANCE']"),
                    ('Loss of Pay Deduction', 'LOP_DEDUCTION', RuleCategory.DEDUCTION, 50, ComputationType.FORMULA, 0, None, 0, "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
                    ('Gross After LOP', 'GROSS_AFTER_LOP', RuleCategory.GROSS, 60, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
                    ('Provident Fund (PF)', 'PF_DEDUCTION', RuleCategory.DEDUCTION, 70, ComputationType.PERCENTAGE, 0, 'BASIC', 12.0, None),
                    ('Income Tax / TDS (10%)', 'TAX_DEDUCTION', RuleCategory.DEDUCTION, 80, ComputationType.PERCENTAGE, 0, 'GROSS_AFTER_LOP', 10.0, None),
                    ('Total Statutory Deductions', 'TOTAL_STATUTORY_DEDUCTIONS', RuleCategory.DEDUCTION, 90, ComputationType.FORMULA, 0, None, 0, "rules['PF_DEDUCTION'] + rules['TAX_DEDUCTION']"),
                    ('Net Salary', 'NET_SALARY', RuleCategory.NET, 100, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
                ]
            },
            {
                'name': 'Sales & Field Operations Structure',
                'code': 'SALES_FIELD',
                'rules': [
                    ('Basic Salary', 'BASIC', RuleCategory.BASIC, 10, ComputationType.FORMULA, 0, None, 0, 'contract.wage'),
                    ('House Rent Allowance (40%)', 'HRA', RuleCategory.ALLOWANCE, 20, ComputationType.PERCENTAGE, 0, 'BASIC', 40.0, None),
                    ('Field Travel & Daily Allowance', 'TRAVEL_ALLOWANCE', RuleCategory.ALLOWANCE, 25, ComputationType.FIXED, 5000.0, None, 0, None),
                    ('Performance Incentive (15%)', 'PERFORMANCE_INCENTIVE', RuleCategory.ALLOWANCE, 30, ComputationType.PERCENTAGE, 0, 'BASIC', 15.0, None),
                    ('Gross Before LOP', 'GROSS_BEFORE_LOP', RuleCategory.GROSS, 40, ComputationType.FORMULA, 0, None, 0, "rules['BASIC'] + rules['HRA'] + rules['TRAVEL_ALLOWANCE'] + rules['PERFORMANCE_INCENTIVE']"),
                    ('Loss of Pay Deduction', 'LOP_DEDUCTION', RuleCategory.DEDUCTION, 50, ComputationType.FORMULA, 0, None, 0, "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
                    ('Gross After LOP', 'GROSS_AFTER_LOP', RuleCategory.GROSS, 60, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
                    ('Provident Fund (PF)', 'PF_DEDUCTION', RuleCategory.DEDUCTION, 70, ComputationType.PERCENTAGE, 0, 'BASIC', 12.0, None),
                    ('Income Tax / TDS (10%)', 'TAX_DEDUCTION', RuleCategory.DEDUCTION, 80, ComputationType.PERCENTAGE, 0, 'GROSS_AFTER_LOP', 10.0, None),
                    ('Total Statutory Deductions', 'TOTAL_STATUTORY_DEDUCTIONS', RuleCategory.DEDUCTION, 90, ComputationType.FORMULA, 0, None, 0, "rules['PF_DEDUCTION'] + rules['TAX_DEDUCTION']"),
                    ('Net Salary', 'NET_SALARY', RuleCategory.NET, 100, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
                ]
            },
            {
                'name': 'Internship Fixed Stipend Structure',
                'code': 'INTERN_STIPEND',
                'rules': [
                    ('Fixed Monthly Stipend', 'BASIC', RuleCategory.BASIC, 10, ComputationType.FORMULA, 0, None, 0, 'contract.wage'),
                    ('Gross Before LOP', 'GROSS_BEFORE_LOP', RuleCategory.GROSS, 40, ComputationType.FORMULA, 0, None, 0, "rules['BASIC']"),
                    ('Loss of Pay Deduction', 'LOP_DEDUCTION', RuleCategory.DEDUCTION, 50, ComputationType.FORMULA, 0, None, 0, "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
                    ('Gross After LOP', 'GROSS_AFTER_LOP', RuleCategory.GROSS, 60, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
                    ('Total Statutory Deductions', 'TOTAL_STATUTORY_DEDUCTIONS', RuleCategory.DEDUCTION, 90, ComputationType.FIXED, 0.0, None, 0, None),
                    ('Net Salary', 'NET_SALARY', RuleCategory.NET, 100, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
                ]
            },
            {
                'name': 'Contractor & Consultant Structure (10% TDS)',
                'code': 'CONTRACTOR_TDS',
                'rules': [
                    ('Professional Retainer Fee', 'BASIC', RuleCategory.BASIC, 10, ComputationType.FORMULA, 0, None, 0, 'contract.wage'),
                    ('Gross Before LOP', 'GROSS_BEFORE_LOP', RuleCategory.GROSS, 40, ComputationType.FORMULA, 0, None, 0, "rules['BASIC']"),
                    ('Loss of Pay Deduction', 'LOP_DEDUCTION', RuleCategory.DEDUCTION, 50, ComputationType.FORMULA, 0, None, 0, "(rules['BASIC'] / total_working_days) * unpaid_leave_days"),
                    ('Gross After LOP', 'GROSS_AFTER_LOP', RuleCategory.GROSS, 60, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_BEFORE_LOP'] - rules['LOP_DEDUCTION']"),
                    ('TDS Section 194J (10%)', 'TAX_DEDUCTION', RuleCategory.DEDUCTION, 80, ComputationType.PERCENTAGE, 0, 'GROSS_AFTER_LOP', 10.0, None),
                    ('Total Statutory Deductions', 'TOTAL_STATUTORY_DEDUCTIONS', RuleCategory.DEDUCTION, 90, ComputationType.FORMULA, 0, None, 0, "rules['TAX_DEDUCTION']"),
                    ('Net Salary', 'NET_SALARY', RuleCategory.NET, 100, ComputationType.FORMULA, 0, None, 0, "rules['GROSS_AFTER_LOP'] - rules['TOTAL_STATUTORY_DEDUCTIONS']"),
                ]
            }
        ]

        all_structures_map = {"STANDARD_REGULAR": std_structure}
        for s_data in extra_structures:
            st = SalaryStructure(name=s_data['name'], code=s_data['code'], is_active=True)
            db.add(st)
            db.flush()
            for r_name, r_code, r_cat, r_seq, r_comp, r_fix, r_pbase, r_pval, r_formula in s_data['rules']:
                rule = SalaryRule(
                    structure_id=st.id,
                    name=r_name, code=r_code, category=r_cat, sequence=r_seq,
                    computation_type=r_comp, fixed_amount=r_fix,
                    percentage_base_code=r_pbase, percentage_value=r_pval,
                    formula_expression=r_formula, is_active=True
                )
                db.add(rule)
            all_structures_map[s_data['code']] = st
        db.flush()

        # ─── 5. Users & Employees (Realistic Indian Corporate Salaries) ──
        print("👥 Seeding users & Indian enterprise team members with realistic salaries…")
        emp_data = [
            # (email, password, role, first, last, dept, job_title, wage, emp_type, color, bank_acct, ifsc)
            ("aarav.sharma@peoplepay360.com",  "demo1234", UserRole.EMPLOYEE,            "Aarav",   "Sharma",   dept_eng, "Senior Frontend Engineer", 65000, EmploymentType.FULL_TIME, "#4F46E5", "1029384756", "HDFC0001029"),
            ("priya.nair@peoplepay360.com",    "demo1234", UserRole.HR_MANAGER,          "Priya",   "Nair",     dept_hr,  "HR Manager",               55000, EmploymentType.FULL_TIME, "#0EA5E9", "9876543210", "ICIC0009876"),
            ("rajesh.kumar@peoplepay360.com",  "demo1234", UserRole.HR_PAYROLL_USER,     "Rajesh",  "Kumar",    dept_hr,  "Payroll Specialist",        48000, EmploymentType.FULL_TIME, "#10B981", "5544332211", "SBIN0005544"),
            ("sunita.rao@peoplepay360.com",    "demo1234", UserRole.HR_PAYROLL_MANAGER,  "Sunita",  "Rao",      dept_hr,  "Payroll Manager",           85000, EmploymentType.FULL_TIME, "#F59E0B", "4433221100", "UTIB0004433"),
            ("amit.verma@peoplepay360.com",    "demo1234", UserRole.ADMIN,               "Amit",    "Verma",    dept_ops, "System Administrator",      90000, EmploymentType.FULL_TIME, "#EF4444", "7788990011", "KKBK0007788"),
            ("kabir.kapoor@peoplepay360.com",  "demo1234", UserRole.EMPLOYEE,            "Kabir",   "Kapoor",   dept_ops, "Operations Lead",           58000, EmploymentType.FULL_TIME, "#8B5CF6", None, None),
            ("ananya.iyer@peoplepay360.com",   "demo1234", UserRole.EMPLOYEE,            "Ananya",  "Iyer",     dept_eng, "Backend Engineer",          55000, EmploymentType.FULL_TIME, "#EC4899", "1122334455", "HDFC0001234"),
            ("rahul.deshmukh@peoplepay360.com","demo1234", UserRole.EMPLOYEE,            "Rahul",   "Deshmukh", dept_eng, "DevOps Engineer",           62000, EmploymentType.FULL_TIME, "#14B8A6", "2233445566", "ICIC0009871"),
            ("divya.nair@peoplepay360.com",    "demo1234", UserRole.EMPLOYEE,            "Divya",   "Nair",     dept_eng, "QA Engineer",               46000, EmploymentType.FULL_TIME, "#F97316", "3344556677", "AXIS0005612"),
            ("rohan.joshi@peoplepay360.com",   "demo1234", UserRole.EMPLOYEE,            "Rohan",   "Joshi",    dept_ops, "Business Analyst",          49000, EmploymentType.FULL_TIME, "#6366F1", "4455667788", "SBIN0001244"),
            ("ritu.agrawal@peoplepay360.com",  "demo1234", UserRole.EMPLOYEE,            "Ritu",    "Agrawal",  dept_hr,  "HR Business Partner",       44000, EmploymentType.FULL_TIME, "#A855F7", "5566778899", "KKBK0002133"),
            ("sameer.khan@peoplepay360.com",   "demo1234", UserRole.EMPLOYEE,            "Sameer",  "Khan",     dept_ops, "Product Manager",           72000, EmploymentType.FULL_TIME, "#F43F5E", "6677889900", "YESB0000341"),
        ]

        created_users = []
        created_employees = []

        for idx, (email, pwd, role, first, last, dept, job_title, wage, emp_type, color, bank_acct, ifsc) in enumerate(emp_data):
            user = User(
                email=email,
                hashed_password=hash_password(pwd),
                role=role,
                is_active=True,
            )
            db.add(user)
            db.flush()

            job_pos = jobs.get(job_title)
            initials = f"{first[0]}{last[0]}"
            badge = f"EMP-{idx+1:03d}"

            emp = Employee(
                user_id=user.id,
                badge_id=badge,
                first_name=first,
                last_name=last,
                work_email=email,
                department_id=dept.id,
                job_position_id=job_pos.id if job_pos else None,
                working_schedule_id=std_schedule.id,
                employment_type=emp_type,
                status=EmployeeStatus.ACTIVE,
                hire_date=date(2024, 1, 15),
                bank_name="HDFC Bank" if bank_acct else None,
                bank_account_no=bank_acct,
                ifsc_swift=ifsc,
                avatar_initials=initials,
                avatar_color=color,
            )
            db.add(emp)
            db.flush()

            created_users.append(user)
            created_employees.append(emp)

        # Set manager relationships
        priya_emp = created_employees[1]
        amit_emp = created_employees[4]
        for emp in created_employees:
            if emp.department_id in [dept_eng.id, dept_hr.id] and emp != priya_emp:
                emp.manager_id = priya_emp.id
            elif emp.department_id == dept_ops.id and emp != amit_emp:
                emp.manager_id = amit_emp.id
        db.flush()

        # ─── 6. Contracts ─────────────────────────────────────────────────
        print("📄 Seeding contracts…")
        created_contracts = []
        # Mapping index to differentiated structure code
        emp_struct_codes = [
            "TECH_SPECIALIST",      # Aarav (Eng)
            "STANDARD_REGULAR",    # Priya (HR)
            "STANDARD_REGULAR",    # Rajesh (HR)
            "EXECUTIVE_LEADERSHIP",# Sunita (Leadership)
            "EXECUTIVE_LEADERSHIP",# Amit (Admin / Ops)
            "SALES_FIELD",         # Kabir (Ops)
            "TECH_SPECIALIST",     # Ananya (Eng)
            "TECH_SPECIALIST",     # Rahul (Eng)
            "CONTRACTOR_TDS",      # Divya (QA Contractor)
            "SALES_FIELD",         # Rohan (Analyst)
            "INTERN_STIPEND",      # Ritu (HR Intern)
            "EXECUTIVE_LEADERSHIP",# Sameer (Product Lead)
        ]

        for i, emp in enumerate(created_employees):
            wage = emp_data[i][7]
            s_code = emp_struct_codes[i] if i < len(emp_struct_codes) else "STANDARD_REGULAR"
            struct_to_use = all_structures_map.get(s_code, std_structure)

            # Historical contract (expired)
            if i < 5:
                db.add(Contract(
                    reference=f"CNT-2024-{emp.first_name.upper()}-00",
                    employee_id=emp.id,
                    salary_structure_id=struct_to_use.id,
                    working_schedule_id=std_schedule.id,
                    wage=wage * 0.85,
                    start_date=date(2024, 1, 15),
                    end_date=date(2025, 12, 31),
                    status=ContractStatus.EXPIRED,
                ))

            # Current active contract
            c = Contract(
                reference=f"CNT-2026-{emp.first_name.upper()}-01",
                employee_id=emp.id,
                salary_structure_id=struct_to_use.id,
                working_schedule_id=std_schedule.id,
                wage=wage,
                start_date=date(2026, 1, 1),
                end_date=None,
                status=ContractStatus.ACTIVE,
            )
            db.add(c)
            created_contracts.append(c)
        db.flush()

        # ─── 7. Time Off Types & Allocations ──────────────────────────────
        print("🏖️ Seeding leave types & employee allocations…")
        annual_leave = TimeOffType(name="Annual Leave", unit=LeaveUnit.DAYS, requires_allocation=True,  is_paid=True,  color="#4F46E5", max_days_per_year=20)
        sick_leave   = TimeOffType(name="Sick Leave",   unit=LeaveUnit.DAYS, requires_allocation=True,  is_paid=True,  color="#0EA5E9", max_days_per_year=10)
        unpaid_leave = TimeOffType(name="Unpaid Leave (LOP)", unit=LeaveUnit.DAYS, requires_allocation=False, is_paid=False, color="#EF4444")
        casual_leave = TimeOffType(name="Casual Leave", unit=LeaveUnit.DAYS, requires_allocation=True,  is_paid=True,  color="#10B981", max_days_per_year=8)
        db.add_all([annual_leave, sick_leave, unpaid_leave, casual_leave])
        db.flush()

        for emp in created_employees:
            for leave_type, days_quota in [(annual_leave, 20.0), (sick_leave, 10.0), (casual_leave, 8.0)]:
                db.add(TimeOffAllocation(
                    employee_id=emp.id,
                    leave_type_id=leave_type.id,
                    allocated_days=days_quota,
                    valid_from=date(2026, 1, 1),
                    valid_to=date(2026, 12, 31),
                    status=AllocationStatus.APPROVED,
                    approved_by_id=priya_emp.id,
                ))
        db.flush()

        # ─── 8. Time Off Requests (Last 6 Months) ─────────────────────────
        print("🏝️ Seeding time-off requests across last 6 months (March - Sep 2026)…")
        aarav_emp  = created_employees[0]
        rajesh_emp = created_employees[2]
        sunita_emp = created_employees[3]
        kabir_emp  = created_employees[5]
        ananya_emp = created_employees[6]
        rahul_emp  = created_employees[7]
        divya_emp  = created_employees[8]
        rohan_emp  = created_employees[9]
        ritu_emp   = created_employees[10]
        sameer_emp = created_employees[11]

        leave_specs = [
            # March 2026
            (aarav_emp.id,  casual_leave, date(2026, 3, 12), date(2026, 3, 13), 2.0, "Personal errands & family event", TimeOffRequestStatus.APPROVED),
            (priya_emp.id,  sick_leave,   date(2026, 3, 25), date(2026, 3, 25), 1.0, "Viral fever & recovery", TimeOffRequestStatus.APPROVED),
            (rahul_emp.id,  casual_leave, date(2026, 3, 30), date(2026, 3, 30), 1.0, "Bank and documentation work", TimeOffRequestStatus.APPROVED),
            (ritu_emp.id,   casual_leave, date(2026, 3, 5),  date(2026, 3, 5),  1.0, "Family function", TimeOffRequestStatus.APPROVED),
            # April 2026
            (rajesh_emp.id, annual_leave, date(2026, 4, 16), date(2026, 4, 17), 2.0, "Family trip to hill station", TimeOffRequestStatus.APPROVED),
            (divya_emp.id,  sick_leave,   date(2026, 4, 28), date(2026, 4, 28), 1.0, "Dentist appointment", TimeOffRequestStatus.APPROVED),
            (sunita_emp.id, sick_leave,   date(2026, 4, 8),  date(2026, 4, 8),  1.0, "Migraine & rest", TimeOffRequestStatus.APPROVED),
            (sameer_emp.id, sick_leave,   date(2026, 4, 2),  date(2026, 4, 2),  1.0, "Seasonal flu", TimeOffRequestStatus.APPROVED),
            # May 2026
            (ananya_emp.id, annual_leave, date(2026, 5, 11), date(2026, 5, 13), 3.0, "Sister's wedding ceremony", TimeOffRequestStatus.APPROVED),
            (sunita_emp.id, casual_leave, date(2026, 5, 21), date(2026, 5, 21), 1.0, "Personal work", TimeOffRequestStatus.APPROVED),
            (aarav_emp.id,  sick_leave,   date(2026, 5, 4),  date(2026, 5, 4),  1.0, "Food poisoning recovery", TimeOffRequestStatus.APPROVED),
            (kabir_emp.id,  annual_leave, date(2026, 5, 27), date(2026, 5, 28), 2.0, "Summer holiday", TimeOffRequestStatus.APPROVED),
            (rohan_emp.id,  casual_leave, date(2026, 5, 7),  date(2026, 5, 8),  2.0, "House relocation", TimeOffRequestStatus.APPROVED),
            # June 2026
            (rahul_emp.id,  annual_leave, date(2026, 6, 8),  date(2026, 6, 9),  2.0, "Family vacation", TimeOffRequestStatus.APPROVED),
            (kabir_emp.id,  unpaid_leave, date(2026, 6, 24), date(2026, 6, 24), 1.0, "Urgent non-medical personal matter", TimeOffRequestStatus.APPROVED),
            (priya_emp.id,  annual_leave, date(2026, 6, 18), date(2026, 6, 19), 2.0, "Short wellness retreat", TimeOffRequestStatus.APPROVED),
            (sameer_emp.id, casual_leave, date(2026, 6, 2),  date(2026, 6, 3),  2.0, "Domestic travel", TimeOffRequestStatus.APPROVED),
            (divya_emp.id,  casual_leave, date(2026, 6, 15), date(2026, 6, 15), 1.0, "Personal errands", TimeOffRequestStatus.APPROVED),
            # July 2026
            (rohan_emp.id,  annual_leave, date(2026, 7, 14), date(2026, 7, 16), 3.0, "Monsoon trekking trip", TimeOffRequestStatus.APPROVED),
            (ritu_emp.id,   sick_leave,   date(2026, 7, 27), date(2026, 7, 27), 1.0, "Medical consultation", TimeOffRequestStatus.APPROVED),
            (aarav_emp.id,  annual_leave, date(2026, 7, 9),  date(2026, 7, 10), 2.0, "Annual family leave", TimeOffRequestStatus.APPROVED),
            (rajesh_emp.id, casual_leave, date(2026, 7, 23), date(2026, 7, 23), 1.0, "Vehicle registration appointment", TimeOffRequestStatus.APPROVED),
            (rahul_emp.id,  sick_leave,   date(2026, 7, 31), date(2026, 7, 31), 1.0, "Allergy treatment", TimeOffRequestStatus.APPROVED),
            # August 2026
            (sameer_emp.id, annual_leave, date(2026, 8, 10), date(2026, 8, 12), 3.0, "Annual holiday", TimeOffRequestStatus.APPROVED),
            (priya_emp.id,  casual_leave, date(2026, 8, 7),  date(2026, 8, 7),  1.0, "Personal leave", TimeOffRequestStatus.APPROVED),
            (sunita_emp.id, annual_leave, date(2026, 8, 18), date(2026, 8, 19), 2.0, "Family gathering", TimeOffRequestStatus.APPROVED),
            (aarav_emp.id,  unpaid_leave, date(2026, 8, 28), date(2026, 8, 28), 1.0, "Emergency personal legal work", TimeOffRequestStatus.APPROVED),
            (divya_emp.id,  annual_leave, date(2026, 8, 3),  date(2026, 8, 4),  2.0, "Short weekend getaway", TimeOffRequestStatus.APPROVED),
            (kabir_emp.id,  casual_leave, date(2026, 8, 24), date(2026, 8, 24), 1.0, "Passport renewal appointment", TimeOffRequestStatus.APPROVED),
            (ritu_emp.id,   annual_leave, date(2026, 8, 20), date(2026, 8, 20), 1.0, "Family event", TimeOffRequestStatus.APPROVED),
            # September 2026
            (aarav_emp.id,  annual_leave, date(2026, 9, 2),  date(2026, 9, 2),  1.0, "Personal work", TimeOffRequestStatus.APPROVED),
            # Pending Requests in queue for testing HR workflow
            (ananya_emp.id, annual_leave, date(2026, 9, 16), date(2026, 9, 18), 3.0, "Upcoming vacation with parents", TimeOffRequestStatus.SUBMITTED),
            (rohan_emp.id,  casual_leave, date(2026, 9, 23), date(2026, 9, 23), 1.0, "Doctor follow-up checkup", TimeOffRequestStatus.SUBMITTED),
        ]

        employee_leave_dates = {}
        for (e_id, l_type, s_d, e_d, dur, reas, stat) in leave_specs:
            req = TimeOffRequest(
                employee_id=e_id,
                leave_type_id=l_type.id,
                start_date=s_d,
                end_date=e_d,
                duration_days=dur,
                reason=reas,
                status=stat,
                approved_by_id=priya_emp.id if stat == TimeOffRequestStatus.APPROVED else None,
                approved_at=datetime(s_d.year, s_d.month, max(1, s_d.day - 2), 10, 30, 0) if stat == TimeOffRequestStatus.APPROVED else None,
            )
            db.add(req)

            if stat == TimeOffRequestStatus.APPROVED:
                cur_d = s_d
                while cur_d <= e_d:
                    employee_leave_dates[(e_id, cur_d)] = l_type.is_paid
                    cur_d += timedelta(days=1)
        db.flush()

        # ─── 9. Attendance Records (March 1 - Sep 4, 2026: Mon-Fri Only) ──
        print("⏱️ Seeding 6 months of attendance records (Mon-Fri only, weekends OFF)…")
        # Today is Saturday, September 5, 2026 -> NEVER generate attendance for Sep 5+ in seed!
        attendance_business_days = []
        cur_day = date(2026, 3, 1)
        end_seed_day = date(2026, 9, 4)

        while cur_day <= end_seed_day:
            if cur_day.weekday() < 5:  # Monday=0, ..., Friday=4. Saturday & Sunday are strictly OFF!
                attendance_business_days.append(cur_day)
            cur_day += timedelta(days=1)

        print(f"  → Found {len(attendance_business_days)} standard business days across the 6-month period.")

        total_attendance_seeded = 0
        for emp in created_employees:
            for day in attendance_business_days:
                # If employee is on approved leave today, do not seed punch-in
                if (emp.id, day) in employee_leave_dates:
                    continue

                # 2% random unexcused absence
                if random.random() < 0.02 and day < date(2026, 9, 1):
                    continue

                # Realistic punch parameters
                rand_val = random.random()
                if rand_val < 0.07:
                    # Late arrival (09:16 - 09:36)
                    late_mins = random.randint(16, 36)
                    check_in = datetime(day.year, day.month, day.day, 9, late_mins, random.randint(10, 50))
                    status = AttendanceStatus.LATE
                elif rand_val < 0.20:
                    # Grace window arrival (09:01 - 09:12) -> PRESENT
                    grace_mins = random.randint(1, 12)
                    check_in = datetime(day.year, day.month, day.day, 9, grace_mins, random.randint(10, 50))
                    status = AttendanceStatus.PRESENT
                else:
                    # Early/punctual arrival (08:45 - 08:59) -> PRESENT
                    early_mins = random.randint(45, 59)
                    check_in = datetime(day.year, day.month, day.day, 8, early_mins, random.randint(10, 50))
                    status = AttendanceStatus.PRESENT

                # Missing checkout check (1% chance)
                is_missing = random.random() < 0.01 and day < date(2026, 9, 1)
                if is_missing:
                    check_out = None
                    worked_hours = 0.0
                    overtime_hours = 0.0
                    status = AttendanceStatus.MISSING_CHECKOUT
                else:
                    # Realistic checkout
                    # 15% overtime shift (18:45 - 19:35), 85% normal departure (18:00 - 18:25)
                    if random.random() < 0.15:
                        ot_mins = random.randint(45, 95)
                        check_out = datetime(day.year, day.month, day.day, 18, 0, 0) + timedelta(minutes=ot_mins)
                    else:
                        norm_mins = random.randint(0, 22)
                        check_out = datetime(day.year, day.month, day.day, 18, norm_mins, random.randint(10, 50))

                    gross_duration = (check_out - check_in).total_seconds() / 3600.0
                    worked_hours = round(max(0.0, gross_duration - 1.0), 2)  # 1 hour lunch break
                    overtime_hours = round(max(0.0, worked_hours - 8.0), 2)

                # Occasional audited manual correction (1%)
                is_manual = False
                corr_note = None
                corr_by = None
                corr_at = None
                if random.random() < 0.012 and day < date(2026, 8, 15):
                    is_manual = True
                    corr_note = random.choice([
                        "Biometric turnstile firmware sync discrepancy corrected by HR",
                        "Client site visit punch approved per manager timesheet",
                        "VPN hardware token latency adjustment approved",
                    ])
                    corr_by = priya_emp.id
                    corr_at = datetime(day.year, day.month, day.day, 19, 0, 0)

                db.add(Attendance(
                    employee_id=emp.id,
                    date=day,
                    check_in=check_in,
                    check_out=check_out,
                    worked_hours=worked_hours,
                    overtime_hours=overtime_hours,
                    status=status,
                    is_manual_correction=is_manual,
                    correction_notes=corr_note,
                    corrected_by_id=corr_by,
                    corrected_at=corr_at,
                ))
                total_attendance_seeded += 1

        db.flush()
        print(f"  → Successfully seeded {total_attendance_seeded} realistic attendance punch logs.")

        # ─── 10. Completed Payruns STRICTLY BEFORE August 2026 (March - July) ─
        print("💵 Seeding completed payroll batches & payslips for months BEFORE August 2026 (March - July)…")
        # Per user requirement: only create payroll BEFORE August so the user can test August & September with the wizard!
        pre_august_months = [
            (3, 31, "March 2026"),
            (4, 30, "April 2026"),
            (5, 31, "May 2026"),
            (6, 30, "June 2026"),
            (7, 31, "July 2026"),
        ]

        for m_num, m_last_day, m_name in pre_august_months:
            p_start = date(2026, m_num, 1)
            p_end = date(2026, m_num, m_last_day)
            ref = f"PAY/2026/{m_num:02d}/001"

            payrun = Payrun(
                reference=ref,
                name=f"{m_name} Regular Payroll Batch",
                salary_structure_id=std_structure.id,
                department_id=None,
                employee_type="All",
                period_start=p_start,
                period_end=p_end,
                status=PayrunStatus.PAID,
                created_by_id=sunita_emp.id,
                created_at=datetime(2026, m_num, m_last_day, 14, 0, 0),
                computed_at=datetime(2026, m_num, m_last_day, 14, 30, 0),
                validated_at=datetime(2026, m_num, m_last_day, 16, 0, 0),
                paid_at=datetime(2026, m_num, m_last_day, 17, 30, 0),
            )
            db.add(payrun)
            db.flush()

            sched_days = _count_business_days(p_start, p_end)
            pr_gross = 0.0
            pr_deductions = 0.0
            pr_net = 0.0

            for emp in created_employees:
                contract = next((c for c in created_contracts if c.employee_id == emp.id and c.status == ContractStatus.ACTIVE), created_contracts[0])

                # Count attendances in period
                att_records = db.query(Attendance).filter(
                    Attendance.employee_id == emp.id,
                    Attendance.date >= p_start,
                    Attendance.date <= p_end,
                ).all()

                worked_days = float(len(att_records))
                ot_hours = round(sum(a.overtime_hours for a in att_records), 2)

                # Leaves in period
                emp_leaves = db.query(TimeOffRequest).filter(
                    TimeOffRequest.employee_id == emp.id,
                    TimeOffRequest.start_date <= p_end,
                    TimeOffRequest.end_date >= p_start,
                    TimeOffRequest.status == TimeOffRequestStatus.APPROVED,
                ).all()

                paid_leaves = 0.0
                unpaid_leaves = 0.0
                for lr in emp_leaves:
                    if lr.leave_type and lr.leave_type.is_paid:
                        paid_leaves += lr.duration_days
                    else:
                        unpaid_leaves += lr.duration_days

                # Compute exact payslip via mathematical rule engine
                gross, deductions, net, lines = compute_payslip(
                    contract=contract,
                    worked_days=worked_days,
                    total_working_days=sched_days,
                    unpaid_leave_days=unpaid_leaves,
                    paid_leave_days=paid_leaves,
                    overtime_hours=ot_hours,
                    rules_list=created_rules,
                )

                payslip = Payslip(
                    payrun_id=payrun.id,
                    employee_id=emp.id,
                    contract_id=contract.id,
                    period_start=p_start,
                    period_end=p_end,
                    scheduled_days=sched_days,
                    worked_days=worked_days,
                    paid_leave_days=paid_leaves,
                    unpaid_leave_days=unpaid_leaves,
                    overtime_hours=ot_hours,
                    gross_pay=gross,
                    total_deductions=deductions,
                    net_pay=net,
                    status=PayslipStatus.PAID,
                    verification_status=VerificationStatus.CONFIRMED,
                    created_at=datetime(2026, m_num, m_last_day, 14, 30, 0),
                )
                db.add(payslip)
                db.flush()

                # Add sequenced breakdown lines
                for line_data in lines:
                    db.add(PayslipLine(
                        payslip_id=payslip.id,
                        rule_id=line_data["rule_id"],
                        rule_name=line_data["rule_name"],
                        rule_code=line_data["rule_code"],
                        category=RuleCategory(line_data["category"]),
                        sequence=line_data["sequence"],
                        amount=line_data["amount"],
                    ))

                # Add payslip dispatch notification email in Outbox
                db.add(EmailOutbox(
                    payslip_id=payslip.id,
                    payrun_id=payrun.id,
                    recipient_email=emp.work_email,
                    recipient_name=emp.full_name,
                    subject=f"Official Payslip for {m_name} — PeoplePay360 HR",
                    body_html=f"""<div style='font-family: Arial, sans-serif; color: #1e293b;'>
                        <h2>PeoplePay360 Salary Advice Statement</h2>
                        <p>Dear <b>{emp.full_name}</b>,</p>
                        <p>Your monthly compensation for <b>{m_name}</b> has been disbursed successfully.</p>
                        <ul>
                            <li><b>Gross Remuneration:</b> ₹{gross:,.2f}</li>
                            <li><b>Statutory Deductions:</b> ₹{deductions:,.2f}</li>
                            <li><b>Net Take-Home Disbursed:</b> ₹{net:,.2f}</li>
                        </ul>
                        <p>Log into your PeoplePay360 portal to download the digital PDF tax certificate.</p>
                    </div>""",
                    email_type="payslip",
                    status=EmailStatus.SENT,
                    sent_at=datetime(2026, m_num, m_last_day, 17, 35, 0),
                ))

                pr_gross += gross
                pr_deductions += deductions
                pr_net += net

            payrun.total_gross = round(pr_gross, 2)
            payrun.total_deductions = round(pr_deductions, 2)
            payrun.total_net = round(pr_net, 2)
            db.flush()

        print("  → Seeded 5 monthly payruns (March - July 2026) with 60 itemized payslips & email dispatches.")
        print("  → August 2026 & September 2026 remain OPEN for user testing in the Payroll Wizard!")

        # ─── 11. Office Hours 3-Day Broadcast Notification ────────────────
        print("📢 Seeding company broadcast alert notification…")
        db.add(OfficeHoursNotification(
            title="Official Company Office Timings Policy",
            message="Standard shift hours are 09:00 AM to 06:00 PM (1.0h lunch break). A ±45-minute grace buffer is actively applied to all check-in and check-out punches with zero salary deductions.",
            old_start_time="09:00",
            old_end_time="18:00",
            new_start_time="09:00",
            new_end_time="18:00",
            grace_minutes=45,
            effective_date=date(2026, 9, 1),
            reason="Company-wide biometric attendance and grace buffer standard operating procedure realignment.",
            updated_by_name="Amit Verma (Admin)",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=3),
        ))

        db.commit()
        print("\n✅ SEED COMPLETE! Pre-August historical payroll & realistic Indian corporate salaries configured.")
        print("\n📋 Demo Personas (All Passwords: demo1234):")
        print("  👤 aarav.sharma@peoplepay360.com  — Senior Frontend Engineer (₹65,000/mo)")
        print("  👔 priya.nair@peoplepay360.com    — HR Manager (₹55,000/mo)")
        print("  📑 rajesh.kumar@peoplepay360.com  — Payroll Specialist (₹48,000/mo)")
        print("  👑 sunita.rao@peoplepay360.com    — Payroll Manager (₹85,000/mo)")
        print("  🔧 amit.verma@peoplepay360.com    — System Administrator / Admin (₹90,000/mo)")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed with error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
