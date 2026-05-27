"""
migrate_gastos_compartidos.py
Crea la tabla gastos_compartidos (sistema nuevo sin catálogo).
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 migrate_gastos_compartidos.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

SQL = """
CREATE TABLE IF NOT EXISTS gastos_compartidos (
    id           SERIAL PRIMARY KEY,
    year         INTEGER      NOT NULL,
    month        VARCHAR(20)  NOT NULL,
    item_key     VARCHAR(100) NOT NULL,
    total_amount NUMERIC(15,2),
    indep_amount NUMERIC(15,2),
    due_date     DATE,
    detail       TEXT,
    paid_status  VARCHAR(20) DEFAULT 'NO',
    CONSTRAINT uq_gasto_compartido UNIQUE (year, month, item_key)
);
"""

with engine.connect() as conn:
    conn.execute(text(SQL))
    conn.commit()
    print("OK — tabla gastos_compartidos lista.")
