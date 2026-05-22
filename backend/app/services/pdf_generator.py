"""
PDF generation via WeasyPrint + Jinja2 templates.
All PDFs use Sur Maderas corporate identity (dark wood palette).
"""
from jinja2 import Environment, DictLoader
from weasyprint import HTML
from datetime import date

BRAND_COLOR = "#3D2B1F"
ACCENT      = "#C8964C"

BASE_CSS = f"""
  @page {{ margin: 1.5cm; }}
  body {{ font-family: Arial, sans-serif; font-size: 10pt; color: #222; }}
  h1   {{ color: {BRAND_COLOR}; font-size: 14pt; margin-bottom: 4px; }}
  h2   {{ color: {BRAND_COLOR}; font-size: 11pt; border-bottom: 2px solid {ACCENT}; padding-bottom: 3px; }}
  .subtitle {{ color: #666; font-size: 9pt; margin-top: 0; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
  th    {{ background: {BRAND_COLOR}; color: white; padding: 6px 8px; text-align: left; font-size: 9pt; }}
  td    {{ padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 9pt; }}
  tr:nth-child(even) td {{ background: #FAF6F2; }}
  .total-row td {{ font-weight: bold; background: #F0E8DF; border-top: 2px solid {ACCENT}; }}
  .footer {{ margin-top: 20px; font-size: 8pt; color: #999; text-align: center; }}
  .badge-paid   {{ color: green; font-weight: bold; }}
  .badge-unpaid {{ color: #c00;  font-weight: bold; }}
  .negative     {{ color: #c00; }}
  .header-logo  {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }}
  .company-name {{ font-size: 18pt; font-weight: bold; color: {BRAND_COLOR}; letter-spacing: 1px; }}
"""

HEADER_HTML = """
<div class="header-logo">
  <div>
    <div class="company-name">SUR MADERAS</div>
    <div class="subtitle">Mar del Plata · Sistema ERP v1.0</div>
  </div>
  <div style="text-align:right; font-size:8pt; color:#666;">
    Generado: {{ today }}<br>{{ doc_title }}
  </div>
</div>
"""

FOOTER_HTML = '<div class="footer">Sur Maderas · Mar del Plata · Sistema ERP v1.0</div>'

NAVY  = "#070614"
CORAL = "#C8603A"

SALES_TEMPLATE = """
<html><head><style>
  {{ css }}
  .branch-indep {{ background: """ + NAVY  + """; color: white; }}
  .branch-luro  {{ background: """ + CORAL + """; color: white; }}
  .sub-header td {{ background: #1a1a2e; color: rgba(255,255,255,0.6); font-size: 8pt; text-align: right; padding: 3px 8px; }}
  .sub-header-luro td {{ background: #8B3A20; color: rgba(255,255,255,0.6); font-size: 8pt; text-align: right; padding: 3px 8px; }}
  th {{ padding: 6px 8px; font-size: 9pt; text-align: right; }}
  th:first-child, th:nth-child(2) {{ text-align: left; background: """ + NAVY + """; }}
  td {{ text-align: right; }}
  td:first-child, td:nth-child(2) {{ text-align: left; }}
  .total-row td {{ font-weight: bold; background: """ + NAVY + """; color: white; }}
  .week-section h2 {{ font-size: 10pt; margin-top: 16px; border-bottom: 2px solid """ + CORAL + """; }}
</style></head><body>
""" + HEADER_HTML + """
<h1>Ventas Diarias — {{ branch_label }}</h1>
<p class="subtitle">{{ month }} {{ year }} · {{ days_with_data }} días con ventas registradas</p>

<table>
  <thead>
    <tr>
      <th style="text-align:left">Fecha</th>
      <th style="text-align:left">Día</th>
      {% if show_indep %}
      <th class="branch-indep">INDEP Total $</th>
      <th class="branch-indep">INDEP Tarjetas</th>
      <th class="branch-indep">INDEP Tickets</th>
      <th class="branch-indep">INDEP T.Prom $</th>
      {% endif %}
      {% if show_luro %}
      <th class="branch-luro">LURO Total $</th>
      <th class="branch-luro">LURO Tarjetas</th>
      <th class="branch-luro">LURO Tickets</th>
      <th class="branch-luro">LURO T.Prom $</th>
      {% endif %}
      <th style="background:#A84E2C;color:white">Total Día</th>
    </tr>
  </thead>
  <tbody>
  {% for row in rows %}
  <tr>
    <td style="text-align:left">{{ row.date }}</td>
    <td style="text-align:left;color:#888">{{ row.weekday }}</td>
    {% if show_indep %}
    <td>{{ row.indep_total }}</td>
    <td>{{ row.indep_cards }}</td>
    <td>{{ row.indep_tickets }}</td>
    <td>{{ row.indep_prom }}</td>
    {% endif %}
    {% if show_luro %}
    <td>{{ row.luro_total }}</td>
    <td>{{ row.luro_cards }}</td>
    <td>{{ row.luro_tickets }}</td>
    <td>{{ row.luro_prom }}</td>
    {% endif %}
    <td style="font-weight:bold">{{ row.day_total }}</td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="2">TOTAL MES</td>
    {% if show_indep %}
    <td>{{ totals.indep_total }}</td>
    <td>{{ totals.indep_cards }}</td>
    <td>{{ totals.indep_tickets }}</td>
    <td>{{ totals.indep_prom }}</td>
    {% endif %}
    {% if show_luro %}
    <td>{{ totals.luro_total }}</td>
    <td>{{ totals.luro_cards }}</td>
    <td>{{ totals.luro_tickets }}</td>
    <td>{{ totals.luro_prom }}</td>
    {% endif %}
    <td style="color:""" + CORAL + """">{{ totals.combined }}</td>
  </tr>
  </tbody>
</table>

<div class="week-section">
  <h2>Reporte Semanal Comparativo</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Semana</th>
        <th>Días c/datos</th>
        {% if show_indep %}<th>Indep Total</th><th>Indep Prom/día</th><th>Indep Tickets</th>{% endif %}
        {% if show_luro  %}<th>Luro Total</th><th>Luro Prom/día</th><th>Luro Tickets</th>{% endif %}
        <th>Total Semanal</th>
      </tr>
    </thead>
    <tbody>
    {% for w in weeks %}
    <tr>
      <td style="text-align:left">{{ w.label }}</td>
      <td>{{ w.days }}</td>
      {% if show_indep %}<td>{{ w.iT }}</td><td>{{ w.iProm }}</td><td>{{ w.iTk }}</td>{% endif %}
      {% if show_luro  %}<td>{{ w.lT }}</td><td>{{ w.lProm }}</td><td>{{ w.lTk }}</td>{% endif %}
      <td style="font-weight:bold">{{ w.total }}</td>
    </tr>
    {% endfor %}
    </tbody>
  </table>
</div>
""" + FOOTER_HTML + "</body></html>"

PURCHASES_TEMPLATE = """
<html><head><style>{{ css }}</style></head><body>
""" + HEADER_HTML + """
<h1>Compras y Gastos</h1>
<p class="subtitle">{{ month }} {{ year }} · {{ count }} facturas</p>
<table>
  <thead><tr>
    <th>Fecha</th><th>Nro Factura</th><th>Proveedor</th><th style="text-align:right">Total $</th><th>Estado</th>
  </tr></thead>
  <tbody>
  {% for p in purchases %}
  <tr>
    <td>{{ p.purchase_date or '—' }}</td>
    <td>{{ p.invoice_number or '—' }}</td>
    <td>{{ p.provider.name if p.provider else '—' }}</td>
    <td style="text-align:right" class="{{ 'negative' if p.total_amount < 0 else '' }}">
      $ {{ "{:,.0f}".format(p.total_amount) }}
    </td>
    <td>{{ p.flag or '' }}</td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="3">TOTAL MES</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(total) }}</td>
    <td></td>
  </tr>
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

PAYROLL_TEMPLATE = """
<html><head><style>{{ css }}</style></head><body>
""" + HEADER_HTML + """
<h1>Liquidación de Sueldos — {{ branch_name }}</h1>
<p class="subtitle">{{ month }} {{ year }} · Convenio {{ union_type }}</p>
<table>
  <thead><tr>
    <th>Empleado</th><th>Inas.</th><th>Base $</th><th>Plus %</th>
    <th>Plus $</th><th>Incentivo</th><th>Bruto $</th><th>Depósito</th><th>Adelanto</th><th>Percibido $</th>
  </tr></thead>
  <tbody>
  {% for i in items %}
  <tr>
    <td>{{ i.employee.name }}</td>
    <td>{{ i.absences }}</td>
    <td>$ {{ "{:,.0f}".format(i.base_salary or 0) }}</td>
    <td>{{ "{:.0%}".format(i.plus_pct or 0) }}</td>
    <td>$ {{ "{:,.0f}".format(i.plus_amount) }}</td>
    <td>$ {{ "{:,.0f}".format(i.incentive or 0) }}</td>
    <td>$ {{ "{:,.0f}".format(i.gross_total) }}</td>
    <td>$ {{ "{:,.0f}".format(i.bank_deposit or 0) }}</td>
    <td>$ {{ "{:,.0f}".format(i.advance or 0) }}</td>
    <td><strong>$ {{ "{:,.0f}".format(i.net_total) }}</strong></td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="6"><strong>TOTALES</strong></td>
    <td>$ {{ "{:,.0f}".format(total_gross) }}</td>
    <td>$ {{ "{:,.0f}".format(total_deposit) }}</td>
    <td>$ {{ "{:,.0f}".format(total_advance) }}</td>
    <td>$ {{ "{:,.0f}".format(total_net) }}</td>
  </tr>
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

PAYSLIP_TEMPLATE = """
<html><head><style>
{{ css }}
.payslip {{ border: 1px solid #ccc; padding: 12px; margin-bottom: 20px; page-break-inside: avoid; }}
.ps-header {{ display: flex; justify-content: space-between; margin-bottom: 8px; }}
.ps-name {{ font-weight: bold; font-size: 11pt; }}
.ps-row {{ display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ddd; }}
.ps-total {{ font-weight: bold; font-size: 11pt; margin-top: 6px; display: flex; justify-content: space-between; }}
</style></head><body>
""" + HEADER_HTML + """
<h1>Recibos de Sueldo — {{ branch_name }}</h1>
<p class="subtitle">{{ month }} {{ year }}</p>
{% for i in items %}
<div class="payslip">
  <div class="ps-header">
    <div class="ps-name">{{ i.employee.name }}</div>
    <div style="color:#666; font-size:9pt;">{{ month }} {{ year }}</div>
  </div>
  <div class="ps-row"><span>(+) Sueldo base</span><span>$ {{ "{:,.0f}".format(i.base_salary or 0) }}</span></div>
  {% if i.plus_amount %}<div class="ps-row"><span>(+) Plus ({{ "{:.0%}".format(i.plus_pct or 0) }})</span><span>$ {{ "{:,.0f}".format(i.plus_amount) }}</span></div>{% endif %}
  {% if i.incentive %}<div class="ps-row"><span>(+) Incentivo</span><span>$ {{ "{:,.0f}".format(i.incentive or 0) }}</span></div>{% endif %}
  <div class="ps-row"><span>TOTAL BRUTO</span><span>$ {{ "{:,.0f}".format(i.gross_total) }}</span></div>
  {% if i.bank_deposit %}<div class="ps-row"><span>(−) Depósito banco</span><span>$ {{ "{:,.0f}".format(i.bank_deposit or 0) }}</span></div>{% endif %}
  {% if i.advance %}<div class="ps-row"><span>(−) Adelanto</span><span>$ {{ "{:,.0f}".format(i.advance or 0) }}</span></div>{% endif %}
  <div class="ps-total"><span>PERCIBIDO</span><span>$ {{ "{:,.0f}".format(i.net_total) }}</span></div>
</div>
{% endfor %}
""" + FOOTER_HTML + "</body></html>"

VACATIONS_TEMPLATE = """
<html><head><style>{{ css }}</style></head><body>
""" + HEADER_HTML + """
<h1>Gestión de Vacaciones</h1>
<p class="subtitle">Situación {{ year }} · Cálculo automático por antigüedad</p>
<table>
  <thead><tr>
    <th>Empleado</th><th>Sucursal</th><th>Corr.</th><th>Tomadas</th>
    <th>Pend. Ant.</th><th>Total Disp.</th><th>Pendientes</th><th>Descripción</th>
  </tr></thead>
  <tbody>
  {% for r in records %}
  <tr>
    <td>{{ r.employee.name }}</td>
    <td>{{ r.employee.branch.name if r.employee and r.employee.branch else '—' }}</td>
    <td>{{ r.days_entitled }}</td>
    <td>{{ r.days_taken }}</td>
    <td>{{ r.pending_prev_year }}</td>
    <td><strong>{{ r.total_available }}</strong></td>
    <td {% if r.pending_current > 0 %}style="color:#c00; font-weight:bold"{% endif %}>{{ r.pending_current }}</td>
    <td>{{ r.description or '—' }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

SHARED_EXPENSES_TEMPLATE = """
<html><head><style>{{ css }}</style></head><body>
""" + HEADER_HTML + """
<h1>Gastos Compartidos</h1>
<p class="subtitle">{{ month }} {{ year }} · Split 50/50 entre sucursales</p>
<table>
  <thead><tr>
    <th>Ítem</th><th>Categoría</th><th style="text-align:right">Total $</th>
    <th style="text-align:right">Luro $</th><th>Pagado</th>
  </tr></thead>
  <tbody>
  {% for e in expenses %}
  <tr>
    <td>{{ e.item.name }}</td>
    <td>{{ e.item.category or '—' }}</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(e.total_amount or 0) }}</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(e.luro_amount or 0) }}</td>
    <td class="{{ 'badge-paid' if e.paid_status == 'SI' else 'badge-unpaid' }}">{{ e.paid_status }}</td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="2">TOTAL MES</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(total) }}</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(total_luro) }}</td>
    <td></td>
  </tr>
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

LURO_EXPENSES_TEMPLATE = """
<html><head><style>{{ css }}</style></head><body>
""" + HEADER_HTML + """
<h1>Gastos Luro</h1>
<p class="subtitle">{{ month }} {{ year }}</p>
<table>
  <thead><tr>
    <th>Fecha</th><th>Categoría</th><th>Subcategoría</th><th>Detalle</th>
    <th style="text-align:right">Importe $</th><th>Medio pago</th><th>Pagado</th>
  </tr></thead>
  <tbody>
  {% for e in expenses %}
  <tr>
    <td>{{ e.expense_date or '—' }}</td>
    <td>{{ e.category.name if e.category else '—' }}</td>
    <td>{{ e.subcategory.name if e.subcategory else '—' }}</td>
    <td>{{ e.detail or '—' }}</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(e.amount or 0) }}</td>
    <td>{{ e.payment_method or '—' }}</td>
    <td class="{{ 'badge-paid' if e.paid_status else 'badge-unpaid' }}">
      {{ 'SI' if e.paid_status else 'NO' }}
    </td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="4">TOTAL MES</td>
    <td style="text-align:right">$ {{ "{:,.0f}".format(total) }}</td>
    <td colspan="2"></td>
  </tr>
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

_env = Environment(loader=DictLoader({
    "purchases":       PURCHASES_TEMPLATE,
    "payroll":         PAYROLL_TEMPLATE,
    "payslips":        PAYSLIP_TEMPLATE,
    "vacations":       VACATIONS_TEMPLATE,
    "shared_expenses": SHARED_EXPENSES_TEMPLATE,
    "luro_expenses":   LURO_EXPENSES_TEMPLATE,
    "sales":           SALES_TEMPLATE,
}))


def _render(template_name: str, **kwargs) -> bytes:
    tpl = _env.get_template(template_name)
    html = tpl.render(css=BASE_CSS, today=date.today().strftime("%d/%m/%Y"), **kwargs)
    return HTML(string=html).write_pdf()


def generate_purchases_pdf(purchases, month: str, year: int) -> bytes:
    total = sum(float(p.total_amount) for p in purchases)
    return _render("purchases", purchases=purchases, month=month, year=year,
                   count=len(purchases), total=total, doc_title="Compras y Gastos")


def generate_payroll_pdf(period) -> bytes:
    items        = period.items
    total_gross  = sum(i.gross_total  for i in items)
    total_net    = sum(i.net_total    for i in items)
    total_deposit = sum(float(i.bank_deposit or 0) for i in items)
    total_advance = sum(float(i.advance or 0) for i in items)
    return _render("payroll", period=period, items=items,
                   branch_name=period.branch.name if period.branch else "",
                   union_type=period.branch.union_type if period.branch else "",
                   month=period.month, year=period.year,
                   total_gross=total_gross, total_net=total_net,
                   total_deposit=total_deposit, total_advance=total_advance,
                   doc_title="Liquidación de Sueldos")


def generate_payslips_pdf(period) -> bytes:
    return _render("payslips", items=period.items,
                   branch_name=period.branch.name if period.branch else "",
                   month=period.month, year=period.year,
                   doc_title="Recibos de Sueldo")


def generate_vacations_pdf(records, year: int) -> bytes:
    return _render("vacations", records=records, year=year,
                   doc_title="Gestión de Vacaciones")


def generate_shared_expenses_pdf(expenses, month: str, year: int) -> bytes:
    total      = sum(float(e.total_amount or 0) for e in expenses)
    total_luro = sum(float(e.luro_amount  or 0) for e in expenses)
    return _render("shared_expenses", expenses=expenses, month=month, year=year,
                   total=total, total_luro=total_luro,
                   doc_title="Gastos Compartidos")


def generate_luro_expenses_pdf(expenses, month: str, year: int) -> bytes:
    total = sum(float(e.amount or 0) for e in expenses)
    return _render("luro_expenses", expenses=expenses, month=month, year=year,
                   total=total, doc_title="Gastos Luro")


def generate_sales_pdf(sales: list, year: int, month: str, branch: str = "all") -> bytes:
    import calendar
    from datetime import datetime

    WEEKDAYS = ["lun","mar","mié","jue","vie","sáb","dom"]

    show_indep = branch in ("all", "independencia")
    show_luro  = branch in ("all", "luro")
    branch_label = {
        "all": "Ambas Sucursales",
        "independencia": "Independencia",
        "luro": "Luro",
    }.get(branch, "Ambas Sucursales")

    # Construir dict por fecha y sucursal
    by_date: dict = {}
    for s in sales:
        d = str(s.sale_date)
        if d not in by_date:
            by_date[d] = {}
        by_date[d][s.branch_id] = s

    # Mes completo
    month_idx = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                 "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"].index(month)
    days_count = calendar.monthrange(year, month_idx + 1)[1]

    def fmt(v): return f"$ {int(v):,}".replace(",", ".") if v else "—"

    rows = []
    for d in range(1, days_count + 1):
        date_str  = f"{year}-{month_idx+1:02d}-{d:02d}"
        dt        = datetime(year, month_idx + 1, d)
        weekday   = WEEKDAYS[dt.weekday()]
        day_sales = by_date.get(date_str, {})

        indep = day_sales.get(2)
        luro  = day_sales.get(1)

        iT  = float(indep.total_amount  or 0) if indep else 0
        iC  = float(indep.card_payments or 0) if indep else 0
        iTk = int(indep.ticket_count    or 0) if indep else 0
        lT  = float(luro.total_amount   or 0) if luro  else 0
        lC  = float(luro.card_payments  or 0) if luro  else 0
        lTk = int(luro.ticket_count     or 0) if luro  else 0

        row_total = (iT if show_indep else 0) + (lT if show_luro else 0)

        rows.append({
            "date": f"{d:02d}/{month_idx+1:02d}",
            "weekday": weekday,
            "indep_total":   fmt(iT),   "indep_cards": fmt(iC),
            "indep_tickets": iTk or "—","indep_prom":  fmt(iT/iTk) if iTk else "—",
            "luro_total":    fmt(lT),   "luro_cards":  fmt(lC),
            "luro_tickets":  lTk or "—","luro_prom":   fmt(lT/lTk) if lTk else "—",
            "day_total": fmt(row_total) if row_total else "—",
        })

    # Totales
    all_sales = list(by_date.values())
    iTotal = sum(float(v[2].total_amount  or 0) for v in all_sales if 2 in v)
    iCards = sum(float(v[2].card_payments or 0) for v in all_sales if 2 in v)
    iTicks = sum(int(v[2].ticket_count    or 0) for v in all_sales if 2 in v)
    lTotal = sum(float(v[1].total_amount  or 0) for v in all_sales if 1 in v)
    lCards = sum(float(v[1].card_payments or 0) for v in all_sales if 1 in v)
    lTicks = sum(int(v[1].ticket_count    or 0) for v in all_sales if 1 in v)

    totals = {
        "indep_total": fmt(iTotal), "indep_cards": fmt(iCards),
        "indep_tickets": iTicks or "—",
        "indep_prom": fmt(iTotal/iTicks) if iTicks else "—",
        "luro_total": fmt(lTotal), "luro_cards": fmt(lCards),
        "luro_tickets": lTicks or "—",
        "luro_prom": fmt(lTotal/lTicks) if lTicks else "—",
        "combined": fmt(iTotal + lTotal),
    }

    # Semanas (grupos de 7 días)
    week_rows = []
    for wi in range(0, days_count, 7):
        week_dates = [f"{year}-{month_idx+1:02d}-{d:02d}" for d in range(wi+1, min(wi+8, days_count+1))]
        wSales = [s for s in sales if str(s.sale_date) in week_dates]
        wIndep = [s for s in wSales if s.branch_id == 2]
        wLuro  = [s for s in wSales if s.branch_id == 1]
        wiT = sum(float(s.total_amount or 0) for s in wIndep)
        wlT = sum(float(s.total_amount or 0) for s in wLuro)
        wiTk = sum(int(s.ticket_count  or 0) for s in wIndep)
        wlTk = sum(int(s.ticket_count  or 0) for s in wLuro)
        days_with = len(set(str(s.sale_date) for s in wSales))
        week_rows.append({
            "label": f"Semana {len(week_rows)+1}",
            "days": days_with or "—",
            "iT": fmt(wiT), "iProm": fmt(wiT/days_with) if days_with else "—", "iTk": wiTk or "—",
            "lT": fmt(wlT), "lProm": fmt(wlT/days_with) if days_with else "—", "lTk": wlTk or "—",
            "total": fmt(wiT + wlT) if (wiT + wlT) else "—",
        })

    days_with_data = len(set(str(s.sale_date) for s in sales))

    return _render(
        "sales",
        rows=rows, totals=totals, weeks=week_rows,
        year=year, month=month, branch_label=branch_label,
        show_indep=show_indep, show_luro=show_luro,
        days_with_data=days_with_data,
        doc_title=f"Ventas Diarias — {branch_label}",
    )
