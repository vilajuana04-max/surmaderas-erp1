"""
migrate_luro_tipo_costo.py
Agrega la columna tipo_costo a luro_expenses para clasificar
cada gasto como 'fijo' o 'variable'.
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 migrate_luro_tipo_costo.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

SQL = [
    "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS tipo_costo VARCHAR(10) DEFAULT 'fijo';",
    "UPDATE luro_expenses SET tipo_costo = 'fijo' WHERE tipo_costo IS NULL;",
]

with engine.connect() as conn:
    for stmt in SQL:
        conn.execute(text(stmt))
        print(f"OK: {stmt[:80]}...")
    conn.commit()
    print("\n✓ Migración tipo_costo completada.")
