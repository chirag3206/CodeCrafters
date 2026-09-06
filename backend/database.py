"""
PeoplePay360 — Database Engine Configuration
Supports PostgreSQL & SQLite with automatic connection pooling and fallback.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import get_settings
import logging

settings = get_settings()

db_url = settings.DATABASE_URL
connect_args = {}
engine_kwargs = {"echo": False}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif db_url.startswith("postgresql"):
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
    })

try:
    engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as err:
    logging.warning(f"Could not connect to primary DB ({db_url}): {err}. Falling back to local SQLite database.")
    fallback_url = "sqlite:///./peoplepay360.db"
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auto-migrate missing columns for PostgreSQL/SQLite
for _col_def in [
    "ALTER TABLE time_off_requests ADD COLUMN rejection_reason TEXT",
    "ALTER TABLE time_off_types ADD COLUMN allow_carry_forward BOOLEAN DEFAULT TRUE",
    "ALTER TABLE time_off_allocations ADD COLUMN carried_forward_days FLOAT DEFAULT 0.0",
    "ALTER TABLE employees ADD COLUMN leave_encashment_days FLOAT DEFAULT 0.0",
    "ALTER TABLE employees ADD COLUMN leave_encashment_amount FLOAT DEFAULT 0.0",
    "ALTER TABLE payslips ADD COLUMN leave_encashment_days FLOAT DEFAULT 0.0",
    "ALTER TABLE payslips ADD COLUMN leave_encashment_amount FLOAT DEFAULT 0.0",
]:
    try:
        with engine.connect() as _conn:
            _conn.execute(text(_col_def))
            _conn.commit()
    except Exception:
        pass


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency injector for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
