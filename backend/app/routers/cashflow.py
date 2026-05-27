from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CashFlowEntry

router = APIRouter(prefix="/cashflow", tags=["Flujo de Caja"])


@router.get("/{year}")
def get_cashflow(year: int, db: Session = Depends(get_db)):
    """Retorna todas las celdas editables del año como {row_key: {MONTH: amount}}."""
    entries = db.query(CashFlowEntry).filter(CashFlowEntry.year == year).all()
    result: dict = {}
    for e in entries:
        result.setdefault(e.row_key, {})[e.month] = float(e.amount or 0)
    return result


@router.put("/{year}/{row_key}/{month}")
def upsert_cell(year: int, row_key: str, month: str, data: dict, db: Session = Depends(get_db)):
    """Guarda o actualiza el valor de una celda."""
    amount = data.get("amount", 0)
    entry = db.query(CashFlowEntry).filter(
        CashFlowEntry.year    == year,
        CashFlowEntry.row_key == row_key,
        CashFlowEntry.month   == month.upper()
    ).first()

    if entry:
        entry.amount = amount
    else:
        entry = CashFlowEntry(year=year, row_key=row_key, month=month.upper(), amount=amount)
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return {"ok": True, "amount": float(entry.amount or 0)}


@router.delete("/{year}")
def clear_cashflow(year: int, db: Session = Depends(get_db)):
    """Borra todos los datos de un año (uso administrativo)."""
    db.query(CashFlowEntry).filter(CashFlowEntry.year == year).delete()
    db.commit()
    return {"ok": True}
