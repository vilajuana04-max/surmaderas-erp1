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
