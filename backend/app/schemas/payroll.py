from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class PayrollItemCreate(BaseModel):
    employee_id:    int
    absences:       int = 0
    base_salary:    Optional[Decimal] = None
    bank_deposit:   Decimal = Decimal("0")
    advance:        Decimal = Decimal("0")
    plus_pct:       Decimal = Decimal("0")
    incentive:      Decimal = Decimal("0")


class PayrollItemOut(BaseModel):
    id:             int
    employee_id:    int
    employee_name:  Optional[str] = None
    absences:       int
    base_salary:    Optional[Decimal]
    bank_deposit:   Decimal
    advance:        Decimal
    plus_pct:       Decimal
    incentive:      Decimal
    plus_amount:    float
    gross_total:    float
    net_total:      float

    model_config = {"from_attributes": True}


class PayrollPeriodOut(BaseModel):
    id:         int
    month:      str
    year:       int
    branch_id:  int
    branch_name: Optional[str] = None
    status:     str
    items:      list[PayrollItemOut] = []

    model_config = {"from_attributes": True}
