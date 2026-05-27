from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.database import get_db
from app.models import SharedExpenseItem, SharedExpense, ExpenseCategory, LuroExpense, GastoCompartido
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


@router.post("/shared/items/seed-defaults", status_code=201)
def seed_default_items(db: Session = Depends(get_db)):
    """Carga los items predeterminados de la planilla de gastos compartidos."""
    DEFAULTS = [
        ("Luz / Energía Eléctrica",     "Servicios"),
        ("Gas",                          "Servicios"),
        ("Agua",                         "Servicios"),
        ("Internet",                     "Servicios"),
        ("Teléfono",                     "Servicios"),
        ("Alarma",                       "Seguridad"),
        ("Seguro",                       "Seguridad"),
        ("Expensas",                     "Edificio"),
        ("Alquiler",                     "Edificio"),
        ("Contador / Estudio Contable",  "Administración"),
        ("Monotributo / AFIP",           "Administración"),
        ("INACAP",                       "Gestión de empleados"),
        ("Sueldo Avila Alejandro",       "Personal Independencia"),
        ("Sueldo Salinas Adrian",        "Personal Independencia"),
        ("Sueldo Ponasso Martin",        "Personal Independencia"),
        ("Limpieza",                     "Varios"),
        ("Mantenimiento",                "Varios"),
        ("Insumos / Librería",           "Varios"),
        ("Publicidad / Marketing",       "Varios"),
        ("Otros",                        "Varios"),
    ]
    inserted = 0
    for name, category in DEFAULTS:
        existing = db.query(SharedExpenseItem).filter(SharedExpenseItem.name == name).first()
        if not existing:
            db.add(SharedExpenseItem(name=name, category=category, is_active=True))
            inserted += 1
        elif not existing.is_active:
            existing.is_active = True
    db.commit()
    return {"inserted": inserted, "message": f"{inserted} items cargados"}


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
    year:  Optional[int] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(LuroExpense)
    if year:
        q = q.filter(LuroExpense.year == year)
    if month:
        q = q.filter(LuroExpense.month == month.upper())
    return q.order_by(LuroExpense.expense_date.desc(), LuroExpense.id.desc()).all()


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
        categoria      = data.categoria,
        subcategoria   = data.subcategoria,
        detail         = data.detail,
        amount         = data.amount,
        payment_method = data.payment_method,
        pagado         = data.pagado,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/luro/{expense_id}", response_model=LuroExpenseOut)
def update_luro_expense(expense_id: int, data: dict, db: Session = Depends(get_db)):
    e = db.query(LuroExpense).filter(LuroExpense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Gasto no encontrado")
    for field in ("categoria","subcategoria","detail","amount","payment_method","pagado","expense_date","month","year"):
        if field in data:
            setattr(e, field, data[field] if data[field] != "" else None)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/luro/{expense_id}", status_code=204)
def delete_luro_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(LuroExpense).filter(LuroExpense.id == expense_id).first()
    if not e:
        raise HTTPException(404, "Gasto no encontrado")
    db.delete(e)
    db.commit()


@router.get("/luro/reporte/{year}")
def luro_reporte_anual(year: int, db: Session = Depends(get_db)):
    """Reporte anual: {categoria: {subcategoria: {mes: total}}}"""
    MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
              "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
    rows = db.query(LuroExpense).filter(LuroExpense.year == year).all()

    # Acumula por categoría > subcategoría > mes
    report: dict = {}
    for e in rows:
        cat  = e.categoria  or "Sin categoría"
        sub  = e.subcategoria or "—"
        mes  = e.month or "—"
        amt  = float(e.amount or 0)
        report.setdefault(cat, {}).setdefault(sub, {m: 0.0 for m in MONTHS})
        if mes in report[cat][sub]:
            report[cat][sub][mes] += amt

    # Serializa en lista plana para el frontend
    result = []
    for cat, subs in report.items():
        for sub, months in subs.items():
            result.append({
                "categoria":   cat,
                "subcategoria": sub,
                "months":      months,
                "total":       sum(months.values()),
            })
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




# ─── Gastos Compartidos v2 (tabla simple, sin catálogo) ──────────────────────

@router.get("/compartidos/{year}/{month}")
def get_compartidos(year: int, month: str, db: Session = Depends(get_db)):
    """Retorna dict {item_key: row_data}. Incluye items fijos y custom."""
    rows = db.query(GastoCompartido).filter(
        GastoCompartido.year  == year,
        GastoCompartido.month == month.upper()
    ).all()
    return {r.item_key: _enrich_compartido(r) for r in rows}


@router.post("/compartidos/{year}/{month}/custom", status_code=201)
def add_custom_compartido(year: int, month: str, data: dict, db: Session = Depends(get_db)):
    """Crea un item personalizado para el mes. data: {name, split_type}."""
    import uuid
    key = f"custom_{uuid.uuid4().hex[:8]}"
    row = GastoCompartido(
        year        = year,
        month       = month.upper(),
        item_key    = key,
        custom_name = data.get("name", "Item personalizado"),
        split_type  = data.get("split_type", "half"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich_compartido(row)


@router.put("/compartidos/{year}/{month}/{item_key}")
def upsert_compartido(year: int, month: str, item_key: str, data: dict, db: Session = Depends(get_db)):
    """Upsert de un item. Acepta total_amount, indep_amount, due_date, detail, paid_status."""
    row = db.query(GastoCompartido).filter(
        GastoCompartido.year     == year,
        GastoCompartido.month    == month.upper(),
        GastoCompartido.item_key == item_key
    ).first()

    if not row:
        row = GastoCompartido(year=year, month=month.upper(), item_key=item_key)
        db.add(row)

    for field in ("total_amount", "indep_amount", "due_date", "detail", "paid_status", "custom_name", "split_type"):
        if field in data:
            setattr(row, field, data[field] if data[field] != "" else None)

    db.commit()
    db.refresh(row)
    return _enrich_compartido(row)


@router.delete("/compartidos/{year}/{month}/{item_key}", status_code=204)
def delete_custom_compartido(year: int, month: str, item_key: str, db: Session = Depends(get_db)):
    """Solo permite borrar items custom (item_key empieza con 'custom_')."""
    if not item_key.startswith("custom_"):
        from fastapi import HTTPException
        raise HTTPException(400, "Solo se pueden eliminar items personalizados")
    row = db.query(GastoCompartido).filter(
        GastoCompartido.year     == year,
        GastoCompartido.month    == month.upper(),
        GastoCompartido.item_key == item_key
    ).first()
    if row:
        db.delete(row)
        db.commit()


def _enrich_compartido(r: GastoCompartido) -> dict:
    return {
        "item_key":     r.item_key,
        "total_amount": float(r.total_amount) if r.total_amount is not None else None,
        "indep_amount": float(r.indep_amount) if r.indep_amount is not None else None,
        "due_date":     str(r.due_date) if r.due_date else None,
        "detail":       r.detail,
        "paid_status":  r.paid_status or "NO",
        "custom_name":  r.custom_name,
        "split_type":   r.split_type or "half",
    }
