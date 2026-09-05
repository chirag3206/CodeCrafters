"""
PeoplePay360 — Database Engine Configuration
Supports PostgreSQL & SQLite with automatic connection pooling and fallback.
"""
from sqlalchemy import create_engine
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


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency injector for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
