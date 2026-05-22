from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database import get_db
from app.models import Provider, Purchase
from app.schemas import PurchaseCreate, PurchaseOut, ProviderOut, PurchaseSummary
from app.services.pdf_generator import generate_purchases_pdf

router = APIRouter(prefix="/purchases", tags=["Compras"])


@router.get("/", response_model=list[PurchaseOut])
def list_purchases(
    month:      Optional[str] = None,
    year:       Optional[int] = None,
    provider:   Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Purchase)
    if month:
        q = q.filter(Purchase.month_label == month.upper())
    if year:
        q = q.filter(Purchase.year == year)
    if provider:
        q = q.join(Provider).filter(Provider.name.ilike(f"%{provider}%"))
    purchases = q.order_by(Purchase.purchase_date.desc()).all()
    return [_enrich(p) for p in purchases]


@router.post("/", response_model=PurchaseOut, status_code=201)
def create_purchase(data: PurchaseCreate, db: Session = Depends(get_db)):
    provider = db.query(Provider).filter(
        Provider.name == data.provider_name.upper()
    ).first()
    if not provider:
        provider = Provider(name=data.provider_name.upper())
        db.add(provider)
        db.flush()

    month_label = data.month_label
    year = data.year
    if data.purchase_date and not month_label:
        MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
        month_label = MONTHS[data.purchase_date.month - 1]
        year = data.purchase_date.year

    flag = None
    if float(data.total_amount) < 0:
        flag = "NC"
    elif not data.purchase_date:
        flag = "SIN_FECHA"

    purchase = Purchase(
        purchase_date  = data.purchase_date,
        invoice_number = data.invoice_number,
        provider_id    = provider.id,
        total_amount   = data.total_amount,
        flag           = flag,
        month_label    = month_label,
        year           = year,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return _enrich(purchase)


@router.delete("/{purchase_id}", status_code=204)
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    p = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not p:
        raise HTTPException(404, "Factura no encontrada")
    db.delete(p)
    db.commit()


@router.get("/summary/{year}/{month}", response_model=list[PurchaseSummary])
def provider_summary(year: int, month: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Provider.name, func.sum(Purchase.total_amount), func.count(Purchase.id))
        .join(Purchase)
        .filter(Purchase.year == year, Purchase.month_label == month.upper())
        .group_by(Provider.name)
        .order_by(func.sum(Purchase.total_amount).desc())
        .all()
    )
    grand_total = sum(float(r[1]) for r in rows if float(r[1]) > 0)
    return [
        PurchaseSummary(
            provider_name = r[0],
            total         = float(r[1]),
            percentage    = round(float(r[1]) / grand_total * 100, 1) if grand_total else 0,
            count         = r[2],
        )
        for r in rows
    ]


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db)):
    return db.query(Provider).order_by(Provider.name).all()


@router.get("/pdf/{year}/{month}")
def export_pdf(year: int, month: str, db: Session = Depends(get_db)):
    purchases = db.query(Purchase).filter(
        Purchase.year == year,
        Purchase.month_label == month.upper()
    ).order_by(Purchase.purchase_date).all()
    pdf_bytes = generate_purchases_pdf(purchases, month.upper(), year)
    return Response(
        content   = pdf_bytes,
        media_type = "application/pdf",
        headers   = {"Content-Disposition": f"attachment; filename=compras_{month}_{year}.pdf"}
    )


@router.post("/close-month/{year}/{month}")
def close_month(year: int, month: str, db: Session = Depends(get_db)):
    updated = db.query(Purchase).filter(
        Purchase.year == year,
        Purchase.month_label == month.upper(),
        Purchase.closed == False
    ).update({"closed": True})
    db.commit()
    return {"closed_records": updated}


def _enrich(p: Purchase) -> dict:
    return {
        "id":             p.id,
        "purchase_date":  p.purchase_date,
        "invoice_number": p.invoice_number,
        "provider_id":    p.provider_id,
        "provider_name":  p.provider.name if p.provider else None,
        "total_amount":   p.total_amount,
        "flag":           p.flag,
        "month_label":    p.month_label,
        "year":           p.year,
        "closed":         p.closed,
    }
