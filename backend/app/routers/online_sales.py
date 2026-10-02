"""Venta Online — CRUD de ventas, clientes, categorías y transferencias.

Reglas de negocio (ver prompt del módulo):
- pendiente: cobrado=0, saldo=total
- señado:    cobrado=seña, saldo=total-seña  (0 < seña < total)
- pagado:    cobrado=total, saldo=0  (efectivo | transferencia | mixto)
- Toda plata recibida por transferencia genera un registro en online_transfers
  (append: nunca pisa una transferencia anterior de una seña — ver Caso 5).
- NO genera ingresos automáticos en Caja Diaria.
"""
from decimal import Decimal
from datetime import date as DateType, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as safunc

from app.database import get_db
from app.models.online_sales import (
    OnlineSale, OnlineCustomer, OnlineSaleCategory, OnlineTransfer,
)

router = APIRouter(prefix="/online", tags=["venta-online"])

D0 = Decimal("0")
def _d(v) -> Decimal:
    try:
        return Decimal(str(v if v is not None else 0))
    except Exception:
        return D0


# ═══════════════ Schemas ═══════════════
class CategoryIn(BaseModel):
    name: str
    active: Optional[bool] = True


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    notes: Optional[str] = ""
    active: Optional[bool] = True


class SaleIn(BaseModel):
    date:           Optional[DateType] = None
    customer_id:    Optional[int] = None
    customer_name:  Optional[str] = ""
    contact:        Optional[str] = ""
    category_id:    Optional[int] = None
    description:    Optional[str] = ""
    total:          float
    payment_status: str = "pendiente"      # pendiente | senado | pagado
    # señado
    sena_amount:    Optional[float] = 0
    sena_method:    Optional[str] = ""      # transferencia | efectivo
    # pagado
    payment_method: Optional[str] = ""      # efectivo | transferencia | mixto
    cash_amount:    Optional[float] = 0
    transfer_amount: Optional[float] = 0
    usuario:        Optional[str] = ""


class ReconcileIn(BaseModel):
    usuario: Optional[str] = ""


# ═══════════════ Serializers ═══════════════
def _cat(c: OnlineSaleCategory) -> dict:
    return {"id": c.id, "name": c.name, "active": bool(c.active)}


def _cust(c: OnlineCustomer) -> dict:
    return {
        "id": c.id, "name": c.name, "phone": c.phone or "",
        "notes": c.notes or "", "active": bool(c.active),
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _sale(s: OnlineSale) -> dict:
    return {
        "id": s.id, "sale_number": s.sale_number,
        "date": s.date.isoformat() if s.date else None,
        "customer_id": s.customer_id,
        "customer_name": (s.customer.name if s.customer else None) or s.customer_name or "",
        "contact": s.contact or "",
        "category_id": s.category_id,
        "category_name": s.category.name if s.category else "",
        "description": s.description or "",
        "total": float(s.total or 0),
        "payment_status": s.payment_status,
        "amount_paid": float(s.amount_paid or 0),
        "amount_pending": float(s.amount_pending or 0),
        "payment_method": s.payment_method or "",
        "cash_amount": float(s.cash_amount or 0),
        "transfer_amount": float(s.transfer_amount or 0),
        "sena_amount": float(s.sena_amount or 0),
        "sena_method": s.sena_method or "",
        "created_by": s.created_by or "",
        "updated_by": s.updated_by or "",
        "transfers": [_transfer(t) for t in sorted(s.transfers, key=lambda x: x.id)],
    }


def _transfer(t: OnlineTransfer, sale: OnlineSale = None) -> dict:
    s = sale or t.sale
    return {
        "id": t.id, "sale_id": t.sale_id,
        "sale_number": s.sale_number if s else "",
        "customer_name": ((s.customer.name if s and s.customer else None) or (s.customer_name if s else "") or "") if s else "",
        "category_name": (s.category.name if s and s.category else "") if s else "",
        "sale_total": float(s.total or 0) if s else 0,
        "sale_status": s.payment_status if s else "",
        "date": t.date.isoformat() if t.date else None,
        "amount": float(t.amount or 0),
        "type": t.type,
        "reconciliation_status": t.reconciliation_status,
        "reconciled_at": t.reconciled_at.isoformat() if t.reconciled_at else None,
        "reconciled_by": t.reconciled_by or "",
    }


# ═══════════════ Lógica de negocio ═══════════════
def _apply_logic(sale: OnlineSale, data: SaleIn, db: Session):
    """Calcula cobrado/saldo y sincroniza transferencias (append-only)."""
    total = _d(data.total)
    if total <= 0:
        raise HTTPException(400, "El monto total debe ser mayor a 0.")

    status = data.payment_status
    sale.total = total

    if status == "pendiente":
        sale.payment_status = "pendiente"
        sale.amount_paid = D0
        sale.amount_pending = total
        sale.payment_method = ""
        sale.cash_amount = D0
        sale.transfer_amount = D0
        sale.sena_amount = D0
        sale.sena_method = ""

    elif status == "senado":
        sena = _d(data.sena_amount)
        if sena <= 0:
            raise HTTPException(400, "La seña debe ser mayor a 0.")
        if sena >= total:
            # Seña = total → se considera pagada
            return _apply_logic(sale, SaleIn(
                date=data.date, total=data.total, payment_status="pagado",
                payment_method=(data.sena_method or "transferencia"),
                transfer_amount=(data.total if (data.sena_method or "") == "transferencia" else 0),
                cash_amount=(data.total if (data.sena_method or "") == "efectivo" else 0),
                usuario=data.usuario,
            ), db)
        sale.payment_status = "senado"
        sale.sena_amount = sena
        sale.sena_method = data.sena_method or "efectivo"
        sale.amount_paid = sena
        sale.amount_pending = total - sena
        sale.payment_method = ""
        sale.cash_amount = sena if sale.sena_method == "efectivo" else D0
        sale.transfer_amount = sena if sale.sena_method == "transferencia" else D0

    elif status == "pagado":
        method = data.payment_method or "efectivo"
        sale.payment_status = "pagado"
        sale.amount_paid = total
        sale.amount_pending = D0
        sale.payment_method = method
        if method == "efectivo":
            sale.cash_amount = total
            sale.transfer_amount = D0
        elif method == "transferencia":
            tr = _d(data.transfer_amount) if data.transfer_amount else total
            if tr <= 0 or tr > total:
                raise HTTPException(400, "El monto transferido no puede superar el total ni ser 0.")
            sale.transfer_amount = tr
            sale.cash_amount = total - tr
        elif method == "mixto":
            cash = _d(data.cash_amount)
            tr = _d(data.transfer_amount)
            if cash < 0 or tr < 0:
                raise HTTPException(400, "Los montos no pueden ser negativos.")
            if cash + tr != total:
                raise HTTPException(400, "Efectivo + transferencia debe ser igual al total.")
            sale.cash_amount = cash
            sale.transfer_amount = tr
        else:
            raise HTTPException(400, "Forma de pago inválida.")
    else:
        raise HTTPException(400, "Estado de cobro inválido.")

    db.flush()
    _sync_transfers(sale, db)


def _sync_transfers(sale: OnlineSale, db: Session):
    """Asegura que las transferencias registradas sumen transfer_amount.
    Append-only: solo agrega la diferencia (ej: seña 30k + luego pago 70k).
    Nunca borra una transferencia ya registrada (preserva el Caso 5)."""
    target = _d(sale.transfer_amount)
    existing = sum((_d(t.amount) for t in sale.transfers), D0)
    delta = target - existing
    if delta > 0:
        ttype = "sena" if sale.payment_status == "senado" else "pago"
        db.add(OnlineTransfer(
            sale_id=sale.id, date=sale.date, amount=delta,
            type=ttype, reconciliation_status="pendiente",
        ))


# ═══════════════ Categorías ═══════════════
@router.get("/categories")
def list_categories(only_active: bool = False, db: Session = Depends(get_db)):
    _seed_categories(db)
    q = db.query(OnlineSaleCategory)
    if only_active:
        q = q.filter(OnlineSaleCategory.active == True)
    return [_cat(c) for c in q.order_by(OnlineSaleCategory.name).all()]


@router.post("/categories", status_code=201)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    c = OnlineSaleCategory(name=data.name.strip(), active=data.active)
    db.add(c); db.commit(); db.refresh(c)
    return _cat(c)


@router.put("/categories/{cat_id}")
def update_category(cat_id: int, data: CategoryIn, db: Session = Depends(get_db)):
    c = db.query(OnlineSaleCategory).filter(OnlineSaleCategory.id == cat_id).first()
    if not c:
        raise HTTPException(404, "Categoría no encontrada")
    c.name = data.name.strip()
    c.active = data.active
    db.commit(); db.refresh(c)
    return _cat(c)


# ═══════════════ Clientes ═══════════════
@router.get("/customers")
def list_customers(only_active: bool = False, db: Session = Depends(get_db)):
    q = db.query(OnlineCustomer)
    if only_active:
        q = q.filter(OnlineCustomer.active == True)
    return [_cust(c) for c in q.order_by(OnlineCustomer.name).all()]


@router.post("/customers", status_code=201)
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    c = OnlineCustomer(name=data.name.strip(), phone=data.phone or "", notes=data.notes or "", active=data.active)
    db.add(c); db.commit(); db.refresh(c)
    return _cust(c)


@router.put("/customers/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db)):
    c = db.query(OnlineCustomer).filter(OnlineCustomer.id == cid).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.name = data.name.strip(); c.phone = data.phone or ""
    c.notes = data.notes or ""; c.active = data.active
    db.commit(); db.refresh(c)
    return _cust(c)


@router.get("/customers/{cid}")
def customer_detail(cid: int, db: Session = Depends(get_db)):
    c = db.query(OnlineCustomer).filter(OnlineCustomer.id == cid).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    sales = db.query(OnlineSale).filter(OnlineSale.customer_id == cid).order_by(OnlineSale.date.desc(), OnlineSale.id.desc()).all()
    total_comprado = sum((_d(s.total) for s in sales), D0)
    ultima = sales[0].date.isoformat() if sales and sales[0].date else None
    return {
        **_cust(c),
        "cantidad_compras": len(sales),
        "total_comprado": float(total_comprado),
        "ultima_compra": ultima,
        "historial": [_sale(s) for s in sales],
    }


# ═══════════════ Ventas ═══════════════
@router.get("/sales")
def list_sales(
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    date_from: Optional[DateType] = None,
    date_to: Optional[DateType] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(OnlineSale)
    if status:      q = q.filter(OnlineSale.payment_status == status)
    if category_id: q = q.filter(OnlineSale.category_id == category_id)
    if customer_id: q = q.filter(OnlineSale.customer_id == customer_id)
    if date_from:   q = q.filter(OnlineSale.date >= date_from)
    if date_to:     q = q.filter(OnlineSale.date <= date_to)
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            (OnlineSale.sale_number.ilike(like)) |
            (OnlineSale.customer_name.ilike(like)) |
            (OnlineSale.description.ilike(like))
        )
    rows = q.order_by(OnlineSale.date.desc(), OnlineSale.id.desc()).all()
    return [_sale(s) for s in rows]


@router.get("/sales/{sale_id}")
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    s = db.query(OnlineSale).filter(OnlineSale.id == sale_id).first()
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    return _sale(s)


@router.post("/sales", status_code=201)
def create_sale(data: SaleIn, db: Session = Depends(get_db)):
    sale = OnlineSale(
        date=data.date or DateType.today(),
        customer_id=data.customer_id,
        customer_name=(data.customer_name or "").strip(),
        contact=data.contact or "",
        category_id=data.category_id,
        description=data.description or "",
        created_by=data.usuario or "",
        updated_by=data.usuario or "",
    )
    db.add(sale)
    db.flush()                                   # obtiene id
    sale.sale_number = f"VO-{sale.id:06d}"
    _apply_logic(sale, data, db)
    db.commit(); db.refresh(sale)
    return _sale(sale)


@router.put("/sales/{sale_id}")
def update_sale(sale_id: int, data: SaleIn, db: Session = Depends(get_db)):
    sale = db.query(OnlineSale).filter(OnlineSale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    sale.date = data.date or sale.date
    sale.customer_id = data.customer_id
    if data.customer_name is not None:
        sale.customer_name = (data.customer_name or "").strip()
    sale.contact = data.contact or ""
    sale.category_id = data.category_id
    sale.description = data.description or ""
    if data.usuario:
        sale.updated_by = data.usuario
    _apply_logic(sale, data, db)                 # recalcula y agrega transferencias faltantes
    db.commit(); db.refresh(sale)
    return _sale(sale)


@router.delete("/sales/{sale_id}", status_code=204)
def delete_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(OnlineSale).filter(OnlineSale.id == sale_id).first()
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    db.delete(sale)                              # cascade borra sus transferencias
    db.commit()


# ═══════════════ Transferencias ═══════════════
@router.get("/transfers")
def list_transfers(
    reconciliation_status: Optional[str] = None,
    date_from: Optional[DateType] = None,
    date_to: Optional[DateType] = None,
    db: Session = Depends(get_db),
):
    q = db.query(OnlineTransfer)
    if reconciliation_status:
        q = q.filter(OnlineTransfer.reconciliation_status == reconciliation_status)
    if date_from: q = q.filter(OnlineTransfer.date >= date_from)
    if date_to:   q = q.filter(OnlineTransfer.date <= date_to)
    rows = q.order_by(OnlineTransfer.date.desc(), OnlineTransfer.id.desc()).all()
    return [_transfer(t) for t in rows]


@router.put("/transfers/{tid}/reconcile")
def reconcile_transfer(tid: int, data: ReconcileIn, db: Session = Depends(get_db)):
    t = db.query(OnlineTransfer).filter(OnlineTransfer.id == tid).first()
    if not t:
        raise HTTPException(404, "Transferencia no encontrada")
    t.reconciliation_status = "controlada"
    t.reconciled_at = datetime.utcnow()
    t.reconciled_by = data.usuario or ""
    db.commit(); db.refresh(t)
    return _transfer(t)


@router.put("/transfers/{tid}/unreconcile")
def unreconcile_transfer(tid: int, db: Session = Depends(get_db)):
    t = db.query(OnlineTransfer).filter(OnlineTransfer.id == tid).first()
    if not t:
        raise HTTPException(404, "Transferencia no encontrada")
    t.reconciliation_status = "pendiente"
    t.reconciled_at = None
    t.reconciled_by = ""
    db.commit(); db.refresh(t)
    return _transfer(t)


# ═══════════════ Resumen (dashboard) ═══════════════
@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    hoy = DateType.today()
    ventas_hoy = db.query(OnlineSale).filter(OnlineSale.date == hoy).all()
    monto_hoy = sum((_d(s.total) for s in ventas_hoy), D0)

    cant_pendientes = db.query(OnlineSale).filter(OnlineSale.payment_status == "pendiente").count()
    cant_senadas    = db.query(OnlineSale).filter(OnlineSale.payment_status == "senado").count()
    cant_pagadas    = db.query(OnlineSale).filter(OnlineSale.payment_status == "pagado").count()

    transfers_hoy = db.query(OnlineTransfer).filter(OnlineTransfer.date == hoy).all()
    transfer_hoy = sum((_d(t.amount) for t in transfers_hoy), D0)
    senas_hoy = sum((_d(s.sena_amount) for s in ventas_hoy if s.payment_status == "senado"), D0)

    return {
        "ventas_hoy": len(ventas_hoy),
        "monto_hoy": float(monto_hoy),
        "cant_pendientes": cant_pendientes,
        "cant_senadas": cant_senadas,
        "cant_pagadas": cant_pagadas,
        "transfer_hoy": float(transfer_hoy),
        "senas_hoy": float(senas_hoy),
    }


# ═══════════════ Seed de categorías ═══════════════
_SEED_CATS = [
    "Productos a medida", "Cortes a medida", "Productos infantiles", "Listonería",
    "Molduras", "Marcos / Portarretratos", "Productos varios", "Artística",
    "Cortinería", "Muebles estándar", "Otros",
]


def _seed_categories(db: Session):
    if db.query(OnlineSaleCategory).first():
        return
    for name in _SEED_CATS:
        db.add(OnlineSaleCategory(name=name, active=True))
    db.commit()
