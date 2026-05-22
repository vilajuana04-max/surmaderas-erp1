from pydantic import BaseModel
from datetime import date
from typing import Optional
from decimal import Decimal


class PurchaseCreate(BaseModel):
    purchase_date:  Optional[date] = None
    invoice_number: Optional[str] = None
    provider_name:  str
    total_amount:   Decimal
    month_label:    Optional[str] = None
    year:           Optional[int] = None


class PurchaseOut(BaseModel):
    id:             int
    purchase_date:  Optional[date]
    invoice_number: Optional[str]
    provider_id:    Optional[int]
    provider_name:  Optional[str] = None
    total_amount:   Decimal
    flag:           Optional[str]
    month_label:    Optional[str]
    year:           Optional[int]
    closed:         bool

    model_config = {"from_attributes": True}


class ProviderOut(BaseModel):
    id:     int
    name:   str
    total:  Optional[float] = None
    count:  Optional[int] = None

    model_config = {"from_attributes": True}


class PurchaseSummary(BaseModel):
    provider_name:  str
    total:          float
    percentage:     float
    count:          int
