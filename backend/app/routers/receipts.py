import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import PayslipUpload, Employee

router = APIRouter(prefix="/receipts", tags=["Recibos"])


@router.get("/")
def list_receipts(
    year:  int,
    month: str,
    db: Session = Depends(get_db)
):
    rows = (
        db.query(PayslipUpload)
        .filter(PayslipUpload.year == year, PayslipUpload.month == month.upper())
        .order_by(PayslipUpload.employee_id)
        .all()
    )
    return [_out(r) for r in rows]


@router.post("/upload", status_code=201)
async def upload_receipt(
    employee_id: int      = Form(...),
    year:        int      = Form(...),
    month:       str      = Form(...),
    file: UploadFile      = File(...),
    db: Session           = Depends(get_db),
):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:   # 10 MB limit
        raise HTTPException(400, "El archivo supera los 10 MB")

    b64 = base64.b64encode(content).decode("utf-8")

    # Replace existing for same employee/period
    existing = db.query(PayslipUpload).filter(
        PayslipUpload.employee_id == employee_id,
        PayslipUpload.year        == year,
        PayslipUpload.month       == month.upper(),
    ).first()
    if existing:
        db.delete(existing)

    rec = PayslipUpload(
        employee_id = employee_id,
        year        = year,
        month       = month.upper(),
        filename    = file.filename or f"recibo_{month}_{year}.pdf",
        file_data   = b64,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _out(rec)


@router.get("/{receipt_id}/download")
def download_receipt(receipt_id: int, db: Session = Depends(get_db)):
    rec = db.query(PayslipUpload).filter(PayslipUpload.id == receipt_id).first()
    if not rec:
        raise HTTPException(404, "Recibo no encontrado")
    content = base64.b64decode(rec.file_data)
    return Response(
        content    = content,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename={rec.filename}"},
    )


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    rec = db.query(PayslipUpload).filter(PayslipUpload.id == receipt_id).first()
    if not rec:
        raise HTTPException(404, "Recibo no encontrado")
    db.delete(rec)
    db.commit()


def _out(r: PayslipUpload) -> dict:
    return {
        "id":            r.id,
        "employee_id":   r.employee_id,
        "employee_name": r.employee.name if r.employee else "—",
        "branch_name":   r.employee.branch.name if r.employee and r.employee.branch else "—",
        "year":          r.year,
        "month":         r.month,
        "filename":      r.filename,
        "uploaded_at":   r.uploaded_at.isoformat() if r.uploaded_at else None,
    }
