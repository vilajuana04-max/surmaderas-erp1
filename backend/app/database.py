import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://surmaderas:surmaderas2026@localhost:5432/surmaderas"
)

# Neon (y otros providers serverless) requieren SSL en producción.
# SQLAlchemy necesita que las URLs de postgres:// sean postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# En producción (Neon) habilitamos SSL; en local no.
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

connect_args = {"sslmode": "require"} if IS_PRODUCTION else {}

engine = create_engine(
    DATABASE_URL,
    connect_args      = connect_args,
    pool_pre_ping     = True,   # Reconecta si la conexión cayó
    pool_recycle      = 300,    # Recicla conexiones cada 5 min (bueno para Neon serverless)
    pool_size         = 5,
    max_overflow      = 10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
