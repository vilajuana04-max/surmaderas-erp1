"""
Seed script — Sur Maderas ERP
Carga empleados, y registros de vacaciones 2025 y 2026
exactamente como figuran en el archivo Excel SurMaderas_ERP.xlsm.

Uso:
    cd backend
    python seed_vacaciones.py
"""

import os, sys
from datetime import date, datetime

# ── Asegurar que el paquete app esté en el path ──────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app import models  # noqa: registra todos los modelos ORM
from app.models.core import Branch
from app.models.employees import Employee
from app.models.vacations import VacationRecord, VacationLog

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── 1. SUCURSALES ────────────────────────────────────────────────
def get_or_create_branch(name: str) -> Branch:
    b = db.query(Branch).filter(Branch.name == name).first()
    if not b:
        b = Branch(name=name)
        db.add(b)
        db.flush()
        print(f"  ✅ Sucursal creada: {name}")
    return b

print("\n─── Sucursales ───")
luro  = get_or_create_branch("LURO")
indep = get_or_create_branch("INDEPENDENCIA")
db.commit()

# ── 2. EMPLEADOS ─────────────────────────────────────────────────
# Datos de la hoja EMPLEADOS del Excel
EMPLEADOS = [
    # (nombre, fecha_ingreso, sucursal)
    # LURO
    ("Vazquez, Martin",    date(2015, 4,  1), luro.id),
    ("Vila, Cecilia",      date(2015, 1,  1), luro.id),
    ("Scatizzi, Patricia", date(2009, 9, 11), luro.id),
    ("Vila, Guillermo",    date(2009, 3,  5), luro.id),
    ("Viejo, Marcelo",     date(2021, 2,  1), luro.id),
    ("Lalli, Facundo",     date(2022, 9, 19), luro.id),
    ("Viejo, Ariel",       date(2022, 3,  1), luro.id),
    # INDEPENDENCIA
    ("Salinas, Adrian",    date(2013, 9,  9), indep.id),
    ("Ponasso, Martin",    date(2010, 10, 1), indep.id),
    ("Avila, Alejandro",   date(2005, 7,  1), indep.id),
    ("Vivas, Ivan",        date(2024, 9,  9), indep.id),
]

def get_or_create_employee(name: str, hire_date: date, branch_id: int) -> Employee:
    emp = db.query(Employee).filter(Employee.name == name).first()
    if not emp:
        emp = Employee(name=name, hire_date=hire_date, branch_id=branch_id, is_active=True)
        db.add(emp)
        db.flush()
        print(f"  ✅ Empleado creado: {name} ({hire_date})")
    else:
        # Actualizar fecha de ingreso y sucursal por si estaban mal
        emp.hire_date  = hire_date
        emp.branch_id  = branch_id
        emp.is_active  = True
        print(f"  ♻️  Empleado existente actualizado: {name}")
    return emp

print("\n─── Empleados ───")
emp_map: dict[str, Employee] = {}
for nombre, fecha, branch_id in EMPLEADOS:
    emp = get_or_create_employee(nombre, fecha, branch_id)
    emp_map[nombre] = emp
db.commit()

# ── 3. VACACIONES 2025 ───────────────────────────────────────────
# Datos de la hoja '2025' del Excel
# (nombre, days_entitled, days_taken, pending_prev_year, description)
VAC_2025 = [
    ("Vazquez, Martin",    28, 28, 14, "03/02 al 16/02 - 30/06 al 13/06"),
    ("Vila, Cecilia",      28,  7,  7, "06/01 al 12/01"),
    ("Scatizzi, Patricia", 28, 28,  0, "31/03 al 13/04 - 13/10 al 26/10"),
    ("Vila, Guillermo",    28, 14, 21, "31/12 al 04/01 - 20/01 al 26/01"),
    ("Viejo, Marcelo",     14, 14,  0, "10/03 al 24/03"),
    ("Lalli, Facundo",     14, 14,  0, "12/05 al 25/05"),
    ("Viejo, Ariel",       14, 14,  0, "10/03 al 24/03"),
    ("Salinas, Adrian",    28, 28,  0, "14/04 al 20/04 - 21/07 al 31/07 - 15/09 al 21/09"),
    ("Ponasso, Martin",    28, 14,  0, "del 6/07 al 20/07"),
    ("Avila, Alejandro",   28, 28,  0, "del 13/01 al 26/01"),
    ("Vivas, Ivan",         0,  0,  0, None),
]

def upsert_vac_record(year: int, emp: Employee, entitled: int, taken: int,
                      pend_prev: int, desc: str | None):
    rec = db.query(VacationRecord).filter(
        VacationRecord.year == year,
        VacationRecord.employee_id == emp.id
    ).first()
    if rec:
        rec.days_entitled     = entitled
        rec.days_taken        = taken
        rec.pending_prev_year = pend_prev
        rec.description       = desc
        print(f"  ♻️  {year} {emp.name}: taken={taken} entitled={entitled} prev={pend_prev}")
    else:
        rec = VacationRecord(
            year              = year,
            employee_id       = emp.id,
            days_entitled     = entitled,
            days_taken        = taken,
            pending_prev_year = pend_prev,
            description       = desc,
        )
        db.add(rec)
        print(f"  ✅ {year} {emp.name}: taken={taken} entitled={entitled} prev={pend_prev}")

print("\n─── Vacaciones 2025 ───")
for nombre, entitled, taken, prev, desc in VAC_2025:
    emp = emp_map.get(nombre)
    if emp:
        upsert_vac_record(2025, emp, entitled, taken, prev, desc)
    else:
        print(f"  ⚠️  Empleado no encontrado: {nombre}")
db.commit()

# ── 4. VACACIONES 2026 ───────────────────────────────────────────
# Datos de la hoja '2026' del Excel
# pending_prev_year = VLOOKUP de G (pending_current) del año 2025
# total_available = entitled + pending_prev  (calculado como propiedad)
# pending_current = total_available - taken  (calculado como propiedad)
VAC_2026 = [
    ("Vazquez, Martin",    28, 14, 14, "26/01 al 08/02"),
    ("Vila, Cecilia",      28, 14, 28, "12/01 al 25/01"),
    ("Scatizzi, Patricia", 28, 14,  0, "09/02 al 23/02"),
    ("Vila, Guillermo",    28, 28, 35, None),
    ("Viejo, Marcelo",     14, 14,  0, "10/3/26 al 23/3/26"),
    ("Lalli, Facundo",     14,  0,  0, None),
    ("Viejo, Ariel",       14, 14,  0, "10/3/26 al 23/3/26"),
    ("Salinas, Adrian",    28,  0,  0, None),
    ("Ponasso, Martin",    28,  0, 14, None),
    ("Avila, Alejandro",   28, 21,  0, "16/02 al 08/03"),
    ("Vivas, Ivan",        14, 14,  0, "26/01 al 08/02"),
]

print("\n─── Vacaciones 2026 ───")
for nombre, entitled, taken, prev, desc in VAC_2026:
    emp = emp_map.get(nombre)
    if emp:
        upsert_vac_record(2026, emp, entitled, taken, prev, desc)
    else:
        print(f"  ⚠️  Empleado no encontrado: {nombre}")
db.commit()

# ── 5. LOG DE SOLICITUDES 2026 ───────────────────────────────────
# Datos de la sección DETALLE de la hoja 2026 del Excel
VAC_LOGS_2026 = [
    # (registered_date, employee_name, date_from, date_to, days, status, approved_by)
    (date(2025, 7, 27), "Viejo, Marcelo", date(2026, 3,  9), date(2026, 3, 23), 14, "Aprobado", None),
    (date(2025, 7, 27), "Viejo, Ariel",   date(2026, 3,  9), date(2026, 3, 23), 14, "Aprobado", None),
]

print("\n─── Log de solicitudes 2026 ───")
for reg_date, nombre, date_from, date_to, days, status, approved_by in VAC_LOGS_2026:
    emp = emp_map.get(nombre)
    if not emp:
        print(f"  ⚠️  Empleado no encontrado: {nombre}")
        continue
    existing = db.query(VacationLog).filter(
        VacationLog.year        == 2026,
        VacationLog.employee_id == emp.id,
        VacationLog.date_from   == date_from,
    ).first()
    if existing:
        print(f"  ♻️  Log existente: {nombre} desde {date_from}")
    else:
        log = VacationLog(
            registered_date = reg_date,
            year            = 2026,
            employee_id     = emp.id,
            date_from       = date_from,
            date_to         = date_to,
            days            = days,
            status          = status,
            approved_by     = approved_by,
            notes           = None,
        )
        db.add(log)
        print(f"  ✅ Log: {nombre} {date_from} → {date_to} ({days} días, {status})")

db.commit()
db.close()

print("\n✅ Seed completado.\n")
