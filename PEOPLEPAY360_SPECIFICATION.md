# PeoplePay360: HR & Payroll Operations Platform
# Master Enterprise Functional, Technical & Presentation Blueprint

```
====================================================================================================
  DOCUMENT CONTROL & SYSTEM METADATA
====================================================================================================
  Project Name       : PeoplePay360 (Integrated HR & Payroll Operations Platform)
  Document Type      : Canonical Domain Specification, Architecture Blueprint & Presentation Guide
  Document Version   : 3.2.0-ULTIMATE-ENTERPRISE-SPEC
  Target Platform    : Web Application (FastAPI + React 18 + TypeScript + TailwindCSS + SQLite)
  Design System      : Odoo-Style Operational Modular Architecture with Strict Workflows
====================================================================================================
```

---

## Master Table of Contents
1. [Executive Summary & Core Value Proposition](#1-executive-summary--core-value-proposition)
2. [Granular Role-Based Access Control (RBAC) & Security Boundaries](#2-granular-role-based-access-control-rbac--security-boundaries)
3. [Master Data & HR Backend Configurations (A1 – A7)](#3-master-data--hr-backend-configurations-a1--a7)
   - [A1. Employee Master Management (Views, Fields & 5 Smart Buttons)](#a1-employee-master-management)
   - [A2. Contract Management & Historical Period Resolution](#a2-contract-management)
   - [A3. Working Schedule Setup & Auto-Hours Engine](#a3-working-schedule-setup)
   - [A4. Time Off Types & Quota Allocation Ledger](#a4-time-off-types--quota-allocations)
   - [A5. Salary Structures Container Configuration](#a5-salary-structures)
   - [A6. Sequenced Salary Rule Engine & Safe Formula Sandbox](#a6-sequenced-salary-rules)
   - [A7. Reporting & Live Transactional Aggregation Configuration](#a7-reporting-aggregation)
4. [HR & Payroll Operational Frontend (B1 – B9)](#4-hr--payroll-operational-frontend-b1--b9)
   - [B1. Main Navigation, Layout & Persona Switcher](#b1-main-navigation)
   - [B2. Employee Form Hub & 5 Interactive Smart Buttons](#b2-employee-hub-smart-buttons)
   - [B3. Attendance Management & Audited Correction Modal](#b3-attendance-management)
   - [B4. Time Off Requests List & Approval Workflow](#b4-time-off-requests)
   - [B5. Two-Step Payrun Creation Wizard](#b5-two-step-payrun-wizard)
   - [B6. Payrun Processing Control Center, Warnings & Excel/CSV Exports](#b6-payrun-control-center)
   - [B6.1. Pre-Payroll Verification & Grievance Resolution Lifecycle](#b61-pre-payroll-verification--grievance)
   - [B7. Dedicated Global Payslips List, Breakdown Modal & Excel/CSV Export](#b7-dedicated-global-payslips)
   - [B8. Printable PDF Payslip Generator & Dual-Mode Email Engine](#b8-pdf-payslips--email-engine)
   - [B9. Centralized Executive Payroll Dashboard (5 Required KPIs + Full Attendance Overview)](#b9-executive-payroll-dashboard)
5. [HR Financial Data Export Engine (Excel & CSV Specifications)](#5-hr-financial-data-export-engine-excel--csv-specifications)
6. [Complete Visual UI Screen Wireframes & Component Mockups](#6-complete-visual-ui-screen-wireframes--component-mockups)
7. [Step-by-Step Data Flow Traces with Worked Numerical Examples](#7-step-by-step-data-flow-traces-with-worked-numerical-examples)
8. [Complete End-to-End Operational Lifecycle (10-Step Connected Flow)](#8-complete-end-to-end-operational-lifecycle-10-step-flow)
9. [Calculation Algorithms & Mathematical Engine Specifications](#9-calculation-algorithms--mathematical-engine-specifications)
10. [Complete SQL Schema DDL (17 Tables & Data Dictionary)](#10-complete-sql-schema-ddl)
11. [Complete RESTful API Contract (JSON Request & Response Schemas)](#11-complete-restful-api-contract)
12. [Edge Cases, Security Vulnerabilities & Exception Handling Matrix](#12-edge-cases-security-vulnerabilities--exception-handling-matrix)
13. [Pre-Seeded Enterprise Dataset & 5 Live Demo Persona Scripts](#13-pre-seeded-enterprise-dataset--demo-personas)
14. [Hackathon Pitch & Presentation Narrative (Slide-by-Slide Guide)](#14-hackathon-pitch--presentation-narrative-slide-by-slide-guide)

---

# 1. Executive Summary & Core Value Proposition

### 1.1 The Operational Problem in Modern Enterprises
Traditional human resource tools manage employee profiles, working schedules, attendance punch logs, leave balances, and payroll calculations in isolated silos. When records are disconnected:
- **Contract Temporal Desynchronization:** An employee may have historical contracts reflecting probation, promotions, or wage revisions. If payroll does not resolve the single contract applicable to the selected payroll period based on date validity, past payroll runs cannot be audited accurately and future payroll fails to reflect applicable terms.
- **Attendance & Schedule Mismatch:** Attendance logs record timestamps without cross-referencing assigned working schedule templates, preventing automatic detection of late arrivals, missing checkouts, or unapproved overtime.
- **Leave Balance Leakage:** Employees take leaves that are not deducted from approved allocation quotas, or unpaid leaves (Loss of Pay) fail to trigger exact prorated wage deductions during payroll batch computation.
- **Opaque Payroll Finalization:** Payroll administrators run batches blindly without automated pre-validation checks for missing bank account numbers, duplicate overlapping payslips, or unresolved attendance exceptions.
- **Employee Disempowerment:** Employees receive finalized payslips with unexplained deductions without having had any opportunity to review their operational attendance and leave records prior to salary processing.

### 1.2 The PeoplePay360 Solution
**PeoplePay360** eliminates administrative silos by establishing a unified, reactive operational pipeline:
1. **Centralized Employee Hub:** The Employee Form acts as the operational anchor linking **Contracts**, **Attendance**, **Time Off**, **Allocations**, and **Payslips** via **5 live interactive smart-button counters**.
2. **Date-Based Contract Resolution:** Resolves the **single contract applicable to the selected payroll period** by date validity ($S_{contract} \le E_{period} \text{ and } (E_{contract} \ge S_{period} \text{ or null})$), ensuring historical pay periods accurately use historical expired contracts while current/future payroll runs use active terms, while strictly prohibiting overlapping active contracts.
3. **Sequenced Salary Rule Engine:** Supports multi-tier salary calculations (Basic, Allowances, Gross Before LOP, LOP Deduction, Gross After LOP, Deductions, Net) executing in strict sequence using fixed amounts, percentage rates, and dynamic formulas without double-counting deductions.
4. **Two-Step Payrun Creation Wizard:** Enforces a structured two-step workflow (Step 1: Scope, Period & Salary Structure $\rightarrow$ Step 2: Explicit candidate filtering and selection) with pre-validation anomaly detection.
5. **Pre-Payroll Operational Verification (Zero Salary Disclosure):** Distributes an attendance and leave statement (strictly operational metrics, zero financial disclosure) to employees for confirmation or grievance submission prior to payroll lock.
6. **HR Financial Export Center:** Provides 1-click **Excel (.xlsx) and CSV exports** for batch payroll registers, bank disbursement files, global payslip summaries, and attendance records.
7. **Delivery & Executive Analytics:** Generates professional printable PDF payslips, real SMTP / Outbox bulk email delivery, and renders live transactional KPI dashboards with 5 required core metrics and full attendance metrics.

---

# 2. Granular Role-Based Access Control (RBAC) & Security Boundaries

The application enforces a **Strict 5-Tier RBAC Matrix** across both API endpoints (JWT verification + route decorators + row-level SQL filters) and the React Frontend (conditional menu rendering, route protection, and action button disabling).

```
+----------------------------------------------------------------------------------------------------+
|                                    RBAC ACCESS PERMISSIONS MATRIX                                  |
+----------------------------------------------------------------------------------------------------+
| Module / Action              | Employee    | HR Manager   | HR Payroll User | HR Payroll Mgr | Admin |
+------------------------------+-------------+--------------+-----------------+----------------+-------+
| My Profile, Punch & Leaves   | View/Log    | View/Log     | View/Log        | View/Log       | Full  |
| Self Payslips Download (PDF) | View/Download| ❌ Hidden   | View/Download   | View/Download  | Full  |
| Employee Master Records      | Blocked     | Full CRUD    | Full CRUD       | Full CRUD      | Full  |
| Contract Management          | Blocked     | Full CRUD    | Full CRUD       | Full CRUD      | Full  |
| Working Schedule Setup       | View Own    | Full CRUD    | Full CRUD       | Full CRUD      | Full  |
| Time Off Types & Allocations | View Own    | Full CRUD    | Full CRUD       | Full CRUD      | Full  |
| Time Off Approval / Refusal  | Blocked     | Full Control | Full Control    | Full Control   | Full  |
| Attendance Manual Edits      | Blocked     | Full Control | Full Control    | Full Control   | Full  |
| Dedicated Global Payslips    | Blocked     | Blocked      | Read / View All | Full CRUD      | Full  |
| Export Payroll (Excel / CSV) | Blocked     | Blocked      | Full Export     | Full Export    | Full  |
| Payrun Batch Execution       | Blocked     | Blocked      | Create/Read/Upd | Full CRUD      | Full  |
| Pre-Payroll Verification     | Sign/Dispute| Blocked      | Resolve Dispute | Resolve Dispute| Full  |
| Salary Structures & Rules    | Blocked     | Blocked      | Read-Only       | Full CRUD      | Full  |
| User Admin & Role Switcher   | Blocked     | Blocked      | Blocked         | Blocked        | Full  |
+----------------------------------------------------------------------------------------------------+
```

---

# 3. Master Data & HR Backend Configurations (A1 – A7)

### A1. Employee Master Management (5 Smart Buttons)
- **Kanban View:** Visual cards showing avatar, name, job title, department tag, email link, and status badge.
- **List View:** Columns: Avatar (36px circular), Employee Name, Work Email, Department badge, Job Position, Manager name, Working Schedule, Employment Type (`Full-Time`, `Part-Time`, `Contractor`), Status pill, Actions (`Edit`, `View Hub`).
- **5 Smart-Badge Buttons on Form Hub:**
  1. 📄 **Contracts `[N]`** $\rightarrow$ opens `/contracts?employee_id=X`.
  2. ⏱️ **Attendance `[N]`** $\rightarrow$ opens `/attendance?employee_id=X`.
  3. 🏖️ **Time Off `[N]`** $\rightarrow$ opens `/time-off?employee_id=X`.
  4. 📊 **Allocations `[N.0 Days]`** $\rightarrow$ opens `/time-off/allocations?employee_id=X`.
  5. 💰 **Payslips `[N]`** $\rightarrow$ opens `/payslips?employee_id=X` (shows all generated for HR, finalized/paid only for employee).
- **Form Tabs:** Work Info, Personal Info, Bank Credentials (Bank Name, Account No, IFSC/SWIFT), HR Settings (User link, Status).

### A2. Contract Management & Historical Period Resolution
- **List View:** Columns: Contract Reference, Employee Name, Department (derived), Job Position (derived), Start Date, End Date (`YYYY-MM-DD` or `Indefinite`), Base Wage (`$#,##0.00`), Salary Structure, Working Schedule, Status (`Active`, `Draft`, `Expired`, `Terminated`), Actions (`Edit`, `Renew`, `Terminate`).
- **Date-Based Resolution Algorithm:** Resolves the **single contract applicable to the selected payroll period** by date overlap ($S_{contract} \le E_{period} \text{ and } (E_{contract} \ge S_{period} \text{ or null})$), ensuring historical expired contracts drive past pay periods while active contracts drive current/future runs. Overlapping active contracts are strictly prohibited.

### A3. Working Schedule Setup & Auto-Hours Engine
- **List View:** Columns: Schedule Name, Total Weekly Hours (auto-derived), Assigned Employees Count, Work Days Pattern Summary (`Mon - Fri, 09:00 - 18:00`).
- **Standard 40h/week Pattern:** Monday to Friday, **09:00 to 18:00** with **1.0 hour break** = $8.0\text{ net hrs/day} \times 5 = \mathbf{40.0\text{ hrs/week}}$ auto-derived banner.

### A4. Time Off Types & Quota Allocation Ledger
- **Types:** Unit (`Days` / `Hours`), Requires Allocation (`Yes` / `No`), Payroll Integration (`Paid` / `Unpaid`), Color Badge.
- **Allocation Ledger:** Columns: Employee, Leave Type, Allocated Quota (`20.0 Days`), Approved Taken (`3.0 Days`), Pending Requests (`1.0 Day`), **Remaining Balance** (`17.0 Days` derived as $\text{Allocated} - \text{Approved Taken}$), Validity Range, Status (`Draft`, `Approved`, `Refused`), Actions (**Approve** / **Refuse**).

### A5. Salary Structures Container Configuration
- Columns: Structure Name, Code, Associated Rules Count, Assigned Contracts Count, Active Status Badge (`Active` / `Inactive`), Actions (`Edit`, `Duplicate`).

### A6. Sequenced Salary Rule Engine & Safe Formula Sandbox
- Sequenced Rules Form: Rule Name, Code, Category (`BASIC`, `ALLOWANCE`, `GROSS`, `DEDUCTION`, `NET`), Sequence (`10, 20, 30...`), Computation Method (`Fixed`, `Percentage`, `Formula`), Live Formula Sandbox Tester.

### A7. Reporting & Live Transactional Aggregation Configuration
- Dynamic transactional aggregation across `period_start`, `period_end`, `department_id`, and `employee_type`.

---

# 4. HR & Payroll Operational Frontend (B1 – B9)

### B1. Main Navigation, Layout & Persona Switcher
- Top navigation tabs with role-based visibility: `Employees`, `Contracts`, `Attendance`, `Time Off`, `Payroll`, `Payslips`, `Dashboard`.
- Persistent Persona Switcher Toolbar for 1-click role swapping during live demonstration.

### B2. Employee Form Hub & 5 Interactive Smart Buttons
- Featuring 5 smart buttons: 📄 Contracts, ⏱️ Attendance, 🏖️ Time Off, 📊 Allocations, 💰 Payslips.

### B3. Attendance Management & Audited Correction Modal
- Daily clock punch widget (Check In / Check Out).
- Stored record statuses in DB: `Present`, `Late`, `Missing_Checkout`, `Excused`.
- Derived reporting metrics: `Absent` and `Overtime`.
- Audited manual correction modal storing `is_manual_correction = TRUE`, `correction_notes`, user ID, and timestamp.

### B4. Time Off Requests List & Approval Workflow
- Explicit Columns: `Employee Name`, `Leave Type`, `Dates` (Start to End), `Duration` (Days), `Reason`, `Status` (`Draft`, `Submitted`, `Approved`, `Refused`), Action buttons (**Approve** / **Refuse**).

### B5. Two-Step Payrun Creation Wizard
- **Step 1:** Scope (Company/Department/Employee Type) + Period Range + Salary Structure.
- **Step 2:** Explicit candidate selection table with wage preview and checkboxes.

### B6. Payrun Processing Control Center, Warnings & Excel/CSV Exports
- Control Center Header: `Run Name`, `Structure`, `Period`, `Status`, `Total Net Amount`, `Warnings Count Badge`.
- Primary Actions: ⚡ **Compute**, 📬 **Send Pre-Payroll Stmt**, 🛡️ **Validate**, 💳 **Mark Paid**, ✉️ **Send Payslips**, 📊 **Export Excel / CSV**, 🏦 **Export Bank File**.
- 5 Automated Pre-Validation Anomaly Warnings: Missing Bank Credentials, True Duplicate Overlapping Payslips ($S_1 \le E_2 \text{ and } E_1 \ge S_2$), Zero Worked Days, Unresolved Attendance Exceptions, Missing Applicable Contract.

### B6.1. Pre-Payroll Verification & Grievance Lifecycle
- Operational Statement published to employee portal (Scheduled Days: 22, Present Days: 20, Paid Leaves: 1.0, Unpaid Absences: 1.0, Overtime: 2.5 hrs) with **Zero Salary Disclosure**.
- Employee Action: **Confirm Statement** $\rightarrow$ `Confirmed`, or **Raise Grievance** (Dispute category + remarks) $\rightarrow$ `Disputed`.
- HR Resolution Center: **Accept & Adjust** (auto-recalculates draft payslip) or **Reject with Explanation**.

### B7. Dedicated Global Payslips List, Breakdown Modal & Excel/CSV Export
- Dedicated Global Payslips Page (`/payslips`): Columns for ID, Employee Name, Parent Payrun, Period, Salary Structure, Gross Pay, Deductions, Net Pay, Verification Status, Payout Status, Actions (`View Breakdown`, `Download PDF`).
- **Export Toolbar:** `Export Selected (Excel / CSV)`, `Export All Filtered (Excel / CSV)`.

### B8. Printable PDF Payslip Generator & Dual-Mode Email Engine
- Publication-ready PDF payslip with company header, employee details, earnings and deductions tables, and bold net salary.
- Dual-Mode Email Engine: Real SMTP when configured, with an **In-App Outbox Viewer Modal** as a deterministic offline/demo fallback.

### B9. Executive Payroll Dashboard (5 Required KPIs + Full Attendance Overview)
- **5 Required Core KPI Cards:** Total Net Salary Paid, Payslips Generated (with Draft/Validated/Paid breakdown), Average Salary, Approved Time Off, Attendance Health Score.
- **Full Attendance Overview (7 Metrics):** Present, Late, Absent, Overtime, Missing Checkouts, Manual Edits, Attendance Coverage %.
- **Recharts Visualizations:** Salary by Department (Donut), Monthly Net Trend vs Headcount (Line/Area), Attendance Status (Bar).
- **Global Filter Bar:** Live slicing by `period_start`, `period_end`, `department_id`, and `employee_type`.

---

# 5. HR Financial Data Export Engine (Excel & CSV Specifications)

PeoplePay360 provides a complete suite of **Excel (.xlsx) and CSV export endpoints** for HR and payroll accounting workflows.

```
+----------------------------------------------------------------------------------------------------+
|                                HR FINANCIAL DATA EXPORT SUITE                                      |
+----------------------------------------------------------------------------------------------------+
|  [ 1. Payrun Payroll Register (Excel/CSV) ] -> Full breakdown of Basic, Allowances, Deduct, Net.  |
|  [ 2. Bank Disbursement Batch File (CSV) ]  -> Bank transfer file: Emp Name, Account, IFSC, Net.   |
|  [ 3. Global Payslips Summary (Excel/CSV) ] -> Filtered multi-period audit register.               |
|  [ 4. Monthly Attendance Log (Excel/CSV)  ] -> Employee punch times, worked hours, exceptions.     |
|  [ 5. Leave Quota & Balance Ledger (Excel)] -> Allocations, approved taken, remaining balances.    |
+----------------------------------------------------------------------------------------------------+
```

### 5.1 Export 1: Payrun Payroll Register (`GET /api/payruns/{id}/export-excel` & `.../export-csv`)
- **Columns Included in Output:**
  1. `Payrun Reference` (e.g. `PAY/2026/09/01`)
  2. `Employee ID`
  3. `Employee Name`
  4. `Department`
  5. `Job Position`
  6. `Applicable Contract Wage`
  7. `Scheduled Working Days`
  8. `Actual Present Days`
  9. `Unpaid Leave Days (LOP)`
  10. `Basic Earnings ($)`
  11. `House Rent Allowance ($)`
  12. `Conveyance Allowance ($)`
  13. `Gross Salary Before LOP ($)`
  14. `Loss of Pay Deduction ($)`
  15. `Gross Salary After LOP ($)`
  16. `Provident Fund (PF) ($)`
  17. `Income Tax / TDS ($)`
  18. `Total Statutory Deductions ($)`
  19. `Net Salary Payable ($)`
  20. `Disbursement Bank Name`
  21. `Bank Account Number`
  22. `IFSC / SWIFT Code`
  23. `Payout Status` (`Draft`, `Validated`, `Paid`)
  24. `Employee Verification Status` (`Confirmed`, `Disputed`)

### 5.2 Export 2: Bank Direct Disbursement File (`GET /api/payruns/{id}/export-bank-csv`)
- Standard bank automated clearing house (ACH / NEFT / Direct Credit) formatted CSV:
  ```csv
  Beneficiary Name,Bank Name,Account Number,IFSC/SWIFT,Net Amount,Payment Reference,Remarks
  Alex Rivera,JPMorgan Chase,1029384756,CHASUS33XXX,7324.09,SAL-2026-09-ALEX,Sept 2026 Salary
  Sarah Jenkins,Bank of America,9876543210,BOFAUS3NXXX,6084.00,SAL-2026-09-SARAH,Sept 2026 Salary
  David Chen,Wells Fargo,5544332211,WFBIUS6SXXX,5616.00,SAL-2026-09-DAVID,Sept 2026 Salary
  Elena Rostova,Citibank,4433221100,CITIUS33XXX,8775.00,SAL-2026-09-ELENA,Sept 2026 Salary
  ```

---

# 6. Complete Visual UI Screen Wireframes & Component Mockups

```
+====================================================================================================+
| 1. GLOBAL NAVIGATION & PERSONA SWITCHER HEADER                                                     |
+====================================================================================================+
| [Logo] PeoplePay360 | 👥 Employees  📄 Contracts  ⏱️ Attendance  🏖️ Time Off  💰 Payroll  📑 Payslips |
| -------------------------------------------------------------------------------------------------- |
| ⚡ DEMO PERSONAS: [👤 Alex (Emp)] [👔 Sarah (HR Mgr)] [📑 David (Payroll)] [👑 Elena (Admin)]      |
+====================================================================================================+

+====================================================================================================+
| 2. EMPLOYEE MASTER HUB (Form View with 5 Smart Buttons)                                            |
+====================================================================================================+
|  [Avatar]  ALEX RIVERA  •  Senior Frontend Engineer  •  [Status: ACTIVE]                           |
|  ------------------------------------------------------------------------------------------------  |
|  SMART BUTTONS:                                                                                    |
|  [ 📄 2 Contracts ] [ ⏱️ 142 Attendances ] [ 🏖️ 3 Requests ] [ 📊 20.0 Alloc Days ] [ 💰 12 Slips ]|
|  ------------------------------------------------------------------------------------------------  |
|  [Tab: Work Info]       [Tab: Personal Info]       [Tab: Bank & Payroll]    [Tab: HR Settings]     |
|  Department : Engineering               Work Email  : alex.rivera@company.com                      |
|  Job Title  : Senior Frontend Engineer  Work Phone  : +1 (555) 234-5678                            |
|  Manager    : Marcus Vance              Schedule    : Standard 40h/week (Mon-Fri 09:00-18:00)      |
+====================================================================================================+

+====================================================================================================+
| 3. TWO-STEP PAYRUN WIZARD (Step 1: Scope & Period -> Step 2: Candidate Selection)                  |
+====================================================================================================+
|  STEP 1: DEFINE SCOPE & PERIOD                                                                     |
|  Batch Name: [ September 2026 Regular Payroll ]  Period: [ 2026-09-01 ] to [ 2026-09-30 ]          |
|  Structure : [ Standard Regular Salary Structure v ]  Dept: [ All Departments v ]                  |
|  ------------------------------------------------------------------------------------------------  |
|  STEP 2: ELIGIBLE CANDIDATE SELECTION                                                              |
|  [x] Select All (12 Eligible Staff)                                                                |
|  [x] Alex Rivera    • Engineering • Contract: CNT-2026-ALEX ($6,500.00/mo) • Valid ✅              |
|  [x] Sarah Jenkins  • HR          • Contract: CNT-2026-SARAH ($5,200.00/mo) • Valid ✅              |
|  [ ] Jordan Taylor  • Operations  • ⚠️ Warning: Missing Bank Account Credentials                  |
|  [ Create Payrun Batch (11 Selected) ]                                                             |
+====================================================================================================+

+====================================================================================================+
| 4. PAYRUN PROCESSING CONTROL CENTER & EXPORT TOOLBAR                                               |
+====================================================================================================+
|  Payrun: September 2026 Regular  •  Status: [ COMPUTED ]  •  Net Total: $79,480.25                |
|  Actions: [ ⚡ Compute ] [ 📬 Send Pre-Statement ] [ 🛡️ Validate ] [ 💳 Mark Paid ] [ ✉️ Email ]  |
|  Exports: [ 📊 Export Register (Excel) ]  [ 📄 Export CSV ]  [ 🏦 Export Bank Disbursement CSV ]   |
|  ------------------------------------------------------------------------------------------------  |
|  WARNINGS (2):                                                                                     |
|  ⚠️ Jordan Taylor: Missing Bank Account number and SWIFT code.                                     |
|  ⚠️ Marcus Vance: Duplicate payslip detected in overlapping pay period.                            |
|  ------------------------------------------------------------------------------------------------  |
|  PAYSLIPS SUMMARY TABLE:                                                                           |
|  Employee     | Base Wage | Worked Days | LOP Days | Gross Pay  | Deductions | Net Pay   | Status |
|  -------------+-----------+-------------+----------+------------+------------+-----------+--------|
|  Alex Rivera  | $6,500.00 | 20.0 Days   | 1.0 Day  | $9,004.55  | $1,680.46  | $7,324.09 | Confirmed|
+====================================================================================================+

+====================================================================================================+
| 5. PRE-PAYROLL OPERATIONAL STATEMENT & GRIEVANCE RESOLUTION                                        |
+====================================================================================================+
|  EMPLOYEE PORTAL VIEW (Zero Salary Disclosure):                                                   |
|  Pre-Payroll Attendance & Leave Summary (September 2026):                                          |
|  • Scheduled Business Days : 22 Days (176.0 Scheduled Hours)                                       |
|  • Actual Clocked Days     : 20 Days (160.0 Actual Clocked Hours)                                  |
|  • Approved Paid Leaves    : 1.0 Day (Paid Annual Leave)                                           |
|  • Unpaid Absences (LOP)   : 1.0 Day (Recorded Sept 18)                                            |
|  • Overtime Hours          : 2.5 Hours                                                             |
|  Actions: [ ✅ Confirm Record ]  [ ⚠️ Raise Grievance / Dispute ]                                  |
+====================================================================================================+
```

---

# 7. Step-by-Step Data Flow Traces with Worked Numerical Examples

### Scenario: Alex Rivera (September 2026 Payroll Execution)
- **Employee:** Alex Rivera (Senior Frontend Engineer, Engineering Dept).
- **Assigned Schedule:** Standard 40h/week (Mon–Fri 09:00–18:00 with 1.0 hr break).
- **Active Contract:** `CNT-2026-ALEX-01` (Base Wage: **\$6,500.00 / month**).
- **Payrun Period:** September 01, 2026 to September 30, 2026 (Total Business Days = **22 Days**).
- **Attendance Records:** Clocked in for 20 days (160.0 hours), 0 missing checkouts, 2.5 overtime hours.
- **Leave Records:** 1 Day Approved Paid Annual Leave, **1 Day Approved Unpaid Leave (Loss of Pay)**.

#### Step-by-Step Sequenced Rule Calculations:
1. `[Seq 10] BASIC` $\rightarrow \text{contract.wage} = \mathbf{\$6,500.00}$
2. `[Seq 20] HRA` $\rightarrow 0.40 \times \text{rules.BASIC} = 0.40 \times 6500 = \mathbf{\$2,600.00}$
3. `[Seq 30] CONVEYANCE` $\rightarrow \mathbf{\$200.00} \text{ (Fixed Allowance)}$
4. `[Seq 40] GROSS_BEFORE_LOP` $\rightarrow \text{BASIC} + \text{HRA} + \text{CONVEYANCE} = 6500 + 2600 + 200 = \mathbf{\$9,300.00}$
5. `[Seq 50] LOP_DEDUCTION` $\rightarrow (\text{rules.BASIC} / 22) \times 1 = (6500 / 22) \times 1 = \mathbf{\$295.45}$
6. `[Seq 60] GROSS_AFTER_LOP` $\rightarrow \text{GROSS\_BEFORE\_LOP} - \text{LOP\_DEDUCTION} = 9300 - 295.45 = \mathbf{\$9,004.55}$
7. `[Seq 70] PF_DEDUCTION` $\rightarrow 0.12 \times \text{rules.BASIC} = 0.12 \times 6500 = \mathbf{\$780.00}$
8. `[Seq 80] TAX_DEDUCTION` $\rightarrow 0.10 \times \text{rules.GROSS\_AFTER\_LOP} = 0.10 \times 9004.55 = \mathbf{\$900.46}$
9. `[Seq 90] TOTAL_STATUTORY_DEDUCTIONS` $\rightarrow \text{PF\_DEDUCTION} + \text{TAX\_DEDUCTION} = 780.00 + 900.46 = \mathbf{\$1,680.46}$
10. `[Seq 100] NET_SALARY` $\rightarrow \text{GROSS\_AFTER\_LOP} - \text{TOTAL\_STATUTORY_DEDUCTIONS} = 9004.55 - 1680.46 = \mathbf{\$7,324.09}$

*(Verification Check: $\text{Gross Before LOP (\$9,300.00)} - \text{Total All Deductions (\$295.45 + \$780.00 + \$900.46 = \$1,975.91)} = \mathbf{\$7,324.09}$. Zero double-counting).*

---

# 8. Complete End-to-End Operational Lifecycle (10-Step Flow)

1. **Employee Master Setup:** HR Manager onboards developer (Alex Rivera) via Kanban/Form view.
2. **Contract Creation:** HR assigns `$6,500/mo` contract linked to Standard Regular Structure.
3. **Schedule Assignment:** HR assigns Standard 40h/week schedule (`09:00 - 18:00` with 1h break).
4. **Attendance Logging:** Alex logs daily check-ins/outs; exception engine monitors punctuality.
5. **Time Off Allocation & Consumption:** HR allocates 20 days; Alex takes 1 day Paid and 1 day Unpaid (LOP).
6. **Salary Rule Sequencing:** Payroll admin configures sequenced rules (`BASIC` $\rightarrow$ `HRA` $\rightarrow$ `GROSS` $\rightarrow$ `DEDUCTIONS` $\rightarrow$ `NET`).
7. **Two-Step Payrun Wizard:** HR Payroll user defines scope (Step 1) and selects Alex & team (Step 2).
8. **Batch Computation & Anomaly Detection:** Engine computes draft payslips and flags 1-day LOP wage deduction.
9. **Pre-Payroll Verification Loop:** Employee reviews operational statement (zero salary shown) $\rightarrow$ Alex confirms OR raises grievance $\rightarrow$ HR accepts correction in Resolution Center $\rightarrow$ System auto-recalculates draft payslip.
10. **Final Payout, PDF Generation & Delivery:** HR validates batch, marks Paid, generates PDF payslips, dispatches bulk emails, exports Excel/CSV registers, and updates live dashboard.

---

# 9. Calculation Algorithms & Mathematical Engine Specifications

### 9.1 Weekly Standard Working Hours
$$\text{NetDayHours}_i = (\text{EndTime}_i - \text{StartTime}_i) - \text{BreakHours}_i$$
$$\text{TotalWeeklyHours} = \sum_{i \in \text{Workdays}} \text{NetDayHours}_i = 5 \times 8.0 = \mathbf{40.0\text{ Hours/Week}}$$

### 9.2 Leave Balance Equation
$$\text{RemainingBalance} = \text{AllocatedDays} - \sum \text{ApprovedTakenDays}$$
*(Pending Requests are tracked separately as $\sum \text{PendingRequestDays}$).*

### 9.3 Unpaid Leave (Loss of Pay) Pro-Rata Wage Deduction
$$\text{DailyWageRate} = \frac{\text{Contract.Wage}}{\text{TotalWorkingDaysInPeriod}} = \frac{\$6,500.00}{22} = \$295.4545$$
$$\text{LOP\_DEDUCTION} = \$295.4545 \times 1 = \mathbf{\$295.45}$$

### 9.4 Attendance Health Index
$$\text{HealthScore} = \max\left(0\%, \left(1.0 - \frac{\text{LateCount} + (2 \times \text{MissingCheckouts}) + \text{UnexcusedAbsences}}{\text{TotalExpectedShifts}}\right) \times 100\%\right)$$

---

# 10. Complete SQL Schema DDL (17 Tables & Data Dictionary)

*(Refer to Section 9 of v3.1.0 for the complete SQL schema DDL defining all 17 tables with indexes, foreign keys, and cascading rules).*

---

# 11. Complete RESTful API Contract (JSON Request & Response Schemas)

*(Refer to Section 10 of v3.1.0 for complete request and response JSON schemas across all 30+ endpoints, with the addition of export endpoints: `GET /api/payruns/{id}/export-excel`, `GET /api/payruns/{id}/export-csv`, `GET /api/payruns/{id}/export-bank-csv`, `GET /api/payslips/export-excel`).*

---

# 12. Edge Cases, Security Vulnerabilities & Exception Handling Matrix

| Scenario / Edge Case | System Behavior & Validation Guard | Error Message / UI Feedback |
| :--- | :--- | :--- |
| **Overlapping Active Contracts** | Prevented by backend before saving; checks if employee has another contract with status='Active' overlapping the date range. | `Validation Error: An active contract already exists for this employee covering the specified dates.` |
| **Insufficient Leave Quota** | Sums requested duration and checks against $\text{Allocated} - \text{Taken}$. Blocks submission. | `Validation Error: Insufficient leave balance (Requested: 5.0 Days, Available: 3.0 Days).` |
| **Duplicate Payslip in Overlapping Period** | Validator flags warning during Payrun Step 2 and batch computation. | `⚠️ Warning: Employee already has an active/paid payslip in an overlapping pay period.` |
| **Malicious Python Formula Injection** | Safe AST formula evaluator inspects syntax tree; strictly disallows `__import__`, `eval`, `exec`, and file I/O. | `Security Error: Formula contains unauthorized functions or imports.` |
| **Missing Bank Credentials** | Batch validator detects missing bank account number or SWIFT code and surfaces warning badge. | `⚠️ Warning: Missing bank account number or SWIFT/IFSC routing code.` |
| **Horizontal Privilege Escalation** | Route middleware asserts JWT role and applies row-level SQL filters. | `HTTP 403 Forbidden: You do not have permission to view this resource.` |

---

# 13. Pre-Seeded Enterprise Dataset & 5 Live Demo Persona Scripts

1. **Alex Rivera (Employee - Senior Frontend Engineer)**: `$6,500/mo`, Standard 40h/week schedule, 20 days annual leave allocation. Tests punch widget, applies for 1-day leave, reviews Pre-Payroll Statement, raises grievance on unapproved absence, downloads final PDF payslip.
2. **Sarah Jenkins (HR Manager)**: Tests employee onboarding, contract creation, shift management, leave approval, and attendance correction auditing (zero payroll visibility).
3. **David Chen (HR Payroll User)**: Tests Two-Step Payrun wizard for September 2026, computes batch payslips, inspects anomaly warnings, sends pre-payroll statements, accepts Alex's grievance, validates payrun, inspects global payslips list, exports Excel payroll register & bank CSV.
4. **Elena Rostova (HR Payroll Manager)**: Tests custom salary structure authoring, Sequenced Salary Rule formula editor, and final payout authorization.
5. **Marcus Vance (System Admin)**: Tests user provisioning, role assignments, and audit logging.

---

# 14. Hackathon Pitch & Presentation Narrative (Slide-by-Slide Guide)

```
+====================================================================================================+
| SLIDE 1: THE CORE PROBLEM (1 MINUTE)                                                               |
| • "HR and Payroll in most companies are broken into disconnected silos."                           |
| • "Manual spreadsheets cause contract mismatches, leave quota leaks, and blind payroll errors."    |
|                                                                                                    |
| SLIDE 2: THE PEOPLEPAY360 PLATFORM (1 MINUTE)                                                      |
| • "An integrated, Odoo-style operational platform unifying Employee Hub, Contracts, Schedules,    |
|   Attendance, Leave Allocations, Sequenced Salary Rules, and Two-Step Payruns."                    |
|                                                                                                    |
| SLIDE 3: LIVE DEMONSTRATION OF KEY INNOVATIONS (2.5 MINUTES)                                       |
| 1. "Watch 1-Click Persona Switching between Employee, HR Manager, and Payroll Officer."           |
| 2. "See the Two-Step Payrun Wizard detect missing bank details and duplicate payslips live."       |
| 3. "Witness the Pre-Payroll Verification loop: Employee confirms attendance with zero wage leaks,  |
|    raises a grievance, and HR adjusts it with automatic payslip recalculation."                   |
| 4. "Generate publication-grade PDF Payslips, simulate Outbox email delivery, and export Excel."   |
|                                                                                                    |
| SLIDE 4: BUSINESS IMPACT & ARCHITECTURE (0.5 MINUTES)                                              |
| • "Full RBAC compliance, transactionally live analytics, 100% audit accuracy, zero double-count." |
+====================================================================================================+
```

---

```
====================================================================================================
                             END OF MASTER SPECIFICATION BLUEPRINT
====================================================================================================
```
