from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import PayrollPeriod, PayrollItem, Employee, Branch
from app.schemas import PayrollItemCreate, PayrollItemOut, PayrollPeriodOut
# Los imports de PDF son lazy (dentro de cada función) para que un fallo
# de WeasyPrint no rompa todo el router de sueldos.

router = APIRouter(prefix="/payroll", tags=["Sueldos"])


@router.get("/version")
def payroll_version():
    return {"version": "v10-debug", "ok": True}


# ── Períodos ─────────────────────────────────────────────────────────────────

@router.get("/periods")
def list_periods(
    year:      Optional[int] = None,
    branch_id: Optional[int] = None,
    month:     Optional[str] = None,
    db: Session = Depends(get_db)
):
    import traceback
    try:
        if month and year:
            for bid in [1, 2]:
                try:
                    _get_or_create_period(month, year, bid, db)
                except Exception as e:
                    try: db.rollback()
                    except: pass

        q = db.query(PayrollPeriod)
        if year:
            q = q.filter(PayrollPeriod.year == year)
        if branch_id:
            q = q.filter(PayrollPeriod.branch_id == branch_id)
        periods = q.order_by(PayrollPeriod.year, PayrollPeriod.month).all()
        return [_enrich_period(p) for p in periods]
    except Exception as e:
        raise HTTPException(status_code=500,
            detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-600:]}")


@router.get("/periods/ensure")
def ensure_period(month: str, year: int, branch_id: int, db: Session = Depends(get_db)):
    """GET que crea el período si no existe (evita preflight CORS de POST)."""
    return _get_or_create_period(month, year, branch_id, db)


def _get_or_create_period(month: str, year: int, branch_id: int, db):
    existing = db.query(PayrollPeriod).filter(
        PayrollPeriod.month     == month.upper(),
        PayrollPeriod.year      == year,
        PayrollPeriod.branch_id == branch_id
    ).first()
    if existing:
        return _enrich_period(existing)

    period = PayrollPeriod(month=month.upper(), year=year, branch_id=branch_id)
    db.add(period)
    db.flush()

    employees = db.query(Employee).filter(
        Employee.branch_id == branch_id,
        Employee.is_active  == True
    ).all()
    for emp in employees:
        item = PayrollItem(period_id=period.id, employee_id=emp.id)
        db.add(item)

    db.commit()
    db.refresh(period)
    return _enrich_period(period)


@router.post("/periods", status_code=201)
def create_period(month: str, year: int, branch_id: int, db: Session = Depends(get_db)):
    return _get_or_create_period(month, year, branch_id, db)


@router.post("/periods/{period_id}/close")
def close_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayrollPeriod).filter(PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    period.status = "CLOSED"
    db.commit()
    return {"status": "CLOSED", "period_id": period_id}


# ── Items (filas de empleado) ─────────────────────────────────────────────────

@router.put("/items/{item_id}", response_model=PayrollItemOut)
def update_payroll_item(item_id: int, data: PayrollItemCreate, db: Session = Depends(get_db)):
    item = db.query(PayrollItem).filter(PayrollItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Registro de sueldo no encontrado")

    item.inasistencias_desc = data.inasistencias_desc
    item.adelanto           = data.adelanto
    item.deposito_banco     = data.deposito_banco
    item.horas              = data.horas
    item.precio_hora        = data.precio_hora
    item.plus_factor        = data.plus_factor
    item.bruto_manual       = data.bruto_manual
    item.comision           = data.comision
    item.comision_desc      = data.comision_desc
    item.es_base            = data.es_base
    item.sin_dep            = data.sin_dep

    db.commit()
    db.refresh(item)
    return _enrich_item(item)


# ── PDFs ──────────────────────────────────────────────────────────────────────

@router.get("/items/{item_id}/payslip")
def export_single_payslip(item_id: int, db: Session = Depends(get_db)):
    """Exporta el recibo individual de un empleado."""
    item = db.query(PayrollItem).filter(PayrollItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    period = item.period
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    from app.services.pdf_generator import generate_single_payslip_pdf
    pdf_bytes = generate_single_payslip_pdf(item, period)
    safe_name = (item.employee.name or "empleado").replace(", ", "_").replace(" ", "_")
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=recibo_{safe_name}_{period.month}_{period.year}.pdf"}
    )


@router.get("/periods/{period_id}/pdf")
def export_payroll_pdf(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayrollPeriod).filter(PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    from app.services.pdf_generator import generate_payroll_pdf
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
    from app.services.pdf_generator import generate_payslips_pdf
    pdf_bytes = generate_payslips_pdf(period)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=recibos_{period.month}_{period.year}.pdf"}
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        "id":                 i.id,
        "employee_id":        i.employee_id,
        "employee_name":      i.employee.name if i.employee else None,
        "inasistencias_desc": i.inasistencias_desc,
        "adelanto":           i.adelanto,
        "deposito_banco":     i.deposito_banco,
        "horas":              i.horas,
        "precio_hora":        i.precio_hora,
        "plus_factor":        i.plus_factor,
        "bruto_manual":       i.bruto_manual,
        "comision":           i.comision,
        "comision_desc":      i.comision_desc,
        "es_base":            bool(i.es_base),
        "sin_dep":            bool(i.sin_dep),
        # Calculados
        "total_bruto":       i.total_bruto,
        "plus_pesos":        i.plus_pesos,
        "total_percibido":   i.total_percibido,
    }
