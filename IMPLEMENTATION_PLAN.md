# Master Implementation Plan: PeoplePay360 HR & Payroll Operations Platform
## Enterprise Engineering Roadmap & Technical Implementation Blueprint

```
====================================================================================================
  PROJECT EXECUTION CONTROL & METADATA
====================================================================================================
  System Name        : PeoplePay360 (HR & Payroll Platform)
  Document Version   : 3.1.0-COMPREHENSIVE-EXECUTION-PLAN
  Aligned Spec Doc   : PEOPLEPAY360_SPECIFICATION.md (v3.1.0-COMPREHENSIVE-BLUEPRINT)
  Target Architecture: Python FastAPI (Backend) + React TypeScript Vite (Frontend) + SQLite (DB)
  Primary Outcome    : Unified Operational Flow across Master Data, Attendance, Leaves & Payroll
====================================================================================================
```

---

## 1. Executive Goal & System Scope

The objective of this engineering plan is to implement **PeoplePay360**, an integrated Human Resource and Payroll Operations Platform. The system bridges daily HR administration (employee lifecycle, contracts, working schedules, daily attendance logs, and leave balances) with dynamic, sequenced salary rule computations, a dedicated global payslips view, a two-step payrun creation wizard, pre-validation anomaly detection, an operational pre-payroll verification and employee grievance resolution loop, publication-ready PDF payslip generation, real SMTP and In-App Outbox email distribution, and a multi-tier dynamic executive analytics dashboard featuring all 5 required core KPIs and full attendance metrics.

---

## 2. Complete Technology Stack & Architectural Decisions

### 2.1 Backend Architecture (`/backend`)
- **Runtime & Framework:** Python 3.11+ / **FastAPI** with `Uvicorn` ASGI server.
- **ORM & Database Layer:** **SQLAlchemy 2.0** with **SQLite** (Portable single-file database pre-populated with realistic enterprise seed data).
- **Authentication & Security:** JWT with `python-jose` and `passlib[bcrypt]`. Role-based endpoint authorization middleware and row-level SQL query scoping (`WHERE employee_id == current_user.employee_id`).
- **Salary Formula Sandbox:** Restricted Python Abstract Syntax Tree (`ast`) evaluator preventing arbitrary code execution while supporting arithmetic, conditional ternary expressions, and math utilities (`min`, `max`, `round`).
- **Document & PDF Generation:** `ReportLab` for generating publication-ready Odoo-style PDF payslips with corporate branding.
- **Email Engine:** Dual-mode dispatcher: Real SMTP when configured, with fallback logging to `emails_outbox` table.

### 2.2 Frontend Architecture (`/frontend`)
- **Framework & Tooling:** **React 18** with **TypeScript** and **Vite**.
- **Styling & Design System:** **TailwindCSS** + **Shadcn UI** component patterns + **Lucide React Icons**.
- **State Management & Data Fetching:** React Context API + Axios API service layer.
- **Data Visualization & Analytics:** **Recharts** for salary expenditure donuts, monthly net pay area charts, and attendance status bar graphs.

---

## 3. Full 1-to-1 Specification Alignment Matrix

| Spec ID | Module Name | Backend Files / Engines | Frontend Pages / Components | Verification Suite |
| :--- | :--- | :--- | :--- | :--- |
| **RBAC** | **Granular 5-Tier RBAC** | `auth.py`<br>`dependencies.py` | `PersonaSwitcher.tsx`<br>`ProtectedRoute.tsx` | `test_rbac.py` |
| **A1 & B1, B2** | **Employee Master Hub (5 Smart Buttons)** | `routes/employees.py`<br>`services/employee_service.py` | `pages/EmployeesPage.tsx`<br>`components/EmployeeForm.tsx` | `test_employees.py` |
| **A2** | **Contract Management & Historical Matching** | `routes/contracts.py`<br>`services/contract_service.py` | `pages/ContractsPage.tsx`<br>`components/ContractForm.tsx` | `test_contract_matching.py` |
| **A3** | **Working Schedules (40h/week)** | `routes/schedules.py`<br>`services/schedule_service.py` | `pages/SchedulesPage.tsx`<br>`components/SchedulePatternGrid.tsx`| `test_schedules.py` |
| **A4 & B4** | **Time Off & Allocations (Explicit List Columns)** | `routes/leaves.py`<br>`services/leave_service.py` | `pages/TimeOffPage.tsx`<br>`components/LeaveRequestModal.tsx` | `test_leaves.py` |
| **A5, A6** | **Salary Structures & Sequenced Rule Engine**| `routes/salary_config.py`<br>`services/salary_engine.py` | `pages/SalaryStructuresPage.tsx`<br>`components/RuleEditorModal.tsx` | `test_salary_engine.py` |
| **B3** | **Attendance Tracking & Exception Auditing** | `routes/attendance.py`<br>`services/attendance_service.py`| `pages/AttendancePage.tsx`<br>`components/PunchWidget.tsx` | `test_attendance.py` |
| **B5** | **Two-Step Payrun Creation Wizard** | `routes/payruns.py`<br>`services/payrun_service.py` | `components/PayrunWizardModal.tsx` | `test_payruns.py` |
| **B6** | **Payrun Control Center & Warnings**| `routes/payruns.py`<br>`services/validator_service.py` | `pages/PayrunDetailPage.tsx`<br>`components/WarningBanner.tsx` | `test_payruns.py` |
| **B6.1** | **Pre-Payroll (Zero Salary) & Grievances** | `routes/grievances.py`<br>`services/grievance_service.py` | `components/PrePayrollModal.tsx`<br>`components/GrievancePanel.tsx` | `test_grievances.py` |
| **B7** | **Dedicated Global Payslips List & Breakdown** | `routes/payslips.py` | `pages/PayslipsPage.tsx`<br>`components/PayslipModal.tsx` | `test_payslips.py` |
| **B8** | **PDF & Real SMTP / Outbox Email Dispatch**| `services/pdf_service.py`<br>`services/email_service.py` | `components/OutboxModal.tsx` | `test_pdf_email.py` |
| **B9 / D** | **Multi-Tier Dashboard (5 Core KPIs + 7 Attendance Metrics)** | `routes/dashboard.py`<br>`services/dashboard_service.py` | `pages/DashboardPage.tsx`<br>`components/KPICards.tsx` | `test_dashboard.py` |
| **E** | **Complete 10-Step Flow Integration** | Integrated Orchestrator | Full System Integration | `test_end_to_end.py` |

---

## 4. Phase-by-Phase Technical Execution Plan

```
+----------------------------------------------------------------------------------------------------+
|                                    PROJECT EXECUTION PHASES                                        |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ PHASE 1: System Foundation, DB Engine, Auth & Seed Generator ]                                  |
|  • Initialize FastAPI backend & React frontend project structures.                                 |
|  • Implement 17 SQLAlchemy models, Pydantic schemas, and database session management.              |
|  • Build JWT authentication, RBAC middleware, and 1-Click Persona Switcher.                        |
|  • Write rich database seed script (12 employees, 3 departments, contracts, schedules, rules).     |
|                                                                                                    |
|  [ PHASE 2: HR Backend & Master Data Operational Modules ]                                         |
|  • A1 & B1/B2: Employee Hub (Kanban cards, sortable table, Form view with 5 smart buttons).        |
|  • A2: Contract Management (historical versioning, date-based period matching, wage binding).      |
|  • A3: Working Schedules (09:00-18:00 with 1h break = 40h/week derived).                           |
|  • A4 & B4: Time Off Management (types, quota allocation approval ledger, request list columns).   |
|  • B3: Daily Attendance Tracking (Check-in widget, 7 metrics, audited manual correction).          |
|                                                                                                    |
|  [ PHASE 3: Sequenced Salary Rule Engine & Formula Sandbox ]                                       |
|  • A5 & A6: Salary Structures & Sequenced Rule Engine (Basic, HRA, Gross Before/After LOP, Net).   |
|  • Build Safe Python AST formula evaluation sandbox with runtime variable injection.               |
|  • Implement pro-rata wage deduction algorithm for unpaid leave / loss of pay days.                |
|  • Salary Structure & Rule configuration UI with interactive sequence re-ordering and tester.     |
|                                                                                                    |
|  [ PHASE 4: Two-Step Payrun Wizard, Verification & Grievance Flow ]                                |
|  • B5: Two-Step Payrun Creation Wizard (Step 1: Scope/Period/Structure -> Step 2: Candidates).     |
|  • B6: Batch Processing Control Center with 5 pre-validation anomaly warning checks.               |
|  • B6.1: Pre-Payroll Operational Statement distribution (zero salary disclosure).                  |
|  • B6.1: Employee grievance submission & HR Grievance Resolution Center (Accept & Adjust/Reject).  |
|                                                                                                    |
|  [ PHASE 5: Dedicated Global Payslips List, PDF Generator & Real SMTP / Outbox ]                   |
|  • B7: Dedicated Global Payslips List View (`/payslips`) & Granular Payslip breakdown modal.       |
|  • B8: Printable Odoo-grade PDF payslip generator with company branding.                           |
|  • B8: Dual-mode email engine: Real SMTP dispatch with In-App Outbox fallback for demo inspection.|
|                                                                                                    |
|  [ PHASE 6: Multi-Tier Analytics & Dynamic Executive Dashboard ]                                   |
|  • Layer 1: Employee Self-Service Personal KPIs (take-home pay, leave balances, clocked hours).    |
|  • Layer 2: HR & Payroll Combined Dashboard with ALL 5 REQUIRED KPIS + 7 ATTENDANCE METRICS.      |
|  • Layer 3: HR Individual Employee Analytics Drilldown (wage trajectory, YTD totals, leave quota). |
|  • Recharts Visualizations (Salary by Dept Donut, Monthly Trends Line, Attendance Status Bar).      |
|  • Global Filter Bar (`period_start`, `period_end`, `department_id`, `employee_type`).             |
|                                                                                                    |
|  [ PHASE 7: Verification Suites, UI Polish & Hackathon Demo Walkthrough ]                          |
|  • Execute automated test suites (`test_salary_engine.py`, `test_contract_matching.py`, etc).      |
|  • Validate all 5 demonstration persona user journeys for live presentation.                       |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Algorithmic Blueprints for Core Engines

### 5.1 Sequenced Salary Calculation Engine (`backend/services/salary_engine.py`)
```python
def compute_payslip(contract, worked_days, total_working_days, unpaid_leave_days, structure):
    context = {
        "contract": contract,
        "worked_days": worked_days,
        "total_working_days": total_working_days,
        "unpaid_leave_days": unpaid_leave_days,
        "rules": {},
        "categories": {"BASIC": 0.0, "ALLOWANCE": 0.0, "GROSS": 0.0, "DEDUCTION": 0.0, "NET": 0.0}
    }
    
    # Execute in strict ascending sequence
    sorted_rules = sorted(structure.rules, key=lambda r: r.sequence)
    evaluated_lines = []
    
    for rule in sorted_rules:
        amount = 0.0
        if rule.computation_type == "fixed":
            amount = rule.fixed_amount
        elif rule.computation_type == "percentage":
            base_amount = context["rules"].get(rule.percentage_base_code, context["contract"].wage)
            amount = base_amount * (rule.percentage_value / 100.0)
        elif rule.computation_type == "formula":
            amount = safe_eval_formula(rule.formula_expression, context)
            
        amount = round(amount, 2)
        context["rules"][rule.code] = amount
        context["categories"][rule.category] = round(context["categories"][rule.category] + amount, 2)
        evaluated_lines.append(PayslipLine(rule_id=rule.id, rule_name=rule.name, rule_code=rule.code, category=rule.category, sequence=rule.sequence, amount=amount))
        
    gross = context["rules"].get("GROSS_AFTER_LOP", context["categories"]["BASIC"] + context["categories"]["ALLOWANCE"])
    deductions = context["rules"].get("TOTAL_STATUTORY_DEDUCTIONS", context["categories"]["DEDUCTION"])
    net = context["rules"].get("NET_SALARY", gross - deductions)
    
    return gross, deductions, net, evaluated_lines
```

### 5.2 Pre-Validation Anomaly Detection (`backend/services/validator_service.py`)
```python
def run_pre_validation_checks(payrun, payslips, db: Session):
    for slip in payslips:
        warnings = []
        emp = slip.employee
        
        # 1. Missing Bank Credentials
        if not emp.bank_account_no or not emp.ifsc_swift:
            warnings.append("⚠️ Missing bank account number or SWIFT/IFSC routing details.")
            
        # 2. True Duplicate Overlapping Payslips
        overlapping_slips = db.query(Payslip).join(Payrun).filter(
            Payslip.employee_id == emp.id,
            Payslip.id != slip.id,
            Payrun.start_date <= payrun.end_date,
            Payrun.end_date >= payrun.start_date,
            Payslip.status.in_(['Validated', 'Paid'])
        ).all()
        if overlapping_slips:
            warnings.append("⚠️ Duplicate payslip detected for employee in an overlapping payrun period.")
            
        # 3. Missing Applicable Contract
        if not slip.contract:
            warnings.append("⚠️ No valid contract found covering this pay period.")
            
        # 4. Zero Worked Days
        if slip.worked_days == 0:
            warnings.append("⚠️ Zero worked days logged during this pay period.")
            
        # 5. Unresolved Attendance Exceptions
        unresolved_att = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.date >= payrun.start_date,
            Attendance.date <= payrun.end_date,
            Attendance.status == 'Missing_Checkout'
        ).count()
        if unresolved_att > 0:
            warnings.append(f"⚠️ {unresolved_att} unresolved missing checkout attendance entries.")
            
        slip.warnings_json = json.dumps(warnings)
```

---

## 6. RESTful API Route Directory

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `POST` | `/api/auth/switch-persona` | Public/Demo | Instant role swapper for testing |
| `GET` | `/api/me/profile` | `Employee` | Personal profile & assigned schedule |
| `POST` | `/api/me/attendance/punch` | `Employee` | Check-in / Check-out clock |
| `GET` | `/api/me/leaves` | `Employee` | Personal allocations & leave requests |
| `POST` | `/api/me/leaves/request` | `Employee` | Submit new time-off request |
| `GET` | `/api/me/pre-payroll-statement` | `Employee` | Operational attendance statement (Zero salary disclosure) |
| `POST` | `/api/me/grievance/submit` | `Employee` | Raise dispute on pre-payroll statement |
| `GET` | `/api/me/payslips` | `Employee` | View/download own finalized PDF payslips |
| `GET/POST`| `/api/employees` | `HR_Manager` | Master employee directory |
| `GET/PUT` | `/api/employees/{id}` | `HR_Manager` | Employee form + **5 Smart Counts** |
| `GET/POST`| `/api/contracts` | `HR_Manager` | Contract list & creation with period matching |
| `GET/POST`| `/api/schedules` | `HR_Manager` | Working schedules (09:00-18:00 = 40h/week) |
| `GET/POST`| `/api/time-off/allocations` | `HR_Manager` | Quota allocation ledger |
| `PUT` | `/api/time-off/requests/{id}/action` | `HR_Manager` | 1-click Approve / Refuse request |
| `PUT` | `/api/attendance/{id}/correct` | `HR_Manager` | Audited manual correction |
| `GET` | `/api/payslips` | `HR_Payroll_User`| **Dedicated Global Payslips List View** |
| `GET` | `/api/payruns/eligible-candidates` | `HR_Payroll_User`| Step 2 Scope & Candidate query |
| `POST` | `/api/payruns/create-batch` | `HR_Payroll_User`| Create payrun batch with selected staff |
| `POST` | `/api/payruns/{id}/compute` | `HR_Payroll_User`| Batch calculation & anomaly detection |
| `POST` | `/api/payruns/{id}/send-pre-verification`| `HR_Payroll_User`| Publish operational statements |
| `POST` | `/api/payruns/{id}/resolve-grievance` | `HR_Payroll_User`| Accept & adjust or reject grievance |
| `POST` | `/api/payruns/{id}/validate` | `HR_Payroll_User`| Validate and lock payrun batch |
| `POST` | `/api/payruns/{id}/mark-paid` | `HR_Payroll_User`| Mark Paid, generate PDF payslips |
| `POST` | `/api/payruns/{id}/send-payslips` | `HR_Payroll_User`| Real SMTP & Outbox bulk email dispatch |
| `GET` | `/api/salary-structures` | `HR_Payroll_User` (R) / `HR_Payroll_Manager` (CRUD)| Structures & rule list |
| `POST/PUT/DEL`| `/api/salary-rules` | `HR_Payroll_Manager` | Configure sequence & formulas |
| `GET` | `/api/dashboard/kpis` | `HR_Payroll_User`| **5 Required KPIs + 7 Attendance Metrics** |

---

## 7. Automated Verification & Quality Assurance Suite

1. **Salary Calculation Suite (`test_salary_engine.py`):**
   - Assert Sequenced Salary Rule Engine order ($\text{BASIC} \rightarrow \text{HRA} \rightarrow \text{GROSS\_BEFORE\_LOP} \rightarrow \text{LOP} \rightarrow \text{GROSS\_AFTER\_LOP} \rightarrow \text{PF} \rightarrow \text{TAX} \rightarrow \text{NET}$).
   - Validate that LOP deduction is NOT double-counted.
2. **Contract Period Matching Suite (`test_contract_matching.py`):**
   - Test date validity matching for historical expired contracts, active current contracts, indefinite contracts, and mid-period promotions.
   - Assert database rejection of overlapping active contracts for the same employee.
3. **RBAC Endpoint Isolation Suite (`test_rbac.py`):**
   - Assert `403 Forbidden` for Employee accessing `/api/payruns` or `/api/payslips` (global).
   - Assert `403 Forbidden` for HR Manager accessing `/api/payruns` or `/api/salary-rules`.
   - Assert `403 Forbidden` for HR Payroll User attempting `POST /api/salary-rules`.
4. **Duplicate Payslip & Warning Suite (`test_warnings.py`):**
   - Test detection of true overlapping date periods across payrun batches.
   - Test separation of zero worked days vs missing checkout warnings.
