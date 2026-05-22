from pydantic import BaseModel
from datetime import date
from typing import Optional


class EmployeeOut(BaseModel):
    id:             int
    name:           str
    branch_id:      Optional[int]
    branch_name:    Optional[str] = None
    hire_date:      date
    is_active:      bool
    years_of_service: Optional[float] = None
    vacation_days_entitled: Optional[int] = None

    model_config = {"from_attributes": True}
