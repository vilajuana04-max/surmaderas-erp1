"""
migrate_luro_gastos.py
Agrega columnas de texto (categoria, subcategoria, pagado) a luro_expenses.
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 migrate_luro_gastos.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

SQL = [
    "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS categoria    VARCHAR(100);",
    "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(150);",
    "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS pagado       VARCHAR(10) DEFAULT 'NO';",
    # category_id ahora es nullable
    "ALTER TABLE luro_expenses ALTER COLUMN category_id DROP NOT NULL;",
]

with engine.connect() as conn:
    for stmt in SQL:
        conn.execute(text(stmt))
        print(f"OK: {stmt[:70]}...")
    conn.commit()
    print("\n✓ Migración luro_expenses completada.")
