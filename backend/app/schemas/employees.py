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
    months_of_service:      Optional[int]   = None   # ROUNDDOWN(YEARFRAC*12, 0) — col C Excel
    years_of_service:       Optional[float] = None   # months/12 — col D Excel
    vacation_days_entitled: Optional[int]   = None   # IF(años<5,14,IF(años<10,21,28))

    model_config = {"from_attributes": True}
