"""
Migration: Add extended columns to employees table.

Run with:
    DATABASE_URL="postgresql://user:pass@host/dbname" python3 migrate_employees.py

For local development (default):
    python3 migrate_employees.py
    (uses postgresql://surmaderas:surmaderas2026@localhost:5432/surmaderas)
"""
import os
import sqlalchemy as sa

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://surmaderas:surmaderas2026@localhost:5432/surmaderas"
)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to: {DATABASE_URL[:40]}...")

engine = sa.create_engine(DATABASE_URL, pool_pre_ping=True)

NEW_COLUMNS = [
    ("cuil",             "VARCHAR(20)"),
    ("position",         "VARCHAR(100)"),
    ("phone",            "VARCHAR(50)"),
    ("email_address",    "VARCHAR(200)"),
    ("payroll_type",     "VARCHAR(20) DEFAULT 'standard'"),
    ("default_plus_pct", "INTEGER"),
    ("notes",            "VARCHAR(500)"),
]

with engine.connect() as conn:
    inspector = sa.inspect(engine)
    existing = {col["name"] for col in inspector.get_columns("employees")}

    for col_name, col_type in NEW_COLUMNS:
        if col_name not in existing:
            print(f"  Adding column: {col_name} ({col_type})")
            conn.execute(sa.text(f"ALTER TABLE employees ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
        else:
            print(f"  Column already exists, skipping: {col_name}")

    conn.commit()

print("Migration complete.")
