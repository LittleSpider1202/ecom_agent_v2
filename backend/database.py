from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://ecom:ecom2026@192.168.0.112:5432/ecom_agent"
    secret_key: str = "ecom-agent-v2-secret-key-change-in-prod-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"


settings = Settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
