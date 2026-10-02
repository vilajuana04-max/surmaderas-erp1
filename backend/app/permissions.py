"""Sistema de permisos por módulo del ERP Sur Maderas.

Niveles: none < view < edit < admin.
El enforcement del backend se aplica como dependencia global por router (ver main.py),
de forma CORS-safe (las HTTPException viajan por el CORSMiddleware).

Diseño FAIL-SAFE:
- Los administradores (is_primary_admin o usuarios=admin) pasan todo.
- Rutas sin mapeo de módulo → no se bloquean.
- Requests sin token → comportamiento legacy (no se bloquean, salvo /users y /auth/me)
  para no romper llamadas existentes (cupones/uploads). Los requests CON token sí se validan.
"""
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from jose import jwt

from app.database import get_db
from app.auth import SECRET_KEY, ALGORITHM
from app.models.users import User, UserPermission

# ── Módulos canónicos del ERP ─────────────────────────────────────
MODULES = [
    "dashboard", "caja_diaria", "finanzas", "rrhh", "vencimientos",
    "gastos_personales", "clientes", "marketing", "contenido",
    "venta_online", "usuarios",
]
MODULE_LABELS = {
    "dashboard": "Dashboard",
    "caja_diaria": "Caja Diaria",
    "finanzas": "Finanzas",
    "rrhh": "Recursos Humanos",
    "vencimientos": "Vencimientos",
    "gastos_personales": "Gastos Personales",
    "clientes": "Clientes",
    "marketing": "Marketing",
    "contenido": "Contenido",
    "venta_online": "Venta Online",
    "usuarios": "Usuarios (Configuración)",
}

LEVELS = ["none", "view", "edit", "admin"]
LEVEL_RANK = {"none": 0, "view": 1, "edit": 2, "admin": 3}


def _all(level: str) -> dict:
    return {m: level for m in MODULES}


# ── Plantillas de rol ─────────────────────────────────────────────
ROLE_TEMPLATES = {
    "Administrador": _all("admin"),
    "Caja": {"dashboard": "view", "caja_diaria": "edit", "clientes": "edit", "venta_online": "edit"},
    "Ventas": {"dashboard": "view", "venta_online": "edit", "clientes": "edit"},
    "Personalizado": {},
}

# Roles legacy (texto) → permisos equivalentes (fallback si el user no tiene filas)
LEGACY_ROLE_PERMS = {
    "admin": _all("admin"),
    "administrador": _all("admin"),
    "caja": {"dashboard": "view", "caja_diaria": "edit", "clientes": "edit", "venta_online": "edit"},
    "caja_diaria": {"caja_diaria": "edit", "clientes": "edit"},
    "cupones": {"clientes": "edit"},
    "ventas": {"dashboard": "view", "venta_online": "edit", "clientes": "edit"},
}

# ── Mapeo prefijo de ruta → módulo ────────────────────────────────
PATH_MODULE = [
    ("/dashboard", "dashboard"),
    ("/caja-diaria", "caja_diaria"),
    ("/sales", "finanzas"), ("/purchases", "finanzas"), ("/expenses", "finanzas"),
    ("/cashflow", "finanzas"), ("/placas", "finanzas"),
    ("/payroll", "rrhh"), ("/vacations", "rrhh"), ("/employees", "rrhh"),
    ("/receipts", "rrhh"), ("/puestos", "rrhh"),
    ("/vencimientos", "vencimientos"),
    ("/gastos-personales", "gastos_personales"),
    ("/clientes", "clientes"), ("/cupones", "clientes"),
    ("/marketing", "marketing"),
    ("/contenido", "contenido"),
    ("/online", "venta_online"),
    ("/users", "usuarios"),
]


def module_for_path(path: str):
    for prefix, mod in PATH_MODULE:
        if path == prefix or path.startswith(prefix + "/"):
            return mod
    return None


def effective_permissions(user: User, db: Session) -> dict:
    """Permisos efectivos del usuario (módulo → nivel)."""
    if user.is_primary_admin:
        return _all("admin")
    rows = db.query(UserPermission).filter(UserPermission.user_id == user.id).all()
    if rows:
        d = {r.module: r.level for r in rows}
    else:
        d = dict(LEGACY_ROLE_PERMS.get((user.role or "").lower(), {}))
    return {m: d.get(m, "none") for m in MODULES}


def is_admin_user(user: User, db: Session) -> bool:
    if user.is_primary_admin:
        return True
    return effective_permissions(user, db).get("usuarios") == "admin"


# ── Dependencia global de enforcement ─────────────────────────────
async def enforce(request: Request, db: Session = Depends(get_db)):
    method = request.method.upper()
    if method == "OPTIONS":
        return
    path = request.url.path
    # Login siempre público
    if path.startswith("/auth/login"):
        return

    module = module_for_path(path)
    is_me = path.startswith("/auth/me")

    authz = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    token = authz[7:].strip() if authz[:7].lower() == "bearer " else None

    if not token:
        # Sin token → legacy (no bloquear), salvo zonas sensibles
        if module == "usuarios" or is_me:
            raise HTTPException(401, "No autenticado")
        return

    # Con token → validar
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.active:
        raise HTTPException(401, "Usuario inactivo o inexistente")

    # /auth/me y rutas no mapeadas → cualquier usuario autenticado
    if is_me or module is None:
        return

    # Restricción por sucursal (ej: usuario de Independencia no ve Luro)
    if module == "caja_diaria" and user.branch:
        for seg in path.strip("/").split("/"):
            if seg in ("luro", "independencia") and seg != user.branch:
                raise HTTPException(403, "Sin acceso a la caja de otra sucursal")

    perms = effective_permissions(user, db)
    level = perms.get(module, "none")
    if module == "usuarios":
        required = "admin"
    else:
        required = "view" if method == "GET" else "edit"

    if LEVEL_RANK.get(level, 0) >= LEVEL_RANK.get(required, 0):
        return
    raise HTTPException(403, f"Sin permiso para el módulo '{module}'")
