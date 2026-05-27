"""
migrate_month_closures.py
Crea la tabla month_closures para el cierre y reapertura de meses.
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 migrate_month_closures.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

SQL = [
    """
    CREATE TABLE IF NOT EXISTS month_closures (
        id         SERIAL PRIMARY KEY,
        section    VARCHAR(20)  NOT NULL,
        year       INTEGER      NOT NULL,
        month      VARCHAR(20)  NOT NULL,
        closed_at  TIMESTAMPTZ  DEFAULT NOW(),
        CONSTRAINT uq_month_closure UNIQUE (section, year, month)
    );
    """
]

with engine.connect() as conn:
    for stmt in SQL:
        conn.execute(text(stmt))
        print(f"OK: tabla month_closures creada (o ya existía).")
    conn.commit()
    print("\n✓ Migración month_closures completada.")
