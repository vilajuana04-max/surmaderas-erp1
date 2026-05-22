from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import DailySales, LuroExpense, SharedExpense, PayrollPeriod, PayrollItem, AppConfig
from app.schemas import DashboardKPIs, MonthlyStats, WeekdaySales

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

MONTHS = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
          "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]

WEEKDAYS_ES = {"Mon":"Lun","Tue":"Mar","Wed":"Mié","Thu":"Jue",
               "Fri":"Vie","Sat":"Sáb","Sun":"Dom"}


@router.get("/kpis", response_model=DashboardKPIs)
def get_kpis(year: int = 2026, db: Session = Depends(get_db)):
    config   = {r.key: r.value for r in db.query(AppConfig).all()}
    cur_month = config.get("active_month", "ABRIL")
    cur_year  = int(config.get("active_year", year))

    monthly_stats = []
    ytd_revenue = ytd_expenses = ytd_payroll = 0.0

    for month in MONTHS:
        luro_row  = _branch_sales(db, year, month, 1)
        indep_row = _branch_sales(db, year, month, 2)

        luro_sales   = luro_row["total"]
        indep_sales  = indep_row["total"]
        total_sales  = luro_sales + indep_sales

        luro_tickets  = luro_row["tickets"]
        indep_tickets = indep_row["tickets"]

        expenses = float(db.query(func.sum(LuroExpense.amount)).filter(
            LuroExpense.year  == year,
            LuroExpense.month == month
        ).scalar() or 0)

        shared = float(db.query(func.sum(SharedExpense.luro_amount)).filter(
            SharedExpense.year  == year,
            SharedExpense.month == month
        ).scalar() or 0)

        total_expenses = expenses + shared

        luro_payroll  = _branch_payroll(db, year, month, 1)
        indep_payroll = _branch_payroll(db, year, month, 2)
        total_payroll = luro_payroll + indep_payroll

        if total_sales > 0:
            ytd_revenue  += total_sales
            ytd_expenses += total_expenses
            ytd_payroll  += total_payroll

        monthly_stats.append(MonthlyStats(
            month         = month,
            year          = year,
            luro_sales    = luro_sales,
            indep_sales   = indep_sales,
            total_sales   = total_sales,
            luro_tickets  = luro_tickets,
            indep_tickets = indep_tickets,
            luro_avg_ticket  = round(luro_sales / luro_tickets, 2)  if luro_tickets  else None,
            indep_avg_ticket = round(indep_sales / indep_tickets, 2) if indep_tickets else None,
            total_expenses   = total_expenses,
            luro_payroll     = luro_payroll,
            indep_payroll    = indep_payroll,
            total_payroll    = total_payroll,
        ))

    gross_margin     = ytd_revenue - ytd_expenses - ytd_payroll
    gross_margin_pct = round(gross_margin / ytd_revenue * 100, 1) if ytd_revenue else 0
    payroll_ratio    = round(ytd_payroll / ytd_revenue * 100, 1)  if ytd_revenue else 0

    weekday_sales = _weekday_breakdown(db, year, cur_month)
    expense_breakdown = _expense_pie(db, year)

    luro_ytd  = sum(m.luro_sales  for m in monthly_stats)
    indep_ytd = sum(m.indep_sales for m in monthly_stats)

    return DashboardKPIs(
        ytd_revenue        = ytd_revenue,
        ytd_expenses       = ytd_expenses,
        ytd_payroll        = ytd_payroll,
        gross_margin       = gross_margin,
        gross_margin_pct   = gross_margin_pct,
        payroll_to_revenue = payroll_ratio,
        current_month      = cur_month,
        current_year       = cur_year,
        monthly_stats      = monthly_stats,
        weekday_sales      = weekday_sales,
        expense_breakdown  = expense_breakdown,
        luro_ytd           = luro_ytd,
        indep_ytd          = indep_ytd,
    )


def _branch_sales(db, year, month, branch_id):
    row = db.query(
        func.coalesce(func.sum(DailySales.total_amount), 0),
        func.coalesce(func.sum(DailySales.ticket_count), 0),
    ).filter(
        DailySales.year      == year,
        DailySales.month_label == month,
        DailySales.branch_id == branch_id,
    ).first()
    return {"total": float(row[0]), "tickets": int(row[1])}


def _branch_payroll(db, year, month, branch_id):
    periods = db.query(PayrollPeriod).filter(
        PayrollPeriod.year      == year,
        PayrollPeriod.month     == month,
        PayrollPeriod.branch_id == branch_id
    ).all()
    total = 0.0
    for p in periods:
        for item in p.items:
            total += item.gross_total
    return total


def _weekday_breakdown(db, year, month):
    sales = db.query(DailySales).filter(
        DailySales.year == year,
        DailySales.month_label == month
    ).all()
    buckets = {d: {"luro": 0.0, "indep": 0.0, "lt": 0, "it": 0}
               for d in ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]}
    for s in sales:
        wd = WEEKDAYS_ES.get(s.sale_date.strftime("%a"), "Lun")
        if s.branch_id == 1:
            buckets[wd]["luro"] += float(s.total_amount or 0)
            buckets[wd]["lt"]   += int(s.ticket_count or 0)
        else:
            buckets[wd]["indep"] += float(s.total_amount or 0)
            buckets[wd]["it"]    += int(s.ticket_count or 0)
    return [
        WeekdaySales(
            weekday      = wd,
            luro_total   = v["luro"],
            indep_total  = v["indep"],
            combined     = v["luro"] + v["indep"],
            luro_tickets = v["lt"],
            indep_tickets = v["it"],
        )
        for wd, v in buckets.items()
    ]


def _expense_pie(db, year):
    from app.models import ExpenseCategory
    from app.schemas.dashboard import ExpensePieSlice

    cats  = db.query(ExpenseCategory).filter(ExpenseCategory.parent_id == None).all()
    slices = []
    grand = 0.0
    for cat in cats:
        total = float(db.query(func.sum(LuroExpense.amount)).filter(
            LuroExpense.year == year,
            LuroExpense.category_id == cat.id
        ).scalar() or 0)
        if total > 0:
            slices.append((cat.name, total))
            grand += total
    return [
        ExpensePieSlice(
            category   = name,
            total      = total,
            percentage = round(total / grand * 100, 1) if grand else 0
        )
        for name, total in slices
    ]
