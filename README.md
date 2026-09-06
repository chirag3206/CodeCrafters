# PeoplePay360: HR & Payroll Operations Platform 💼✨

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

**PeoplePay360** is an enterprise-grade, integrated HR and Payroll Operations platform built with modern web technologies. Designed with an Odoo-style operational modular architecture, PeoplePay360 seamlessly unifies employee profile management, contract lifecycles, attendance punches, leave allocations, earned leave encashments, sequenced salary rules, and two-step payrun processing.

---

## 🌟 Key Features

### 1. 👥 Unified Employee Master Hub
* **Smart-Button Dashboard**: Interactive counter badges for **Contracts**, **Attendance**, **Time Off**, **Quota Allocations**, and **Payslips**.
* **Offboarding & Final Exit Settlement**: Automated handling of employee departure, contract expiration, and unused **Earned Leave (EL / Paid Leaves)** encashment calculation added directly to final salary settlement.

### 2. 📄 Date-Based Contract Resolution
* Automatic resolution of active vs historical expired contracts based on payroll period date ranges ($S_{contract} \le E_{period} \text{ and } (E_{contract} \ge S_{period} \text{ or null})$).
* Strict prevention of overlapping active contracts.

### 3. ⏱️ Attendance & Time Off Management
* Daily check-in/check-out punch logs with punctuality status (`Present`, `Late`, `Missing Checkout`, `Excused`).
* Automatic Loss of Pay (LOP) pro-rata wage deductions for unpaid absences.
* Annual leave allocation ledger with quota tracking and carry-forward capabilities across calendar years.

### 4. 💰 Sequenced Salary Rule Engine
* Multi-tier rule engine supporting `BASIC`, `ALLOWANCE`, `GROSS`, `DEDUCTION`, and `NET` salary components.
* Configurable fixed amounts, percentage rates, and formula-based rules executing without double-counting deductions.

### 5. ⚡ Two-Step Payrun Processing Wizard
* **Step 1 (Scope & Structure)**: Select batch scope, pay period date range, and fallback salary structure.
* **Step 2 (Candidate Selection & Pre-Validation)**: Real-time candidate pre-validation surfacing warning pills (e.g., missing bank credentials, duplicate payslips, or unresolved attendance grievances). Automatically computes estimated salary (`Base + EL Encashment`) for final exit settlement candidates.

### 6. 🛡️ Pre-Payroll Operational Verification & Grievance Loop
* Publishes operational attendance/leave statements to employees (with zero wage disclosure) before payroll lock.
* Allows employees to confirm records or submit attendance grievances for HR resolution prior to payrun finalization.

### 7. 📊 Reporting, Exports & PDF Payslips
* Publication-ready PDF payslip generator with full breakdown tables.
* Dual-mode email engine (SMTP delivery with in-app Outbox fallback).
* 1-Click financial exports: Payroll Register (Excel/CSV), Bank Direct Disbursement ACH (CSV), and Attendance logs.
* Executive Dashboard with Recharts visual charts and 5 core KPIs.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) |
| **Database & ORM** | SQLite, [SQLAlchemy 2.0](https://www.sqlalchemy.org/), Alembic |
| **Data Validation** | [Pydantic V2](https://docs.pydantic.dev/) |
| **Authentication & RBAC** | OAuth2 with Password Bearer Tokens, JWT (`python-jose`), Passlib (bcrypt) |
| **Testing** | `pytest`, FastAPI `TestClient` |
| **Frontend Framework** | [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & UI** | [TailwindCSS](https://tailwindcss.com/), Lucide Icons, Modern Glassmorphism Design System |
| **Charts & Visualization** | [Recharts](https://recharts.org/) |

---

## 🔐 Role-Based Access Control (RBAC)

PeoplePay360 enforces a strict 5-Tier RBAC permission matrix:

| Action / Module | Employee | HR Manager | HR Payroll User | HR Payroll Mgr | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Self Punch & Time Off Requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Employee Master & Contracts | ❌ | ✅ | ✅ | ✅ | ✅ |
| Attendance Manual Edits & Corrections | ❌ | ✅ | ✅ | ✅ | ✅ |
| Payrun Batch Execution & Control Center | ❌ | ❌ | ✅ | ✅ | ✅ |
| Salary Structures & Sequenced Rules Editor | ❌ | ❌ | Read-Only | ✅ | ✅ |
| Pre-Payroll Verification Dispute Resolution | Confirm | ❌ | ✅ | ✅ | ✅ |
| Financial Exports (Excel / Bank CSV) | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 📁 Repository Structure

```
Finale/
├── backend/                  # FastAPI Python Backend
│   ├── main.py               # Application entry point & middleware
│   ├── models.py             # SQLAlchemy database models (17 tables)
│   ├── schemas.py            # Pydantic request & response schemas
│   ├── database.py           # Database engine & session setup
│   ├── dependencies.py       # Auth & RBAC permission dependencies
│   ├── config.py             # Environment configuration
│   ├── routes/               # Modular API endpoint handlers
│   │   ├── auth.py           # Login, JWT, persona switching
│   │   ├── employees.py      # Employee master & offboarding endpoints
│   │   ├── contracts.py      # Contract lifecycle & date resolution
│   │   ├── attendance.py     # Punch log & manual audited corrections
│   │   ├── time_off.py       # Quotas, allocations & leave requests
│   │   ├── payruns.py        # Two-Step payrun wizard & control center
│   │   ├── payslips.py       # Global payslips & PDF generation
│   │   ├── dashboard.py      # Executive KPI & attendance analytics
│   │   └── exports.py        # Excel (.xlsx) & CSV file generators
│   ├── services/             # Core business logic engines
│   │   ├── salary_engine.py  # Sequenced salary rule computation engine
│   │   ├── validator_service.py # Pre-validation anomaly inspection
│   │   ├── pdf_service.py    # ReportLab PDF payslip renderer
│   │   ├── email_service.py  # Dual-mode SMTP & outbox engine
│   │   └── export_service.py # OpenPyXL financial export service
│   └── tests/                # Automated pytest suite (22 unit tests)
├── frontend/                 # Vite + React + TypeScript App
│   ├── src/
│   │   ├── pages/            # View pages (Employees, Payrun, Dashboard, etc.)
│   │   ├── components/       # Reusable UI components & modals
│   │   ├── context/          # Auth, Theme & Persona state contexts
│   │   ├── api/              # Axios API client services
│   │   └── index.css         # TailwindCSS styles & design system
│   ├── package.json
│   └── vite.config.ts
├── PEOPLEPAY360_SPECIFICATION.md # Full master specification blueprint
└── README.md                 # Project documentation
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher
- **npm**: `9.x` or higher

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server (runs on http://localhost:8000)
uvicorn main:app --reload
```

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server (runs on http://localhost:3000)
npm run dev
```

---

## 🧪 Running Automated Tests & Builds

### Backend Unit Tests (Pytest)
```bash
cd backend
python -m pytest
```
*Executes all 22 test suites covering contract matching, offboarding, leave allocations, RBAC permissions, and salary calculation engines.*

### Frontend Production Build
```bash
cd frontend
npm run build
```
*Compiles TypeScript and bundles production assets into `frontend/dist`.*

---

## 👤 Demo Personas & Test Credentials

The system includes pre-seeded demo personas with quick 1-click switcher toolbars in the UI header:

| Persona | Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Alex Rivera** | Employee | `alex.rivera@company.com` | `Password123!` | Self-punch, submit leaves, confirm operational statements |
| **Sarah Jenkins** | HR Manager | `sarah.jenkins@company.com` | `Password123!` | Employee master, offboard staff, approve leaves |
| **David Chen** | HR Payroll User | `david.chen@company.com` | `Password123!` | Two-step payrun wizard, compute batch, export bank CSV |
| **Elena Rostova** | HR Payroll Mgr | `elena.rostova@company.com` | `Password123!` | Edit salary structure rules, validate payrun batches |
| **Marcus Vance** | Admin | `marcus.vance@company.com` | `Password123!` | Full administrative access across all modules |

---

## 📄 License & Attribution

PeoplePay360 is released under the **MIT License**. Built with ❤️ for enterprise HR & Payroll teams.
