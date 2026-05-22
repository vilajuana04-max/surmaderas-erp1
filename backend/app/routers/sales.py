from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import date
import calendar

from app.database import get_db
from app.models import DailySales, Branch
from app.schemas import SaleCreate, SaleOut, SaleUpdate, MonthlySalesSummary
from app.services.calculations import month_to_number
from app.services.pdf_generator import generate_sales_pdf

router = APIRouter(prefix="/sales", tags=["Ventas"])

MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
          "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]


@router.get("/", response_model=list[SaleOut])
def list_sales(
    month:      Optional[str] = None,
    year:       Optional[int] = None,
    branch_id:  Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(DailySales)
    if month:
        q = q.filter(DailySales.month_label == month.upper())
    if year:
        q = q.filter(DailySales.year == year)
    if branch_id:
        q = q.filter(DailySales.branch_id == branch_id)
    sales = q.order_by(DailySales.sale_date, DailySales.branch_id).all()
    return [_enrich(s) for s in sales]


@router.post("/", response_model=SaleOut, status_code=201)
def create_or_update_sale(data: SaleCreate, db: Session = Depends(get_db)):
    month_label = data.month_label or MONTHS[data.sale_date.month - 1]
    year = data.year or data.sale_date.year

    existing = db.query(DailySales).filter(
        DailySales.sale_date == data.sale_date,
        DailySales.branch_id == data.branch_id
    ).first()

    if existing:
        existing.total_amount  = data.total_amount
        existing.card_payments = data.card_payments
        existing.ticket_count  = data.ticket_count
        db.commit()
        db.refresh(existing)
        return _enrich(existing)

    sale = DailySales(
        sale_date     = data.sale_date,
        branch_id     = data.branch_id,
        total_amount  = data.total_amount,
        card_payments = data.card_payments,
        ticket_count  = data.ticket_count,
        month_label   = month_label,
        year          = year,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return _enrich(sale)


@router.get("/summary/{year}/{month}", response_model=MonthlySalesSummary)
def monthly_summary(year: int, month: str, db: Session = Depends(get_db)):
    month = month.upper()
    sales = db.query(DailySales).filter(
        DailySales.year == year,
        DailySales.month_label == month
    ).all()

    luro   = [s for s in sales if s.branch_id == 1]
    indep  = [s for s in sales if s.branch_id == 2]

    def safe_sum(lst, field): return sum(float(getattr(s, field) or 0) for s in lst)
    def safe_int(lst, field): return sum(int(getattr(s, field) or 0) for s in lst)

    luro_total   = safe_sum(luro, "total_amount")
    indep_total  = safe_sum(indep, "total_amount")
    luro_tickets = safe_int(luro, "ticket_count")
    indep_tickets = safe_int(indep, "ticket_count")

    return MonthlySalesSummary(
        month         = month,
        year          = year,
        luro_total    = luro_total,
        indep_total   = indep_total,
        combined_total = luro_total + indep_total,
        luro_tickets  = luro_tickets,
        indep_tickets = indep_tickets,
        luro_avg_ticket  = round(luro_total / luro_tickets, 2) if luro_tickets else None,
        indep_avg_ticket = round(indep_total / indep_tickets, 2) if indep_tickets else None,
        days_with_data = len(set(s.sale_date for s in sales)),
    )


@router.post("/close-month/{year}/{month}")
def close_month(year: int, month: str, db: Session = Depends(get_db)):
    updated = db.query(DailySales).filter(
        DailySales.year == year,
        DailySales.month_label == month.upper(),
        DailySales.closed == False
    ).update({"closed": True})
    db.commit()
    return {"closed_records": updated, "month": month.upper(), "year": year}


@router.get("/pdf/{year}/{month}")
def sales_pdf(
    year: int, month: str,
    branch: str = Query("all", regex="^(all|luro|independencia)$"),
    db: Session = Depends(get_db)
):
    month = month.upper()
    q = db.query(DailySales).filter(
        DailySales.year == year,
        DailySales.month_label == month
    )
    if branch == "luro":
        q = q.filter(DailySales.branch_id == 1)
    elif branch == "independencia":
        q = q.filter(DailySales.branch_id == 2)

    sales = q.order_by(DailySales.sale_date, DailySales.branch_id).all()
    pdf   = generate_sales_pdf(sales, year, month, branch)

    filename = f"ventas-{month}-{year}-{branch}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _enrich(s: DailySales) -> dict:
    return {
        "id":           s.id,
        "sale_date":    s.sale_date,
        "branch_id":    s.branch_id,
        "branch_name":  s.branch.name if s.branch else None,
        "total_amount": s.total_amount,
        "card_payments":s.card_payments,
        "ticket_count": s.ticket_count,
        "avg_ticket":   s.avg_ticket,
        "month_label":  s.month_label,
        "year":         s.year,
        "closed":       s.closed,
    }
