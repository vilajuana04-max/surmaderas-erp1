from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models import Employee
from app.schemas import EmployeeOut
from app.schemas.employees import EmployeeCreate, EmployeeUpdate
from app.services.calculations import months_since_hire, vacation_days_today

router = APIRouter(prefix="/employees", tags=["Empleados"])


def _enrich_employee(emp: Employee) -> dict:
    """Returns a full dict with computed fields for an employee."""
    months = months_since_hire(emp.hire_date)
    return {
        "id":                     emp.id,
        "name":                   emp.name,
        "branch_id":              emp.branch_id,
        "branch_name":            emp.branch.name if emp.branch else None,
        "hire_date":              emp.hire_date,
        "is_active":              emp.is_active,
        "months_of_service":      months,
        "years_of_service":       round(months / 12, 4),
        "vacation_days_entitled": vacation_days_today(emp.hire_date),
        "cuil":                   emp.cuil,
        "position":               emp.position,
        "phone":                  emp.phone,
        "email_address":          emp.email_address,
        "payroll_type":           emp.payroll_type,
        "default_plus_pct":       emp.default_plus_pct,
        "notes":                  emp.notes,
    }


@router.get("/", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    """
    Lista empleados activos con cálculos de antigüedad equivalentes a las
    fórmulas Excel de la hoja EMPLEADOS:
      Columna C = ROUNDDOWN(YEARFRAC(hire_date, TODAY())*12, 0)  → months_of_service
      Columna D = C/12                                            → years_of_service
      Columna E = IF(D<5, 14, IF(D<10, 21, 28))                  → vacation_days_entitled
    """
    employees = (
        db.query(Employee)
        .filter(Employee.is_active == True)
        .order_by(Employee.branch_id, Employee.name)
        .all()
    )
    return [_enrich_employee(emp) for emp in employees]


@router.get("/all", response_model=list[EmployeeOut])
def list_all_employees(db: Session = Depends(get_db)):
    """Returns active AND inactive employees."""
    employees = (
        db.query(Employee)
        .order_by(Employee.branch_id, Employee.name)
        .all()
    )
    return [_enrich_employee(emp) for emp in employees]


@router.post("/", status_code=201, response_model=EmployeeOut)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _enrich_employee(emp)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    for field, value in data.model_dump().items():
        setattr(emp, field, value)
    db.commit()
    db.refresh(emp)
    return _enrich_employee(emp)


@router.delete("/{employee_id}")
def deactivate_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    emp.is_active = False
    db.commit()
    return {"status": "deactivated", "id": employee_id}
