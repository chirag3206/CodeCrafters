from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PeoplePay360"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # JWT
    SECRET_KEY: str = "peoplepay360-super-secret-jwt-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for demo sessions

    # Database (PostgreSQL default, overrides with env var DATABASE_URL if set)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/peoplepay360"

    # SMTP (optional — falls back to outbox if not configured)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True          # Use STARTTLS (required for Gmail port 587)
    SMTP_FROM: str = "noreply@peoplepay360.com"
    COMPANY_NAME: str = "PeoplePay360 Inc."

    class Config:
        env_file = ".env"
        extra = "ignore"


def get_settings() -> Settings:
    return Settings()
