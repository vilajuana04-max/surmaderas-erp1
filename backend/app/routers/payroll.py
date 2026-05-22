from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import PayrollPeriod, PayrollItem, Employee, Branch
from app.schemas import PayrollItemCreate, PayrollItemOut, PayrollPeriodOut
from app.services.pdf_generator import generate_payroll_pdf, generate_payslips_pdf

router = APIRouter(prefix="/payroll", tags=["Sueldos"])


@router.get("/periods", response_model=list[PayrollPeriodOut])
def list_periods(
    year:       Optional[int] = None,
    branch_id:  Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(PayrollPeriod)
    if year:
        q = q.filter(PayrollPeriod.year == year)
    if branch_id:
        q = q.filter(PayrollPeriod.branch_id == branch_id)
    periods = q.order_by(PayrollPeriod.year, PayrollPeriod.month).all()
    return [_enrich_period(p) for p in periods]


@router.post("/periods", status_code=201)
def create_period(month: str, year: int, branch_id: int, db: Session = Depends(get_db)):
    existing = db.query(PayrollPeriod).filter(
        PayrollPeriod.month == month.upper(),
        PayrollPeriod.year  == year,
        PayrollPeriod.branch_id == branch_id
    ).first()
    if existing:
        return _enrich_period(existing)

    period = PayrollPeriod(month=month.upper(), year=year, branch_id=branch_id)
    db.add(period)
    db.flush()

    employees = db.query(Employee).filter(
        Employee.branch_id == branch_id,
        Employee.is_active == True
    ).all()
    for emp in employees:
        item = PayrollItem(period_id=period.id, employee_id=emp.id)
        db.add(item)

    db.commit()
    db.refresh(period)
    return _enrich_period(period)


@router.put("/items/{item_id}", response_model=PayrollItemOut)
def update_payroll_item(item_id: int, data: PayrollItemCreate, db: Session = Depends(get_db)):
    item = db.query(PayrollItem).filter(PayrollItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Registro de sueldo no encontrado")

    item.absences     = data.absences
    item.base_salary  = data.base_salary
    item.bank_deposit = data.bank_deposit
    item.advance      = data.advance
    item.plus_pct     = data.plus_pct
    item.incentive    = data.incentive
    db.commit()
    db.refresh(item)
    return _enrich_item(item)


@router.post("/periods/{period_id}/close")
def close_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayrollPeriod).filter(PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    period.status = "CLOSED"
    db.commit()
    return {"status": "CLOSED", "period_id": period_id}


@router.get("/periods/{period_id}/pdf")
def export_payroll_pdf(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayrollPeriod).filter(PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    pdf_bytes = generate_payroll_pdf(period)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=sueldos_{period.month}_{period.year}.pdf"}
    )


@router.get("/periods/{period_id}/payslips")
def export_payslips(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayrollPeriod).filter(PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    pdf_bytes = generate_payslips_pdf(period)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=recibos_{period.month}_{period.year}.pdf"}
    )


def _enrich_period(p: PayrollPeriod) -> dict:
    return {
        "id":          p.id,
        "month":       p.month,
        "year":        p.year,
        "branch_id":   p.branch_id,
        "branch_name": p.branch.name if p.branch else None,
        "status":      p.status,
        "items":       [_enrich_item(i) for i in p.items],
    }


def _enrich_item(i: PayrollItem) -> dict:
    return {
        "id":            i.id,
        "employee_id":   i.employee_id,
        "employee_name": i.employee.name if i.employee else None,
        "absences":      i.absences,
        "base_salary":   i.base_salary,
        "bank_deposit":  i.bank_deposit,
        "advance":       i.advance,
        "plus_pct":      i.plus_pct,
        "incentive":     i.incentive,
        "plus_amount":   i.plus_amount,
        "gross_total":   i.gross_total,
        "net_total":     i.net_total,
    }
