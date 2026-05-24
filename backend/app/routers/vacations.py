from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import get_db
from app.models import VacationRecord, VacationLog, Employee
from app.schemas import VacationRecordOut, VacationLogCreate, VacationLogOut
from app.services.calculations import vacation_days_by_seniority
from app.services.pdf_generator import generate_vacations_pdf


class VacationRecordUpdate(BaseModel):
    days_taken:    int
    days_entitled: Optional[int] = None   # permite override manual, igual que Excel
    description:   Optional[str] = None

router = APIRouter(prefix="/vacations", tags=["Vacaciones"])


@router.get("/", response_model=list[VacationRecordOut])
def list_vacation_records(year: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(VacationRecord)
    if year:
        q = q.filter(VacationRecord.year == year)
    records = q.order_by(VacationRecord.employee_id).all()
    return [_enrich_record(r) for r in records]


@router.post("/init-year/{year}", status_code=201)
def init_year(year: int, db: Session = Depends(get_db)):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    created = 0
    for emp in employees:
        existing = db.query(VacationRecord).filter(
            VacationRecord.year == year,
            VacationRecord.employee_id == emp.id
        ).first()
        if existing:
            continue
        entitled = vacation_days_by_seniority(emp.hire_date, year)
        prev = db.query(VacationRecord).filter(
            VacationRecord.year == year - 1,
            VacationRecord.employee_id == emp.id
        ).first()
        pending_prev = prev.pending_current if prev else 0

        record = VacationRecord(
            year              = year,
            employee_id       = emp.id,
            days_entitled     = entitled,
            days_taken        = 0,
            pending_prev_year = pending_prev,
        )
        db.add(record)
        created += 1
    db.commit()
    return {"created": created, "year": year}


@router.put("/{record_id}")
def update_vacation_record(
    record_id: int,
    data: VacationRecordUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualiza un registro de vacaciones.
    Acepta days_taken (VAC. TOMADAS), days_entitled (VAC. CORRESPONDE, override manual)
    y description (DESCRIPCIÓN), igual que las celdas editables de la hoja Excel 2026.
    total_available y pending_current se recalculan automáticamente como propiedades.
    """
    record = db.query(VacationRecord).filter(VacationRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Registro no encontrado")
    record.days_taken  = data.days_taken
    record.description = data.description
    if data.days_entitled is not None:
        record.days_entitled = data.days_entitled
    db.commit()
    db.refresh(record)
    return _enrich_record(record)


@router.get("/log", response_model=list[VacationLogOut])
def list_log(year: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(VacationLog)
    if year:
        q = q.filter(VacationLog.year == year)
    logs = q.order_by(VacationLog.registered_date.desc()).all()
    return [_enrich_log(l) for l in logs]


@router.post("/log", response_model=VacationLogOut, status_code=201)
def create_log(data: VacationLogCreate, db: Session = Depends(get_db)):
    log = VacationLog(
        registered_date = date.today(),
        year            = data.year,
        employee_id     = data.employee_id,
        date_from       = data.date_from,
        date_to         = data.date_to,
        days            = data.days,
        status          = "Pendiente",
        approved_by     = data.approved_by,
        notes           = data.notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _enrich_log(log)


@router.put("/log/{log_id}/approve")
def approve_log(log_id: int, approved_by: str, db: Session = Depends(get_db)):
    log = db.query(VacationLog).filter(VacationLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Registro no encontrado")
    log.status      = "Aprobado"
    log.approved_by = approved_by
    db.commit()
    return {"status": "Aprobado"}


@router.get("/pdf/{year}")
def export_pdf(year: int, db: Session = Depends(get_db)):
    records = db.query(VacationRecord).filter(VacationRecord.year == year).all()
    pdf_bytes = generate_vacations_pdf(records, year)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=vacaciones_{year}.pdf"}
    )


def _enrich_record(r: VacationRecord) -> dict:
    return {
        "id":               r.id,
        "year":             r.year,
        "employee_id":      r.employee_id,
        "employee_name":    r.employee.name if r.employee else None,
        "branch_name":      r.employee.branch.name if r.employee and r.employee.branch else None,
        "days_entitled":    r.days_entitled,
        "days_taken":       r.days_taken,
        "pending_prev_year": r.pending_prev_year,
        "total_available":  r.total_available,
        "pending_current":  r.pending_current,
        "description":      r.description,
    }


def _enrich_log(l: VacationLog) -> dict:
    return {
        "id":             l.id,
        "registered_date": l.registered_date,
        "year":           l.year,
        "employee_id":    l.employee_id,
        "employee_name":  l.employee.name if l.employee else None,
        "date_from":      l.date_from,
        "date_to":        l.date_to,
        "days":           l.days,
        "status":         l.status,
        "approved_by":    l.approved_by,
        "notes":          l.notes,
    }
