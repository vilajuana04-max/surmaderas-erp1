from pydantic import BaseModel
from datetime import date
from typing import Optional
from decimal import Decimal


class SharedExpenseItemOut(BaseModel):
    id:         int
    name:       str
    category:   Optional[str] = None
    is_active:  bool

    model_config = {"from_attributes": True}


class SharedExpenseItemCreate(BaseModel):
    name:     str
    category: Optional[str] = None


class SharedExpenseItemUpdate(BaseModel):
    name:      Optional[str]  = None
    category:  Optional[str]  = None
    is_active: Optional[bool] = None


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
    month:          Optional[str]  = None
    year:           Optional[int]  = None
    expense_date:   Optional[date] = None
    categoria:      str
    subcategoria:   Optional[str]  = None
    detail:         Optional[str]  = None
    amount:         Decimal
    payment_method: Optional[str]  = None
    pagado:         str = 'NO'


class LuroExpenseOut(BaseModel):
    id:             int
    month:          Optional[str]
    year:           Optional[int]
    expense_date:   Optional[date]
    categoria:      Optional[str]
    subcategoria:   Optional[str]
    detail:         Optional[str]
    amount:         Decimal
    payment_method: Optional[str]
    pagado:         Optional[str]

    model_config = {"from_attributes": True}
