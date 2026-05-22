from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date

from app.database import get_db
from app.models import Employee
from app.schemas import EmployeeOut
from app.services.calculations import vacation_days_by_seniority

router = APIRouter(prefix="/employees", tags=["Empleados"])


@router.get("/", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.branch_id, Employee.name).all()
    today = date.today()
    result = []
    for emp in employees:
        years = (today - emp.hire_date).days / 365.25
        result.append({
            "id":                    emp.id,
            "name":                  emp.name,
            "branch_id":             emp.branch_id,
            "branch_name":           emp.branch.name if emp.branch else None,
            "hire_date":             emp.hire_date,
            "is_active":             emp.is_active,
            "years_of_service":      round(years, 2),
            "vacation_days_entitled": vacation_days_by_seniority(emp.hire_date, today.year),
        })
    return result
