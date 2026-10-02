"""Administración de usuarios, roles y permisos — ERP Sur Maderas.

Todas las rutas /users están protegidas (módulo 'usuarios' = admin) por la
dependencia global `enforce`. Además acá se valida el actor y las protecciones
del administrador principal / último administrador.
"""
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, hash_password
from app.models.users import User, UserPermission, UserAudit
from app.permissions import (
    MODULES, MODULE_LABELS, LEVELS, ROLE_TEMPLATES,
    effective_permissions, is_admin_user,
)

router = APIRouter(prefix="/users", tags=["usuarios"])


# ── Schemas ───────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    username: str
    password: str
    role: str = "Personalizado"
    branch: Optional[str] = None            # luro | independencia | None (todas)
    permissions: Optional[Dict[str, str]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    branch: Optional[str] = None
    permissions: Optional[Dict[str, str]] = None


class PasswordReset(BaseModel):
    password: str


# ── Helpers ───────────────────────────────────────────────────────
def _audit(db, actor, action, target, detail=""):
    db.add(UserAudit(actor=actor or "", action=action, target=target or "", detail=detail))


def _serialize(u: User, db: Session) -> dict:
    return {
        "id": u.id,
        "name": u.name or u.username,
        "username": u.username,
        "role": u.role or "Personalizado",
        "branch": u.branch or "",
        "active": bool(u.active),
        "is_primary_admin": bool(u.is_primary_admin),
        "is_admin": is_admin_user(u, db),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "permissions": effective_permissions(u, db),
    }


def _set_permissions(db: Session, user: User, perms: Dict[str, str]):
    db.query(UserPermission).filter(UserPermission.user_id == user.id).delete()
    for m in MODULES:
        lvl = (perms.get(m) or "none")
        if lvl not in LEVELS:
            lvl = "none"
        db.add(UserPermission(user_id=user.id, module=m, level=lvl))


def _count_active_admins(db: Session) -> int:
    return sum(1 for u in db.query(User).filter(User.active == True).all() if is_admin_user(u, db))


# ── Metadatos para la UI ──────────────────────────────────────────
@router.get("/meta")
def meta():
    return {
        "modules": [{"key": m, "label": MODULE_LABELS[m]} for m in MODULES],
        "levels": LEVELS,
        "roles": list(ROLE_TEMPLATES.keys()),
        "role_templates": {r: {m: (perms.get(m, "none")) for m in MODULES} for r, perms in ROLE_TEMPLATES.items()},
    }


# ── Listado / detalle ─────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    return [_serialize(u, db) for u in users]


@router.get("/audit")
def list_audit(db: Session = Depends(get_db)):
    rows = db.query(UserAudit).order_by(UserAudit.created_at.desc(), UserAudit.id.desc()).limit(300).all()
    return [{
        "id": r.id, "created_at": r.created_at.isoformat() if r.created_at else None,
        "actor": r.actor, "action": r.action, "target": r.target, "detail": r.detail or "",
    } for r in rows]


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    return _serialize(u, db)


# ── Crear ─────────────────────────────────────────────────────────
@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    uname = data.username.strip()
    if not uname:
        raise HTTPException(400, "El usuario es obligatorio.")
    if not data.password:
        raise HTTPException(400, "La contraseña inicial es obligatoria.")
    if db.query(User).filter(User.username == uname).first():
        raise HTTPException(409, "Ya existe un usuario con ese nombre de usuario.")

    u = User(
        username=uname, name=data.name.strip() or uname,
        password_hash=hash_password(data.password),
        role=data.role or "Personalizado", active=True, is_primary_admin=False,
        branch=(data.branch or None),
    )
    db.add(u); db.flush()
    perms = data.permissions if data.permissions is not None else ROLE_TEMPLATES.get(data.role, {})
    _set_permissions(db, u, perms)
    _audit(db, actor.username, "creó usuario", uname, f"rol {data.role}")
    db.commit(); db.refresh(u)
    return _serialize(u, db)


# ── Editar ────────────────────────────────────────────────────────
@router.put("/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    # Protección del administrador principal
    if u.is_primary_admin:
        if data.active is False:
            raise HTTPException(400, "No se puede pausar al administrador principal.")
        # No permitir quitarle el acceso de admin
        if data.permissions is not None and data.permissions.get("usuarios") != "admin":
            raise HTTPException(400, "El administrador principal no puede perder el acceso de administración.")

    # No quedarse sin ningún administrador activo
    if data.active is False or (data.permissions is not None and data.permissions.get("usuarios") != "admin"):
        if is_admin_user(u, db) and u.active:
            # este cambio podría dejar sin admins
            otros = _count_active_admins(db) - 1
            if otros < 1:
                raise HTTPException(400, "Debe quedar al menos un administrador activo.")

    detalles = []
    if data.name is not None:
        u.name = data.name.strip() or u.username; detalles.append("nombre")
    if data.role is not None:
        u.role = data.role; detalles.append(f"rol {data.role}")
    if data.branch is not None:
        u.branch = data.branch or None; detalles.append(f"sucursal {data.branch or 'todas'}")
    if data.active is not None:
        u.active = data.active; detalles.append("activo" if data.active else "pausado")
    if data.permissions is not None:
        _set_permissions(db, u, data.permissions); detalles.append("permisos")

    _audit(db, actor.username, "editó usuario", u.username, ", ".join(detalles))
    db.commit(); db.refresh(u)
    return _serialize(u, db)


# ── Cambiar contraseña (reset por admin) ──────────────────────────
@router.put("/{user_id}/password")
def reset_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if not data.password:
        raise HTTPException(400, "La nueva contraseña es obligatoria.")
    u.password_hash = hash_password(data.password)
    _audit(db, actor.username, "cambió contraseña", u.username, "")
    db.commit()
    return {"ok": True}


# ── Pausar / reactivar ────────────────────────────────────────────
@router.post("/{user_id}/pause")
def pause_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.is_primary_admin:
        raise HTTPException(400, "No se puede pausar al administrador principal.")
    if u.id == actor.id:
        raise HTTPException(400, "No podés pausarte a vos mismo.")
    if is_admin_user(u, db) and u.active and (_count_active_admins(db) - 1) < 1:
        raise HTTPException(400, "Debe quedar al menos un administrador activo.")
    u.active = False
    _audit(db, actor.username, "pausó usuario", u.username, "")
    db.commit()
    return _serialize(u, db)


@router.post("/{user_id}/activate")
def activate_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    u.active = True
    _audit(db, actor.username, "reactivó usuario", u.username, "")
    db.commit()
    return _serialize(u, db)


# ── Eliminar (solo si nunca tuvo actividad) ───────────────────────
@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.is_primary_admin:
        raise HTTPException(400, "No se puede eliminar al administrador principal.")
    if u.id == actor.id:
        raise HTTPException(400, "No podés eliminarte a vos mismo.")
    if u.last_login_at is not None:
        raise HTTPException(409, "Este usuario ya tuvo actividad. Pausalo en lugar de eliminarlo (preserva el historial).")
    _audit(db, actor.username, "eliminó usuario", u.username, "sin actividad previa")
    db.query(UserPermission).filter(UserPermission.user_id == u.id).delete()
    db.delete(u)
    db.commit()
