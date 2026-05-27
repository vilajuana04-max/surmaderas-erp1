"""
seed_gastos_compartidos.py
Pobla la tabla shared_expense_items con los items de la planilla GASTOS MENSUALES.
Ejecutar una sola vez:
    DATABASE_URL="postgresql://..." python3 seed_gastos_compartidos.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no definida")

engine = create_engine(DATABASE_URL)

ITEMS = [
    # (name, category)
    # ── Servicios ─────────────────────────────────────────────
    ("Luz / Energía Eléctrica", "Servicios"),
    ("Gas",                      "Servicios"),
    ("Agua",                     "Servicios"),
    ("Internet",                 "Servicios"),
    ("Teléfono",                 "Servicios"),

    # ── Seguridad ─────────────────────────────────────────────
    ("Alarma",                   "Seguridad"),
    ("Seguro",                   "Seguridad"),

    # ── Edificio ──────────────────────────────────────────────
    ("Expensas",                 "Edificio"),
    ("Alquiler",                 "Edificio"),

    # ── Administración ────────────────────────────────────────
    ("Contador / Estudio Contable", "Administración"),
    ("Monotributo",              "Administración"),

    # ── Personal compartido ───────────────────────────────────
    ("Sueldo Compartido",        "Personal"),

    # ── Personal Independencia (100% a cargo de Independencia) ─
    ("Sueldo Avila Alejandro",   "Personal Independencia"),
    ("Sueldo Salinas Adrian",    "Personal Independencia"),
    ("Sueldo Ponasso Martin",    "Personal Independencia"),

    # ── Varios ────────────────────────────────────────────────
    ("Limpieza",                 "Varios"),
    ("Mantenimiento",            "Varios"),
    ("Insumos / Librería",       "Varios"),
    ("Publicidad / Marketing",   "Varios"),
    ("Otros",                    "Varios"),
]

with engine.connect() as conn:
    inserted = 0
    skipped  = 0
    for name, category in ITEMS:
        existing = conn.execute(
            text("SELECT id FROM shared_expense_items WHERE name = :n"),
            {"n": name}
        ).fetchone()
        if existing:
            skipped += 1
            print(f"  SKIP  {name}")
        else:
            conn.execute(
                text("INSERT INTO shared_expense_items (name, category, is_active) VALUES (:n, :c, TRUE)"),
                {"n": name, "c": category}
            )
            inserted += 1
            print(f"  OK    {name} ({category})")
    conn.commit()

print(f"\nListo: {inserted} insertados, {skipped} ya existían.")
