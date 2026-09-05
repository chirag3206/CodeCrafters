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
    os.makedirs("generated_payslips", exist_ok=True)
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
