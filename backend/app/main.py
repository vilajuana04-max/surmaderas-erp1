import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Depends
from app.database import engine, Base
from app import models  # noqa: registers all ORM models
from app.permissions import enforce
from app.routers import (
    auth_router,
    sales_router, purchases_router, payroll_router,
    vacations_router, expenses_router, dashboard_router, employees_router,
    receipts_router, cashflow_router, vencimientos_router, gastos_personales_router,
    caja_diaria_router, cupones_router, clientes_router, marketing_router, contenido_router,
    puestos_router, placas_router, online_sales_router, users_router,
    presupuestos_router, cotizadores_router, campaigns_router,
    fichaje_router,
)

Base.metadata.create_all(bind=engine)

# ── Migraciones de columnas nuevas (idempotentes) ────────────────
def _run_migrations():
    """Agrega columnas nuevas si aún no existen. Cada sentencia corre en su
    propia transacción para que un fallo no bloquee las demás."""
    from sqlalchemy import text
    from app.database import SessionLocal

    statements = [
        "ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS caja_id INTEGER;",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS tipo_costo VARCHAR(10) DEFAULT 'fijo';",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(150);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS pagado VARCHAR(10) DEFAULT 'NO';",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS detail VARCHAR(300);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS paid_status BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS month VARCHAR(20);",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS year INTEGER;",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS expense_date DATE;",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS category_id INTEGER;",
        "ALTER TABLE luro_expenses ADD COLUMN IF NOT EXISTS subcategory_id INTEGER;",
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
        "ALTER TABLE marketing_calendar ADD COLUMN IF NOT EXISTS tareas TEXT DEFAULT '[]';",
        "ALTER TABLE marketing_calendar ADD COLUMN IF NOT EXISTS dias_preparacion INTEGER DEFAULT 0;",
        "ALTER TABLE marketing_calendar ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '';",
        "ALTER TABLE puestos ADD COLUMN IF NOT EXISTS reporta_a VARCHAR(200) DEFAULT '';",
        "ALTER TABLE puestos ADD COLUMN IF NOT EXISTS interactua_con VARCHAR(300) DEFAULT '';",
        "ALTER TABLE puestos ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(200) DEFAULT '';",
        "ALTER TABLE puestos ADD COLUMN IF NOT EXISTS horario VARCHAR(200) DEFAULT '';",
        "ALTER TABLE caja_diaria ADD COLUMN IF NOT EXISTS cantidad_tickets INTEGER DEFAULT 0;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(120) DEFAULT '';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(20);",
        "ALTER TABLE coupon_campaigns ADD COLUMN IF NOT EXISTS public_url VARCHAR(300) DEFAULT '';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;",
        "ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(30);",
        "UPDATE users SET username = 'CAJA', role = 'caja_diaria' WHERE username IN ('Caja', 'caja') AND role != 'admin';",
    ]
    for sql in statements:
        db = SessionLocal()
        try:
            db.execute(text(sql))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[migration] '{sql[:50]}...' -> {e}")
        finally:
            db.close()

_run_migrations()

# ── Seed usuarios por defecto ────────────────────────────────────
def _seed_users():
    """Crea usuarios iniciales si no existen. Se ejecuta al arrancar."""
    from app.database import SessionLocal
    from app.models.users import User
    from app.auth import hash_password

    # Hash bcrypt de "Gust1401" (rounds=12)
    HASH_GUST1401 = "$2b$12$DM6fkHH4HVcp8sJ5X200MOt3bXu0UWZ8XqGBhc.kernSC8h/1mdM."
    # Hash bcrypt de "1111" (rounds=12)
    HASH_1111     = "$2b$12$EY1XI8rJnuVxfEbE1kqcx.l4/j5eDMObYjcoAO.wCZ.Y0QMpFmvVG"

    DEFAULT_USERS = [
        ("Gustavo",       HASH_GUST1401,                     "admin"),
        ("Personal",      HASH_GUST1401,                     "caja"),
        ("CAJA",          HASH_1111,                         "caja_diaria"),
        ("independencia", hash_password("Surmaderas-1"),     "cupones"),
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


def _seed_employees():
    """Alta de empleados puntuales si no existen. Se ejecuta al arrancar."""
    from datetime import date
    from app.database import SessionLocal
    from app.models.employees import Employee
    from app.models.core import Branch

    db = SessionLocal()
    try:
        # Sucursal Luro: por nombre (case-insensitive), fallback a id=1
        luro = db.query(Branch).filter(Branch.name.ilike("%luro%")).first()
        luro_id = luro.id if luro else 1

        NUEVOS = ["Matias", "Valentina"]
        for name in NUEVOS:
            existe = db.query(Employee).filter(Employee.name == name, Employee.branch_id == luro_id).first()
            if not existe:
                db.add(Employee(
                    name=name, branch_id=luro_id, hire_date=date.today(),
                    is_active=True, payroll_type="standard",
                ))
                print(f"[seed] Empleado '{name}' (Luro) creado.")
        db.commit()
    except Exception as e:
        print(f"[seed] Error empleados: {e}")
    finally:
        db.close()

_seed_employees()


def _seed_user_admin():
    """Marca el admin principal (Gustavo) y crea permisos iniciales para los
    usuarios existentes que todavía no tengan filas de permisos. Idempotente."""
    from app.database import SessionLocal
    from app.models.users import User, UserPermission
    from app.permissions import MODULES, LEGACY_ROLE_PERMS, ROLE_TEMPLATES

    db = SessionLocal()
    try:
        # Nombres visibles + admin principal
        names = {"Gustavo": "Gustavo", "Personal": "Personal", "CAJA": "Caja", "independencia": "Independencia"}
        for uname, display in names.items():
            u = db.query(User).filter(User.username == uname).first()
            if u and not (u.name or "").strip():
                u.name = display
        gus = db.query(User).filter(User.username == "Gustavo").first()
        if gus and not gus.is_primary_admin:
            gus.is_primary_admin = True
            gus.role = "Administrador"
        db.commit()

        # Permisos iniciales derivados del rol legacy (solo si no tiene filas)
        for u in db.query(User).all():
            if db.query(UserPermission).filter(UserPermission.user_id == u.id).first():
                continue
            if u.is_primary_admin:
                base = {m: "admin" for m in MODULES}
            else:
                base = dict(LEGACY_ROLE_PERMS.get((u.role or "").lower(), {})) \
                    or dict(ROLE_TEMPLATES.get(u.role, {}))
            for m in MODULES:
                db.add(UserPermission(user_id=u.id, module=m, level=base.get(m, "none")))
        db.commit()

        # Usuario 'independencia': caja diaria propia, bloqueada a su sucursal
        ind = db.query(User).filter(User.username == "independencia").first()
        if ind:
            if ind.branch != "independencia":
                ind.branch = "independencia"
            cd = db.query(UserPermission).filter(
                UserPermission.user_id == ind.id, UserPermission.module == "caja_diaria"
            ).first()
            if cd:
                if cd.level in (None, "", "none"):
                    cd.level = "edit"
            else:
                db.add(UserPermission(user_id=ind.id, module="caja_diaria", level="edit"))
            db.commit()
    except Exception as e:
        print(f"[seed] Error permisos usuarios: {e}")
    finally:
        db.close()

_seed_user_admin()


def _seed_batata_campaign():
    """Crea la campaña de cupones 'batataxsur' si no existe. Idempotente.
    Garantiza que el formulario público (surmaderas.com.ar/Batataxsur/) genere
    cupones SURBATATA### aunque nadie la haya cargado a mano en el ERP."""
    import json
    from app.database import SessionLocal
    from app.models.campaigns import CouponCampaign

    PREGUNTAS = [
        {"id": "q1",  "label": "¿Cómo nos conociste?", "type": "select",
         "options": ["Instagram", "Facebook", "Batata", "Recomendación", "Pasaba por el local"], "required": True},
        {"id": "q2",  "label": "¿Ya comprabas en Sur Maderas?", "type": "select",
         "options": ["Sí, soy cliente", "No, es mi primera vez"], "required": True},
        {"id": "q3",  "label": "¿Para quién es la compra?", "type": "select",
         "options": ["Para mis hijos/as", "Para un regalo", "Para el jardín/escuela", "Para mí"], "required": False},
        {"id": "q4",  "label": "¿Qué de la línea infantil te interesa más?", "type": "text", "required": False},
        {"id": "q5",  "label": "¿Qué edad tienen los chicos/as?", "type": "text", "required": False},
        {"id": "q6",  "label": "¿Cómo preferís comprar?", "type": "select",
         "options": ["En el local", "Por WhatsApp", "Online"], "required": False},
        {"id": "q7",  "label": "¿Seguís a Batata en redes?", "type": "select",
         "options": ["Sí", "Todavía no"], "required": False},
        {"id": "q8",  "label": "¿Nos recomendarías a un amigo/a?", "type": "select",
         "options": ["Seguro", "Probablemente", "No sé"], "required": False},
        {"id": "q9",  "label": "Tu barrio o zona", "type": "text", "required": False},
        {"id": "q10", "label": "¿Querés recibir novedades y promos?", "type": "select",
         "options": ["Sí", "No"], "required": False},
        {"id": "q11", "label": "Algo que quieras contarnos", "type": "textarea", "required": False},
    ]

    db = SessionLocal()
    try:
        existe = db.query(CouponCampaign).filter(CouponCampaign.slug == "batataxsur").first()
        if not existe:
            db.add(CouponCampaign(
                slug="batataxsur",
                name="Batata x Sur",
                coupon_prefix="SURBATATA",
                next_number=111,
                discount_pct=15,
                scope_text="línea infantil, todos los medios de pago",
                intro_text="Completá y ganate un 15% OFF en toda la línea infantil de Sur Maderas 💛",
                questions=json.dumps(PREGUNTAS, ensure_ascii=False),
                public_url="https://surmaderas.com.ar/Batataxsur/",
                active=True,
                created_by="seed",
            ))
            db.commit()
            print("[seed] Campaña 'batataxsur' creada (SURBATATA111, 15% OFF línea infantil).")
    except Exception as e:
        print(f"[seed] Error campaña batata: {e}")
    finally:
        db.close()

_seed_batata_campaign()


def _seed_fichaje_empleados():
    """Alta de los empleados del control horario si no existen. Idempotente."""
    from app.database import SessionLocal
    from app.models.fichaje import FichajeEmpleado

    EMP = [
        ("Ariel Viejo", "08:00", "17:00"),
        ("Martin Vazquez", "08:00", "17:00"),
        ("Marcelo Viejo", "08:00", "17:00"),
        ("Facundo Damian Lali", "08:00", "17:00"),
        ("Patricia Scatizzi", "11:00", "17:00"),
        ("Cecilia Vila", "08:00", "14:00"),
    ]
    db = SessionLocal()
    try:
        for i, (nombre, ent, sal) in enumerate(EMP):
            if not db.query(FichajeEmpleado).filter(FichajeEmpleado.nombre == nombre).first():
                db.add(FichajeEmpleado(nombre=nombre, hora_entrada=ent, hora_salida=sal, activo=True, orden=i))
                print(f"[seed] Empleado fichaje '{nombre}' creado.")
        db.commit()
    except Exception as e:
        print(f"[seed] Error fichaje: {e}")
    finally:
        db.close()

_seed_fichaje_empleados()

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

# Dependencia global de permisos (CORS-safe: las HTTPException pasan por CORS).
# fail-safe: admins pasan todo, rutas sin mapeo no bloquean, sin token = legacy.
_dep = [Depends(enforce)]

app.include_router(auth_router,             dependencies=_dep)
app.include_router(sales_router,            dependencies=_dep)
app.include_router(purchases_router,        dependencies=_dep)
app.include_router(payroll_router,          dependencies=_dep)
app.include_router(vacations_router,        dependencies=_dep)
app.include_router(expenses_router,         dependencies=_dep)
app.include_router(dashboard_router,        dependencies=_dep)
app.include_router(employees_router,        dependencies=_dep)
app.include_router(receipts_router,         dependencies=_dep)
app.include_router(cashflow_router,         dependencies=_dep)
app.include_router(vencimientos_router,     dependencies=_dep)
app.include_router(gastos_personales_router, dependencies=_dep)
app.include_router(caja_diaria_router,      dependencies=_dep)
app.include_router(cupones_router,          dependencies=_dep)
app.include_router(clientes_router,         dependencies=_dep)
app.include_router(marketing_router,        dependencies=_dep)
app.include_router(contenido_router,        dependencies=_dep)
app.include_router(puestos_router,          dependencies=_dep)
app.include_router(placas_router,           dependencies=_dep)
app.include_router(online_sales_router,     dependencies=_dep)
app.include_router(users_router,            dependencies=_dep)
app.include_router(presupuestos_router,     dependencies=_dep)
app.include_router(cotizadores_router,      dependencies=_dep)
app.include_router(campaigns_router,        dependencies=_dep)
app.include_router(fichaje_router,          dependencies=_dep)


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
