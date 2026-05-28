from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.gastos_personales import GastoPersonal

router = APIRouter(prefix="/gastos-personales", tags=["Gastos Personales"])


class GastoIn(BaseModel):
    year:           int
    month:          str
    day:            int
    description:    str
    amount:         float
    category:       str          = "Otros"
    payment_method: str                      # efectivo | transferencia | tarjeta_debito | tarjeta_credito
    bank:           Optional[str] = None
    notes:          Optional[str] = None


def _to_dict(g: GastoPersonal) -> dict:
    return {
        "id":             g.id,
        "year":           g.year,
        "month":          g.month,
        "day":            g.day,
        "description":    g.description,
        "amount":         float(g.amount),
        "category":       g.category,
        "payment_method": g.payment_method,
        "bank":           g.bank,
        "notes":          g.notes,
    }


@router.get("/{year}/{month}")
def list_gastos(year: int, month: str, db: Session = Depends(get_db)):
    """Devuelve todos los gastos personales del mes, ordenados por día desc."""
    items = (
        db.query(GastoPersonal)
        .filter(GastoPersonal.year == year, GastoPersonal.month == month.upper())
        .order_by(GastoPersonal.day.desc(), GastoPersonal.created_at.desc())
        .all()
    )
    return [_to_dict(g) for g in items]


@router.post("/", status_code=201)
def create_gasto(data: GastoIn, db: Session = Depends(get_db)):
    g = GastoPersonal(
        year=data.year, month=data.month.upper(), day=data.day,
        description=data.description.strip(), amount=data.amount,
        category=data.category,
        payment_method=data.payment_method,
        bank=data.bank,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _to_dict(g)


@router.delete("/{gid}")
def delete_gasto(gid: int, db: Session = Depends(get_db)):
    g = db.query(GastoPersonal).filter(GastoPersonal.id == gid).first()
    if not g:
        raise HTTPException(404, "Gasto no encontrado")
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.get("/resumen/{year}")
def resumen_anual(year: int, db: Session = Depends(get_db)):
    """Totales mensuales del año para gráfico de resumen."""
    items = db.query(GastoPersonal).filter(GastoPersonal.year == year).all()
    por_mes: dict[str, float] = {}
    for g in items:
        por_mes[g.month] = por_mes.get(g.month, 0) + float(g.amount)
    return por_mes
