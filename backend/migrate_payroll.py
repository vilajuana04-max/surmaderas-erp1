"""
Migración de payroll_items — Sur Maderas ERP
Rediseña la tabla para que coincida exactamente con las columnas del Excel.

Fórmulas Excel replicadas:
  Total bruto    = Deposito × 2  (o horas × $xhora, o valor manual)
  Plus en $      = Total bruto × (Plus - 1)  donde Plus = 1.3, 1.2, 1.1
  Total percibido= (Total bruto × Plus) − Adelantos − Deposito banco

Uso:
    cd backend
    DATABASE_URL="postgresql://..." python3 migrate_payroll.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    print("▶ Migrando payroll_items...")

    # 1. Agregar nuevas columnas (IF NOT EXISTS — idempotente)
    stmts = [
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS inasistencias_desc VARCHAR",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS adelanto         NUMERIC(15,2) DEFAULT 0",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS deposito_banco   NUMERIC(15,2) DEFAULT 0",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS horas            NUMERIC(8,2)",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS precio_hora      NUMERIC(15,2)",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS plus_factor      NUMERIC(5,3)",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS bruto_manual     NUMERIC(15,2)",
    ]
    for s in stmts:
        conn.execute(text(s))
        print(f"  ✅ {s[:60]}...")

    # 2. Migrar datos de columnas viejas a nuevas (solo si columnas viejas existen)
    try:
        conn.execute(text("""
            UPDATE payroll_items SET
                deposito_banco = bank_deposit,
                adelanto       = advance,
                plus_factor    = CASE WHEN plus_pct > 0 THEN 1 + plus_pct ELSE NULL END,
                bruto_manual   = base_salary
            WHERE deposito_banco = 0 OR deposito_banco IS NULL
        """))
        print("  ✅ Datos migrados de columnas antiguas")
    except Exception as e:
        print(f"  ℹ️  Migración de datos omitida (columnas antiguas no encontradas): {e}")

    # 3. Eliminar columnas obsoletas (si existen)
    old_cols = ["absences", "base_salary", "bank_deposit", "advance", "plus_pct", "incentive"]
    for col in old_cols:
        try:
            conn.execute(text(f"ALTER TABLE payroll_items DROP COLUMN IF EXISTS {col}"))
            print(f"  🗑️  Columna '{col}' eliminada")
        except Exception as e:
            print(f"  ℹ️  No se pudo eliminar '{col}': {e}")

    conn.commit()
    print("\n✅ Migración completada.\n")
