from pydantic import BaseModel
from datetime import date
from typing import Optional
from decimal import Decimal


class SaleCreate(BaseModel):
    sale_date:      date
    branch_id:      int
    total_amount:   Optional[Decimal] = None
    card_payments:  Optional[Decimal] = None
    ticket_count:   Optional[int] = None
    month_label:    Optional[str] = None
    year:           Optional[int] = None


class SaleUpdate(BaseModel):
    total_amount:   Optional[Decimal] = None
    card_payments:  Optional[Decimal] = None
    ticket_count:   Optional[int] = None


class SaleOut(BaseModel):
    id:             int
    sale_date:      date
    branch_id:      int
    branch_name:    Optional[str] = None
    total_amount:   Optional[Decimal]
    card_payments:  Optional[Decimal]
    ticket_count:   Optional[int]
    avg_ticket:     Optional[float]
    month_label:    Optional[str]
    year:           Optional[int]
    closed:         bool

    model_config = {"from_attributes": True}


class MonthlySalesSummary(BaseModel):
    month:              str
    year:               int
    luro_total:         float
    indep_total:        float
    combined_total:     float
    luro_tickets:       int
    indep_tickets:      int
    luro_avg_ticket:    Optional[float]
    indep_avg_ticket:   Optional[float]
    days_with_data:     int
