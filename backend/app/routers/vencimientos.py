from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.vencimientos import Vencimiento, VencimientoEstado

router = APIRouter(prefix="/vencimientos", tags=["Vencimientos"])

# ── Datos pre-cargados (se insertan si la tabla está vacía) ───────────────────
SEED_DATA = [
    {"name": "Alquiler local",    "day_of_month": 1,  "amount": 0, "category": "Alquiler",   "color": "#C8603A", "sort_order": 1},
    {"name": "Internet / Fibra",  "day_of_month": 5,  "amount": 0, "category": "Servicios",  "color": "#3b82f6", "sort_order": 2},
    {"name": "Seguro",            "day_of_month": 5,  "amount": 0, "category": "Seguros",    "color": "#8b5cf6", "sort_order": 3},
    {"name": "EPEC (Luz)",        "day_of_month": 10, "amount": 0, "category": "Servicios",  "color": "#f59e0b", "sort_order": 4},
    {"name": "ART",               "day_of_month": 10, "amount": 0, "category": "Seguros",    "color": "#8b5cf6", "sort_order": 5},
    {"name": "Telefonía móvil",   "day_of_month": 12, "amount": 0, "category": "Servicios",  "color": "#3b82f6", "sort_order": 6},
    {"name": "Camuzzi (Gas)",     "day_of_month": 15, "amount": 0, "category": "Servicios",  "color": "#06b6d4", "sort_order": 7},
    {"name": "Tarjeta de crédito","day_of_month": 18, "amount": 0, "category": "Financiero", "color": "#ef4444", "sort_order": 8},
    {"name": "Monotributo AFIP",  "day_of_month": 20, "amount": 0, "category": "Impuestos",  "color": "#6366f1", "sort_order": 9},
    {"name": "IIBB (Rentas)",     "day_of_month": 25, "amount": 0, "category": "Impuestos",  "color": "#6366f1", "sort_order": 10},
]


def _seed_if_empty(db: Session) -> None:
    if db.query(Vencimiento).count() == 0:
        for item in SEED_DATA:
            db.add(Vencimiento(**item))
        db.commit()


# ── Schemas ───────────────────────────────────────────────────────────────────
class VencimientoIn(BaseModel):
    name:         str
    amount:       float        = 0
    day_of_month: int
    category:     str          = "Servicios"
    color:        str          = "#3b82f6"
    active:       bool         = True
    notes:        Optional[str] = None
    sort_order:   int          = 0


class EstadoIn(BaseModel):
    status:          str                 # pendiente | pagado | omitido
    day_override:    Optional[int]   = None
    amount_override: Optional[float] = None
    notes:           Optional[str]   = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def _template_dict(v: Vencimiento) -> dict:
    return {
        "id":           v.id,
        "name":         v.name,
        "amount":       float(v.amount or 0),
        "day_of_month": v.day_of_month,
        "category":     v.category,
        "color":        v.color,
        "active":       v.active,
        "notes":        v.notes,
        "sort_order":   v.sort_order,
    }


# ── Endpoints: templates recurrentes ─────────────────────────────────────────

@router.get("/recurring")
def list_recurring(db: Session = Depends(get_db)):
    """Lista todos los vencimientos recurrentes (activos e inactivos)."""
    _seed_if_empty(db)
    items = (
        db.query(Vencimiento)
        .order_by(Vencimiento.sort_order, Vencimiento.day_of_month)
        .all()
    )
    return [_template_dict(v) for v in items]


@router.post("/recurring", status_code=201)
def create_recurring(data: VencimientoIn, db: Session = Depends(get_db)):
    v = Vencimiento(**data.dict())
    db.add(v)
    db.commit()
    db.refresh(v)
    return _template_dict(v)


@router.put("/recurring/{vid}")
def update_recurring(vid: int, data: VencimientoIn, db: Session = Depends(get_db)):
    v = db.query(Vencimiento).filter(Vencimiento.id == vid).first()
    if not v:
        raise HTTPException(404, "Vencimiento no encontrado")
    for k, val in data.dict().items():
        setattr(v, k, val)
    db.commit()
    return {"ok": True}


@router.delete("/recurring/{vid}")
def delete_recurring(vid: int, db: Session = Depends(get_db)):
    v = db.query(Vencimiento).filter(Vencimiento.id == vid).first()
    if not v:
        raise HTTPException(404, "Vencimiento no encontrado")
    db.delete(v)
    db.commit()
    return {"ok": True}


# ── Endpoints: vista mensual ──────────────────────────────────────────────────

@router.get("/{year}/{month}")
def get_month(year: int, month: str, db: Session = Depends(get_db)):
    """
    Devuelve todos los vencimientos activos para el mes indicado,
    fusionando el template con el estado mensual si existe.
    """
    _seed_if_empty(db)
    month = month.upper()

    templates = (
        db.query(Vencimiento)
        .filter(Vencimiento.active == True)
        .order_by(Vencimiento.sort_order, Vencimiento.day_of_month)
        .all()
    )

    estados: dict[int, VencimientoEstado] = {
        e.vencimiento_id: e
        for e in db.query(VencimientoEstado).filter(
            VencimientoEstado.year  == year,
            VencimientoEstado.month == month,
        ).all()
    }

    result = []
    for t in templates:
        e = estados.get(t.id)
        result.append({
            "id":              t.id,
            "name":            t.name,
            "category":        t.category,
            "color":           t.color,
            "day":             (e.day_override if e and e.day_override else t.day_of_month),
            "amount":          float(
                e.amount_override
                if e and e.amount_override is not None
                else (t.amount or 0)
            ),
            "status":          e.status if e else "pendiente",
            "paid_at":         e.paid_at.isoformat() if e and e.paid_at else None,
            "notes":           e.notes if e else None,
            "estado_id":       e.id   if e else None,
            "day_original":    t.day_of_month,
            "amount_original": float(t.amount or 0),
        })

    return sorted(result, key=lambda x: x["day"])


@router.put("/{year}/{month}/{vid}")
def update_estado(
    year: int, month: str, vid: int,
    data: EstadoIn, db: Session = Depends(get_db),
):
    """Guarda o actualiza el estado mensual de un vencimiento."""
    month = month.upper()

    e = db.query(VencimientoEstado).filter(
        VencimientoEstado.vencimiento_id == vid,
        VencimientoEstado.year           == year,
        VencimientoEstado.month          == month,
    ).first()

    paid_at = datetime.now(timezone.utc) if data.status == "pagado" else None

    if e:
        e.status          = data.status
        e.day_override    = data.day_override
        e.amount_override = data.amount_override
        e.notes           = data.notes
        e.paid_at         = paid_at
    else:
        e = VencimientoEstado(
            vencimiento_id  = vid,
            year            = year,
            month           = month,
            status          = data.status,
            day_override    = data.day_override,
            amount_override = data.amount_override,
            notes           = data.notes,
            paid_at         = paid_at,
        )
        db.add(e)

    db.commit()
    return {"ok": True}
