"""Config editable de precios de los cotizadores.

GET es accesible para cualquier usuario autenticado (los precios no son secretos).
PUT requiere permiso de edición en Presupuestos o Venta Online, o ser admin.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.users import User
from app.models.cotizadores import CotizadorConfig
from app.permissions import effective_permissions, LEVEL_RANK

router = APIRouter(prefix="/cotizadores", tags=["cotizadores"])

# Precios de armado de marcos por superficie (defaults = valores actuales del cotizador)
DEFAULTS = {
    "armado_marcos": [
        {"hasta_m2": 0.03, "label": "Hasta 0,03 m²", "precio": 4900},
        {"hasta_m2": 0.12, "label": "Hasta 0,12 m²", "precio": 5600},
        {"hasta_m2": 0.35, "label": "Hasta 0,35 m²", "precio": 6950},
        {"hasta_m2": None, "label": "Más de 0,35 m²", "precio": 8400},
    ],
}


class ConfigIn(BaseModel):
    data: dict


def _get_row(db: Session) -> CotizadorConfig:
    row = db.query(CotizadorConfig).filter(CotizadorConfig.id == 1).first()
    if not row:
        row = CotizadorConfig(id=1, data=json.dumps(DEFAULTS))
        db.add(row); db.commit(); db.refresh(row)
    return row


def _merged(db: Session) -> dict:
    row = _get_row(db)
    try:
        stored = json.loads(row.data or "{}")
    except Exception:
        stored = {}
    out = dict(DEFAULTS)
    out.update(stored or {})
    return out


def _can_edit(user: User, db: Session) -> bool:
    if user.is_primary_admin:
        return True
    perms = effective_permissions(user, db)
    for m in ("cotizadores", "presupuestos", "venta_online"):
        if LEVEL_RANK.get(perms.get(m, "none"), 0) >= LEVEL_RANK["edit"]:
            return True
    return False


@router.get("/config")
def get_config(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"data": _merged(db), "can_edit": _can_edit(user, db)}


@router.put("/config")
def set_config(body: ConfigIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _can_edit(user, db):
        raise HTTPException(403, "No tenés permiso para editar precios de cotizadores.")
    row = _get_row(db)
    current = _merged(db)
    current.update(body.data or {})
    row.data = json.dumps(current)
    db.commit()
    return {"data": current, "can_edit": True}
