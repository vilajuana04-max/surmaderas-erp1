import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app import models  # noqa: registers all ORM models
from app.routers import (
    auth_router,
    sales_router, purchases_router, payroll_router,
    vacations_router, expenses_router, dashboard_router, employees_router,
    receipts_router, cashflow_router, vencimientos_router, gastos_personales_router,
    caja_diaria_router, cupones_router, clientes_router, marketing_router,
)

Base.metadata.create_all(bind=engine)

# ── Migraciones de columnas nuevas (idempotentes) ────────────────
def _run_migrations():
    """Agrega columnas nuevas si aún no existen. Seguro de correr múltiples veces."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);"
        ))
        db.execute(text(
            "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS caja_id INTEGER;"
        ))
        # Todas las columnas de payroll_items (la tabla se creó con solo id+period_id+employee_id)
        for col_sql in [
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS inasistencias_desc VARCHAR(100);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS adelanto NUMERIC(15,2) DEFAULT 0;",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS deposito_banco NUMERIC(15,2) DEFAULT 0;",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS horas NUMERIC(8,2);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS precio_hora NUMERIC(15,2);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS plus_factor NUMERIC(5,3);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS bruto_manual NUMERIC(15,2);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS comision NUMERIC(15,2);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS comision_desc VARCHAR(100);",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS es_base BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS sin_dep BOOLEAN DEFAULT FALSE;",
        ]:
            db.execute(text(col_sql))
        # Renombrar usuario 'Caja' → 'CAJA' y asegurar role caja_diaria
        db.execute(text(
            "UPDATE users SET username = 'CAJA', role = 'caja_diaria' WHERE username IN ('Caja', 'caja') AND role != 'admin';"
        ))
        db.commit()
    except Exception as e:
        print(f"[migration] Error: {e}")
    finally:
        db.close()

_run_migrations()

# ── Seed usuarios por defecto ────────────────────────────────────
def _seed_users():
    """Crea usuarios iniciales si no existen. Se ejecuta al arrancar."""
    from app.database import SessionLocal
    from app.models.users import User

    # Hash bcrypt de "Gust1401" (rounds=12)
    HASH_GUST1401 = "$2b$12$DM6fkHH4HVcp8sJ5X200MOt3bXu0UWZ8XqGBhc.kernSC8h/1mdM."
    # Hash bcrypt de "1111" (rounds=12)
    HASH_1111     = "$2b$12$EY1XI8rJnuVxfEbE1kqcx.l4/j5eDMObYjcoAO.wCZ.Y0QMpFmvVG"

    DEFAULT_USERS = [
        ("Gustavo",  HASH_GUST1401, "admin"),
        ("Personal", HASH_GUST1401, "caja"),
        ("CAJA",     HASH_1111,     "caja_diaria"),
    ]

    db = SessionLocal()
    try:
        for username, pw_hash, role in DEFAULT_USERS:
            if not db.query(User).filter(User.username == username).first():
                db.add(User(username=username, password_hash=pw_hash, role=role))
                print(f"[seed] Usuario '{username}' creado.")
        db.commit()
    except Exception as e:
        print(f"[seed] Error: {e}")
    finally:
        db.close()

_seed_users()

# ── CORS ────────────────────────────────────────────────────────
# App interna de Sur Maderas — aceptamos cualquier origen para
# evitar conflictos de preflight con URLs de preview de Vercel.
# La autenticación se maneja con JWT en el header Authorization.

app = FastAPI(
    title       = "Sur Maderas ERP API",
    description = "Sistema ERP para Sur Maderas — Mar del Plata",
    version     = "1.0.0",
    docs_url    = "/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url   = None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # all origins — app interna, JWT protege los datos
    allow_credentials = False,   # debe ser False cuando allow_origins=["*"]
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth_router)
app.include_router(sales_router)
app.include_router(purchases_router)
app.include_router(payroll_router)
app.include_router(vacations_router)
app.include_router(expenses_router)
app.include_router(dashboard_router)
app.include_router(employees_router)
app.include_router(receipts_router)
app.include_router(cashflow_router)
app.include_router(vencimientos_router)
app.include_router(gastos_personales_router)
app.include_router(caja_diaria_router)
app.include_router(cupones_router)
app.include_router(clientes_router)
app.include_router(marketing_router)


@app.get("/")
def root():
    return {
        "status":  "ok",
        "app":     "Sur Maderas ERP",
        "version": "1.0.0",
        "env":     os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
