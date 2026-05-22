from pydantic import BaseModel
from typing import Optional


class MonthlyStats(BaseModel):
    month:          str
    year:           int
    luro_sales:     float
    indep_sales:    float
    total_sales:    float
    luro_tickets:   int
    indep_tickets:  int
    luro_avg_ticket:    Optional[float]
    indep_avg_ticket:   Optional[float]
    total_expenses:     float
    luro_payroll:       float
    indep_payroll:      float
    total_payroll:      float


class WeekdaySales(BaseModel):
    weekday:        str
    luro_total:     float
    indep_total:    float
    combined:       float
    luro_tickets:   int
    indep_tickets:  int


class ExpensePieSlice(BaseModel):
    category:   str
    total:      float
    percentage: float


class DashboardKPIs(BaseModel):
    ytd_revenue:        float
    ytd_expenses:       float
    ytd_payroll:        float
    gross_margin:       float
    gross_margin_pct:   float
    payroll_to_revenue: float
    current_month:      str
    current_year:       int
    monthly_stats:      list[MonthlyStats]
    weekday_sales:      list[WeekdaySales]
    expense_breakdown:  list[ExpensePieSlice]
    luro_ytd:           float
    indep_ytd:          float
