"""
PeoplePay360 — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import Base, engine
from routes import (
    auth as auth_router,
    employees as employees_router,
    contracts as contracts_router,
    schedules as schedules_router,
    leaves as leaves_router,
    attendance as attendance_router,
    salary_config as salary_config_router,
    payruns as payruns_router,
    grievances as grievances_router,
    payslips as payslips_router,
    dashboard as dashboard_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        from sqlalchemy import text
        for col_def in [
            "ALTER TABLE time_off_requests ADD COLUMN rejection_reason TEXT",
            "ALTER TABLE time_off_types ADD COLUMN allow_carry_forward BOOLEAN DEFAULT 1",
            "ALTER TABLE time_off_allocations ADD COLUMN carried_forward_days FLOAT DEFAULT 0.0",
            "ALTER TABLE employees ADD COLUMN leave_encashment_days FLOAT DEFAULT 0.0",
            "ALTER TABLE employees ADD COLUMN leave_encashment_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE payslips ADD COLUMN leave_encashment_days FLOAT DEFAULT 0.0",
            "ALTER TABLE payslips ADD COLUMN leave_encashment_amount FLOAT DEFAULT 0.0",
        ]:
            try:
                conn.execute(text(col_def))
                conn.commit()
            except Exception:
                pass  # Column already exists
    os.makedirs("generated_payslips", exist_ok=True)
    # Ensure all users (including HR & Admins) have active employee profiles & contracts for payroll
    from database import SessionLocal
    from routes.employees import ensure_all_users_have_employee_and_contract
    db_session = SessionLocal()
    try:
        ensure_all_users_have_employee_and_contract(db_session)
    except Exception as e:
        print(f"Warning during user/contract sync: {e}")
    finally:
        db_session.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Integrated HR & Payroll Operations Platform",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(employees_router.router)
app.include_router(contracts_router.router)
app.include_router(schedules_router.router)
app.include_router(leaves_router.router)
app.include_router(attendance_router.router)
app.include_router(salary_config_router.router)
app.include_router(payruns_router.router)
app.include_router(grievances_router.router)
app.include_router(payslips_router.router)
app.include_router(dashboard_router.router)

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
