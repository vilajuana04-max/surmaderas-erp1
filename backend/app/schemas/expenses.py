from pydantic import BaseModel
from datetime import date
from typing import Optional
from decimal import Decimal


class SharedExpenseOut(BaseModel):
    id:             int
    item_id:        int
    item_name:      Optional[str] = None
    category:       Optional[str] = None
    month:          str
    year:           int
    total_amount:   Optional[Decimal]
    luro_amount:    Optional[Decimal]
    due_date:       Optional[date]
    detail:         Optional[str]
    paid_status:    str

    model_config = {"from_attributes": True}


class SharedExpenseUpdate(BaseModel):
    total_amount:   Optional[Decimal] = None
    luro_amount:    Optional[Decimal] = None
    due_date:       Optional[date] = None
    detail:         Optional[str] = None
    paid_status:    Optional[str] = None


class ExpenseCategoryOut(BaseModel):
    id:         int
    name:       str
    parent_id:  Optional[int]

    model_config = {"from_attributes": True}


class LuroExpenseCreate(BaseModel):
    month:          Optional[str] = None
    year:           Optional[int] = None
    expense_date:   Optional[date] = None
    category_id:    int
    subcategory_id: Optional[int] = None
    detail:         Optional[str] = None
    amount:         Decimal
    payment_method: Optional[str] = None
    paid_status:    bool = False


class LuroExpenseOut(BaseModel):
    id:             int
    month:          Optional[str]
    year:           Optional[int]
    expense_date:   Optional[date]
    category_id:    int
    category_name:  Optional[str] = None
    subcategory_id: Optional[int]
    subcategory_name: Optional[str] = None
    detail:         Optional[str]
    amount:         Decimal
    payment_method: Optional[str]
    paid_status:    bool

    model_config = {"from_attributes": True}
