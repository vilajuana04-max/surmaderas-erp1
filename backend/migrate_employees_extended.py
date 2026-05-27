"""
migrate_employees_extended.py
Agrega las columnas extendidas a la tabla employees.
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 migrate_employees_extended.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

SQL = [
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS cuil             VARCHAR(20);",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS position         VARCHAR(100);",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone            VARCHAR(50);",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_address    VARCHAR(200);",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_type     VARCHAR(20) DEFAULT 'standard';",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_plus_pct INTEGER;",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes            VARCHAR(500);",
]

with engine.connect() as conn:
    for stmt in SQL:
        conn.execute(text(stmt))
        print(f"OK: {stmt[:60]}...")
    conn.commit()
    print("\n✓ Migración completada — columnas de employees actualizadas.")
