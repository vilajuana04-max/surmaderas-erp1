from pydantic import BaseModel
from datetime import date
from typing import Optional


class VacationRecordOut(BaseModel):
    id:                 int
    year:               int
    employee_id:        int
    employee_name:      Optional[str] = None
    branch_name:        Optional[str] = None
    days_entitled:      Optional[int]
    days_taken:         int
    pending_prev_year:  int
    total_available:    int
    pending_current:    int
    description:        Optional[str]

    model_config = {"from_attributes": True}


class VacationLogCreate(BaseModel):
    year:           int
    employee_id:    int
    date_from:      date
    date_to:        date
    days:           int
    approved_by:    Optional[str] = None
    notes:          Optional[str] = None


class VacationLogOut(BaseModel):
    id:             int
    registered_date: Optional[date]
    year:           Optional[int]
    employee_id:    Optional[int]
    employee_name:  Optional[str] = None
    date_from:      Optional[date]
    date_to:        Optional[date]
    days:           Optional[int]
    status:         str
    approved_by:    Optional[str]
    notes:          Optional[str]

    model_config = {"from_attributes": True}
