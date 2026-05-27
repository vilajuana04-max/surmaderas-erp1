from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database import get_db
from app.models import SharedExpenseItem, SharedExpense, ExpenseCategory, LuroExpense
from app.schemas import (SharedExpenseOut, SharedExpenseUpdate,
                          SharedExpenseItemOut, SharedExpenseItemCreate, SharedExpenseItemUpdate,
                          LuroExpenseCreate, LuroExpenseOut, ExpenseCategoryOut)
from app.services.pdf_generator import generate_shared_expenses_pdf, generate_luro_expenses_pdf

router = APIRouter(prefix="/expenses", tags=["Gastos"])


# ─── Catálogo de Items Compartidos ────────────────────────────

@router.get("/shared/items", response_model=list[SharedExpenseItemOut])
def list_shared_items(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(SharedExpenseItem)
    if not include_inactive:
        q = q.filter(SharedExpenseItem.is_active == True)
    return q.order_by(SharedExpenseItem.category, SharedExpenseItem.name).all()


@router.post("/shared/items", response_model=SharedExpenseItemOut, status_code=201)
def create_shared_item(data: SharedExpenseItemCreate, db: Session = Depends(get_db)):
    existing = db.query(SharedExpenseItem).filter(SharedExpenseItem.name == data.name).first()
    if existing:
        existing.is_active = True
        if data.category:
            existing.category = data.category
        db.commit()
        db.refresh(existing)
        return existing
    item = SharedExpenseItem(name=data.name, category=data.category, is_active=True)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/shared/items/{item_id}", response_model=SharedExpenseItemOut)
def update_shared_item(item_id: int, data: SharedExpenseItemUpdate, db: Session = Depends(get_db)):
    item = db.query(SharedExpenseItem).filter(SharedExpenseItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    if data.name is not None:
        item.name = data.name
    if data.category is not None:
        item.category = data.category
    if data.is_active is not None:
        item.is_active = data.is_active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/shared/items/{item_id}", status_code=204)
def delete_shared_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(SharedExpenseItem).filter(SharedExpenseItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    item.is_active = False
    db.commit()


# ─── Gastos Compartidos ───────────────────────────────────────

@router.get("/shared/{year}/{month}", response_model=list[SharedExpenseOut])
def get_shared_expenses(year: int, month: str, db: Session = Depends(get_db)):
    items = db.query(SharedExpenseItem).filter(SharedExpenseItem.is_active == True).all()
    result = []
    for item in items:
        expense = db.query(SharedExpense).filter(
            SharedExpense.item_id == item.id,
            SharedExpense.year    == year,
            SharedExpense.month   == month.upper()
        ).first()
        if not expense:
            expense = SharedExpense(
                item_id     = item.id,
                month       = month.upper(),
                year        = year,
                total_amount = None,
                luro_amount  = None,
                paid_status  = "NO",
            )
            db.add(expense)
            db.flush()
        result.append(_enrich_shared(expense, item))
    db.commit()
    return result


@router.put("/shared/{expense_id}", response_model=SharedExpenseOut)
def update_shared_expense(expense_id: int, data: SharedExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(SharedExpense).filter(SharedExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Gasto no encontrado")

    if data.total_amount is not None:
        expense.total_amount = data.total_amount
        expense.luro_amount  = round(float(data.total_amount) / 2, 2)
    if data.luro_amount is not None:
        expense.luro_amount = data.luro_amount
    if data.due_date is not None:
        expense.due_date = data.due_date
    if data.detail is not None:
        expense.detail = data.detail
    if data.paid_status is not None:
        expense.paid_status = data.paid_status

    db.commit()
    db.refresh(expense)
    return _enrich_shared(expense, expense.item)


@router.get("/shared/{year}/{month}/pdf")
def export_shared_pdf(year: int, month: str, db: Session = Depends(get_db)):
    expenses = db.query(SharedExpense).filter(
        SharedExpense.year == year,
        SharedExpense.month == month.upper()
    ).all()
    pdf_bytes = generate_shared_expenses_pdf(expenses, month.upper(), year)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=gastos_compartidos_{month}_{year}.pdf"}
    )


# ─── Gastos Luro ─────────────────────────────────────────────

@router.get("/luro", response_model=list[LuroExpenseOut])
def list_luro_expenses(
    year:       Optional[int] = None,
    month:      Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(LuroExpense)
    if year:
        q = q.filter(LuroExpense.year == year)
    if month:
        q = q.filter(LuroExpense.month == month.upper())
    if category_id:
        q = q.filter(LuroExpense.category_id == category_id)
    expenses = q.order_by(LuroExpense.expense_date.desc()).all()
    return [_enrich_luro(e) for e in expenses]


@router.post("/luro", response_model=LuroExpenseOut, status_code=201)
def create_luro_expense(data: LuroExpenseCreate, db: Session = Depends(get_db)):
    MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
              "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
    month = data.month
    year  = data.year
    if data.expense_date and not month:
        month = MONTHS[data.expense_date.month - 1]
        year  = data.expense_date.year

    expense = LuroExpense(
        month          = month,
        year           = year,
        expense_date   = data.expense_date,
        category_id    = data.category_id,
        subcategory_id = data.subcategory_id,
        detail         = data.detail,
        amount         = data.amount,
        payment_method = data.payment_method,
        paid_status    = data.paid_status,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _enrich_luro(expense)


@router.delete("/luro/{expense_id}", status_code=204)
def delete_luro_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(LuroExpense).filter(LuroExpense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Gasto no encontrado")
    db.delete(e)
    db.commit()


@router.get("/luro/report/{year}", response_model=list[dict])
def luro_annual_report(year: int, db: Session = Depends(get_db)):
    MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
              "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
    cats = db.query(ExpenseCategory).filter(ExpenseCategory.parent_id == None).all()
    result = []
    for cat in cats:
        row = {"category": cat.name, "total": 0, "months": {}}
        for m in MONTHS:
            total = db.query(func.sum(LuroExpense.amount)).filter(
                LuroExpense.year == year,
                LuroExpense.month == m,
                LuroExpense.category_id == cat.id
            ).scalar() or 0
            row["months"][m] = float(total)
            row["total"] += float(total)
        result.append(row)
    return result


@router.get("/categories", response_model=list[ExpenseCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(ExpenseCategory).order_by(ExpenseCategory.name).all()


@router.get("/luro/pdf/{year}/{month}")
def export_luro_pdf(year: int, month: str, db: Session = Depends(get_db)):
    expenses = db.query(LuroExpense).filter(
        LuroExpense.year == year,
        LuroExpense.month == month.upper()
    ).order_by(LuroExpense.expense_date).all()
    pdf_bytes = generate_luro_expenses_pdf(expenses, month.upper(), year)
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename=gastos_luro_{month}_{year}.pdf"}
    )


def _enrich_shared(e: SharedExpense, item: SharedExpenseItem) -> dict:
    return {
        "id":           e.id,
        "item_id":      item.id,
        "item_name":    item.name,
        "category":     item.category,
        "month":        e.month,
        "year":         e.year,
        "total_amount": e.total_amount,
        "luro_amount":  e.luro_amount,
        "due_date":     e.due_date,
        "detail":       e.detail,
        "paid_status":  e.paid_status,
    }


def _enrich_luro(e: LuroExpense) -> dict:
    return {
        "id":               e.id,
        "month":            e.month,
        "year":             e.year,
        "expense_date":     e.expense_date,
        "category_id":      e.category_id,
        "category_name":    e.category.name if e.category else None,
        "subcategory_id":   e.subcategory_id,
        "subcategory_name": e.subcategory.name if e.subcategory else None,
        "detail":           e.detail,
        "amount":           e.amount,
        "payment_method":   e.payment_method,
        "paid_status":      e.paid_status,
    }
