from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models import Employee
from app.schemas import EmployeeOut
from app.services.calculations import months_since_hire, vacation_days_today

router = APIRouter(prefix="/employees", tags=["Empleados"])


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
    result = []
    for emp in employees:
        months = months_since_hire(emp.hire_date)
        result.append({
            "id":                     emp.id,
            "name":                   emp.name,
            "branch_id":              emp.branch_id,
            "branch_name":            emp.branch.name if emp.branch else None,
            "hire_date":              emp.hire_date,
            "is_active":              emp.is_active,
            "months_of_service":      months,
            "years_of_service":       round(months / 12, 4),   # D = C/12
            "vacation_days_entitled": vacation_days_today(emp.hire_date),
        })
    return result
