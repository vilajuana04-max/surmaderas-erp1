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

# CSS de ventas construido como f-string Python ({{ }} = literal { } en el output)
_SALES_EXTRA_CSS = f"""
  .indep-hdr  {{ background: {NAVY};   color: white; text-align: center; padding: 5px 8px; font-size: 9pt; font-weight: bold; }}
  .luro-hdr   {{ background: {CORAL};  color: white; text-align: center; padding: 5px 8px; font-size: 9pt; font-weight: bold; }}
  .total-day  {{ background: #A84E2C;  color: white; font-weight: bold; text-align: right; }}
  .sub-hdr    {{ background: #1a1a2e;  color: rgba(255,255,255,0.65); font-size: 8pt; text-align: right; padding: 3px 6px; }}
  .sub-hdr-l  {{ background: #8B3A20;  color: rgba(255,255,255,0.65); font-size: 8pt; text-align: right; padding: 3px 6px; }}
  .sunday     {{ background: #f5f5f5;  color: #bbb; }}
  .total-row td  {{ background: {NAVY}; color: white; font-weight: bold; }}
  .accent     {{ color: {CORAL}; font-weight: bold; }}
  th {{ padding: 5px 8px; font-size: 9pt; text-align: right; }}
  td {{ text-align: right; padding: 4px 8px; }}
  td:first-child, td:nth-child(2) {{ text-align: left; }}
  .week-title {{ font-size: 10pt; font-weight: bold; margin-top: 16px;
                 border-bottom: 2px solid {CORAL}; padding-bottom: 3px; color: {NAVY}; }}
"""

SALES_TEMPLATE = """
<html><head><style>
  {{ css }}
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
<p class="subtitle">{{ month }} {{ year }}</p>
<table>
  <thead><tr>
    <th>Empleado</th><th>Inasistencias</th><th>Adelantos</th><th>Dep. Banco</th>
    <th>Plus</th><th>Plus $</th><th>Total Bruto</th><th>Total Percibido</th>
  </tr></thead>
  <tbody>
  {% for i in items %}
  <tr>
    <td>{{ i.employee.name }}</td>
    <td>{{ i.inasistencias_desc or '—' }}</td>
    <td>$ {{ "{:,.0f}".format(i.adelanto or 0) }}</td>
    <td>$ {{ "{:,.0f}".format(i.deposito_banco or 0) }}</td>
    <td>{{ i.plus_factor or '—' }}</td>
    <td>$ {{ "{:,.0f}".format(i.plus_pesos) }}</td>
    <td><strong>$ {{ "{:,.0f}".format(i.total_bruto) }}</strong></td>
    <td><strong>$ {{ "{:,.0f}".format(i.total_percibido) }}</strong></td>
  </tr>
  {% endfor %}
  <tr class="total-row">
    <td colspan="5"><strong>TOTALES</strong></td>
    <td>$ {{ "{:,.0f}".format(total_plus) }}</td>
    <td>$ {{ "{:,.0f}".format(total_bruto) }}</td>
    <td>$ {{ "{:,.0f}".format(total_percibido) }}</td>
  </tr>
  </tbody>
</table>
""" + FOOTER_HTML + "</body></html>"

PAYSLIP_TEMPLATE = """
<html><head><style>
{{ css }}
.payslip { border: 1px solid #ccc; padding: 12px; margin-bottom: 20px; page-break-inside: avoid; }
.ps-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.ps-name { font-weight: bold; font-size: 11pt; }
.ps-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ddd; }
.ps-total { font-weight: bold; font-size: 11pt; margin-top: 6px; display: flex; justify-content: space-between; }
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
  {% if i.plus_pesos %}<div class="ps-row"><span>(+) Plus (× {{ i.plus_factor }})</span><span>$ {{ "{:,.0f}".format(i.plus_pesos) }}</span></div>{% endif %}
  <div class="ps-row"><span>TOTAL BRUTO</span><span>$ {{ "{:,.0f}".format(i.total_bruto) }}</span></div>
  {% if i.deposito_banco %}<div class="ps-row"><span>(−) Depósito banco</span><span>$ {{ "{:,.0f}".format(i.deposito_banco or 0) }}</span></div>{% endif %}
  {% if i.adelanto %}<div class="ps-row"><span>(−) Adelanto</span><span>$ {{ "{:,.0f}".format(i.adelanto or 0) }}</span></div>{% endif %}
  <div class="ps-total"><span>TOTAL PERCIBIDO</span><span>$ {{ "{:,.0f}".format(i.total_percibido) }}</span></div>
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

SINGLE_PAYSLIP_TEMPLATE = """
<html><head><style>
  @page { margin: 1.5cm; size: A5; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; }
  .card {
    border: 1px solid #ccc; border-radius: 6px; overflow: hidden;
    max-width: 360px; margin: 0 auto; page-break-inside: avoid;
  }
  .card-header {
    background: """ + NAVY + """; color: white; padding: 14px 16px 10px;
  }
  .card-header .company { font-size: 13pt; font-weight: bold; letter-spacing: 1px; }
  .card-header .doc-title { font-size: 8pt; color: rgba(255,255,255,0.55); margin-top: 2px; }
  .card-header .emp-name { font-size: 12pt; font-weight: bold; color: """ + CORAL + """; margin-top: 8px; }
  .card-header .period { font-size: 8pt; color: rgba(255,255,255,0.45); margin-top: 2px; }
  .card-body { padding: 10px 16px 4px; }
  .line { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0eeeb; font-size: 9.5pt; }
  .line .lbl { color: #555; }
  .line .val { font-weight: bold; color: #222; }
  .bruto-row { background: #FFF3CD; padding: 6px 16px; display: flex; justify-content: space-between; font-weight: bold; font-size: 10pt; border-top: 2px solid #F0C040; }
  .perc-row  { background: """ + CORAL + """; padding: 8px 16px; display: flex; justify-content: space-between; font-weight: bold; font-size: 11pt; color: white; }
  .firmas { padding: 14px 16px 16px; display: flex; justify-content: space-between; gap: 16px; }
  .firma-box { flex: 1; border-top: 1px solid #aaa; padding-top: 4px; font-size: 8pt; color: #888; text-align: center; }
</style></head><body>
<div class="card">
  <div class="card-header">
    <div class="company">SUR MADERAS</div>
    <div class="doc-title">RECIBO DE SUELDO</div>
    <div class="emp-name">{{ item.employee.name }}</div>
    <div class="period">{{ month }} {{ year }} · {{ branch_name }}</div>
  </div>
  <div class="card-body">
    {% if item.inasistencias_desc %}
    <div class="line"><span class="lbl" style="color:#c00">Inasistencias</span><span class="val" style="color:#c00">{{ item.inasistencias_desc }}</span></div>
    {% endif %}
    {% if item.plus_pesos %}
    <div class="line"><span class="lbl">(+) Plus × {{ item.plus_factor }}</span><span class="val">$ {{ "{:,.0f}".format(item.plus_pesos) }}</span></div>
    {% endif %}
  </div>
  <div class="bruto-row">
    <span>TOTAL BRUTO</span><span>$ {{ "{:,.0f}".format(item.total_bruto) }}</span>
  </div>
  <div class="card-body">
    {% if item.deposito_banco %}
    <div class="line"><span class="lbl">(−) Depósito banco</span><span class="val">$ {{ "{:,.0f}".format(item.deposito_banco or 0) }}</span></div>
    {% endif %}
    {% if item.adelanto %}
    <div class="line"><span class="lbl">(−) Adelanto</span><span class="val">$ {{ "{:,.0f}".format(item.adelanto or 0) }}</span></div>
    {% endif %}
  </div>
  <div class="perc-row">
    <span>TOTAL PERCIBIDO</span><span>$ {{ "{:,.0f}".format(item.total_percibido) }}</span>
  </div>
  <div class="firmas">
    <div class="firma-box">Firma empleado</div>
    <div class="firma-box">Fecha recibido</div>
  </div>
</div>
</body></html>
"""

_env = Environment(loader=DictLoader({
    "purchases":        PURCHASES_TEMPLATE,
    "payroll":          PAYROLL_TEMPLATE,
    "payslips":         PAYSLIP_TEMPLATE,
    "single_payslip":   SINGLE_PAYSLIP_TEMPLATE,
    "vacations":        VACATIONS_TEMPLATE,
    "shared_expenses":  SHARED_EXPENSES_TEMPLATE,
    "luro_expenses":    LURO_EXPENSES_TEMPLATE,
    "sales":            SALES_TEMPLATE,
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
    items           = period.items
    total_bruto     = sum(i.total_bruto     for i in items)
    total_percibido = sum(i.total_percibido for i in items)
    total_plus      = sum(i.plus_pesos      for i in items)
    return _render("payroll", period=period, items=items,
                   branch_name=period.branch.name if period.branch else "",
                   month=period.month, year=period.year,
                   total_bruto=total_bruto, total_percibido=total_percibido,
                   total_plus=total_plus,
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


def generate_single_payslip_pdf(item, period) -> bytes:
    branch_name = period.branch.name if period.branch else ""
    return _render(
        "single_payslip",
        item=item, month=period.month, year=period.year,
        branch_name=branch_name,
        doc_title=f"Recibo de Sueldo — {item.employee.name}",
    )


def generate_luro_expenses_pdf(expenses, month: str, year: int) -> bytes:
    total = sum(float(e.amount or 0) for e in expenses)
    return _render("luro_expenses", expenses=expenses, month=month, year=year,
                   total=total, doc_title="Gastos Luro")


def generate_sales_pdf(sales: list, year: int, month: str, branch: str = "all") -> bytes:
    """PDF de ventas usando fpdf2 (sin dependencias de sistema como libcairo)."""
    import calendar
    from datetime import datetime, date as DateType
    from fpdf import FPDF

    # Paleta
    NAVY_C    = (7,   6,  20)
    CORAL_C   = (200, 96, 58)
    WHITE_C   = (255, 255, 255)
    LIGHT_C   = (250, 246, 242)
    GRAY_C    = (238, 238, 238)
    TEXT_C    = (30,  30,  30)
    MUTED_C   = (120, 120, 120)

    show_indep = branch in ("all", "independencia")
    show_luro  = branch in ("all", "luro")
    branch_label = {
        "all": "Ambas Sucursales",
        "independencia": "Independencia",
        "luro": "Luro",
    }.get(branch, "Ambas Sucursales")

    MONTH_NAMES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                   "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]
    month_idx  = MONTH_NAMES.index(month)
    days_count = calendar.monthrange(year, month_idx + 1)[1]
    WDAYS      = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"]

    def fmt(v: float) -> str:
        if not v: return "-"
        return "$ {:,.0f}".format(v).replace(",", ".")

    # Índice por fecha
    by_date: dict = {}
    for s in sales:
        d = str(s.sale_date)
        by_date.setdefault(d, {})[s.branch_id] = s

    # ── Configurar PDF (landscape A4) ──────────────────────────────
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_margins(10, 10, 10)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    # ── Cabecera ───────────────────────────────────────────────────
    pdf.set_fill_color(*NAVY_C); pdf.set_text_color(*WHITE_C)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "SUR MADERAS", ln=False, fill=True, align="L")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 8,
        f"Ventas {branch_label}  |  {month} {year}  |  Generado: {DateType.today().strftime('%d/%m/%Y')}",
        ln=True, fill=True, align="R")
    pdf.ln(2)

    # ── Definición de columnas ─────────────────────────────────────
    cols: list[tuple[str, int, str]] = [("Fecha", 18, "L"), ("Dia", 12, "L")]
    if show_indep:
        cols += [("Indep Total", 30, "R"), ("Indep Tarj.", 27, "R"),
                 ("Indep Tkt",   20, "R"), ("Indep Prom",  27, "R")]
    if show_luro:
        cols += [("Luro Total",  30, "R"), ("Luro Tarj.",  27, "R"),
                 ("Luro Tkt",    20, "R"), ("Luro Prom",   27, "R")]
    cols.append(("Total Dia", 27, "R"))

    def draw_header_row() -> None:
        pdf.set_fill_color(*NAVY_C); pdf.set_text_color(*WHITE_C)
        pdf.set_font("Helvetica", "B", 7)
        for label, w, align in cols:
            pdf.cell(w, 6, _safe(label), border=0, align=align, fill=True)
        pdf.ln()

    draw_header_row()

    # ── Filas de datos ─────────────────────────────────────────────
    g_iT = g_iC = g_iTk = g_lT = g_lC = g_lTk = 0.0

    for d in range(1, days_count + 1):
        date_str = f"{year}-{month_idx+1:02d}-{d:02d}"
        dt       = datetime(year, month_idx + 1, d)
        is_sun   = dt.weekday() == 6

        ds    = by_date.get(date_str, {})
        indep = ds.get(2); luro = ds.get(1)

        iT  = float(indep.total_amount  or 0) if indep else 0.0
        iC  = float(indep.card_payments or 0) if indep else 0.0
        iTk = int(indep.ticket_count    or 0) if indep else 0
        lT  = float(luro.total_amount   or 0) if luro  else 0.0
        lC  = float(luro.card_payments  or 0) if luro  else 0.0
        lTk = int(luro.ticket_count     or 0) if luro  else 0

        g_iT += iT; g_iC += iC; g_iTk += iTk
        g_lT += lT; g_lC += lC; g_lTk += lTk

        row_total = (iT if show_indep else 0) + (lT if show_luro else 0)

        if is_sun:
            pdf.set_fill_color(*GRAY_C); pdf.set_text_color(*MUTED_C)
        elif d % 2 == 0:
            pdf.set_fill_color(*LIGHT_C); pdf.set_text_color(*TEXT_C)
        else:
            pdf.set_fill_color(*WHITE_C); pdf.set_text_color(*TEXT_C)

        pdf.set_font("Helvetica", "", 7)
        row: list[tuple[str, int, str]] = [
            (f"{d:02d}/{month_idx+1:02d}", 18, "L"),
            (WDAYS[dt.weekday()],          12, "L"),
        ]
        if show_indep:
            row += [(fmt(iT),           30, "R"), (fmt(iC),           27, "R"),
                    (str(iTk) or "-",   20, "R"), (fmt(iT/iTk) if iTk else "-", 27, "R")]
        if show_luro:
            row += [(fmt(lT),           30, "R"), (fmt(lC),           27, "R"),
                    (str(lTk) or "-",   20, "R"), (fmt(lT/lTk) if lTk else "-", 27, "R")]
        row.append((fmt(row_total) if row_total else "-", 27, "R"))

        for text, w, align in row:
            pdf.cell(w, 5, _safe(str(text)), border=0, align=align, fill=True)
        pdf.ln()

    # ── Fila totales ───────────────────────────────────────────────
    pdf.set_fill_color(*NAVY_C); pdf.set_text_color(*WHITE_C)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(30, 6, "TOTAL MES", border=0, align="L", fill=True)
    if show_indep:
        pdf.cell(30, 6, fmt(g_iT),                              border=0, align="R", fill=True)
        pdf.cell(27, 6, fmt(g_iC),                              border=0, align="R", fill=True)
        pdf.cell(20, 6, str(int(g_iTk)) if g_iTk else "-",     border=0, align="R", fill=True)
        pdf.cell(27, 6, fmt(g_iT/g_iTk) if g_iTk else "-",     border=0, align="R", fill=True)
    if show_luro:
        pdf.cell(30, 6, fmt(g_lT),                              border=0, align="R", fill=True)
        pdf.cell(27, 6, fmt(g_lC),                              border=0, align="R", fill=True)
        pdf.cell(20, 6, str(int(g_lTk)) if g_lTk else "-",     border=0, align="R", fill=True)
        pdf.cell(27, 6, fmt(g_lT/g_lTk) if g_lTk else "-",     border=0, align="R", fill=True)
    combined = (g_iT if show_indep else 0) + (g_lT if show_luro else 0)
    pdf.set_text_color(*CORAL_C)
    pdf.cell(27, 6, fmt(combined), border=0, align="R", fill=True)
    pdf.ln(8)

    # ── Reporte semanal (Lun–Sáb) ─────────────────────────────────
    pdf.set_fill_color(*NAVY_C); pdf.set_text_color(*WHITE_C)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 7, "Reporte Semanal (Lun-Sab)", ln=True, fill=True, align="L")
    pdf.ln(2)

    wcols: list[tuple[str, int, str]] = [("Semana", 36, "L"), ("Dias c/datos", 22, "R")]
    if show_indep:
        wcols += [("Indep Total", 32, "R"), ("Indep Prom/dia", 30, "R"), ("Indep Tickets", 24, "R")]
    if show_luro:
        wcols += [("Luro Total",  32, "R"), ("Luro Prom/dia",  30, "R"), ("Luro Tickets",  24, "R")]
    wcols.append(("Total Semanal", 30, "R"))

    pdf.set_fill_color(*NAVY_C); pdf.set_text_color(*WHITE_C)
    pdf.set_font("Helvetica", "B", 7)
    for label, w, align in wcols:
        pdf.cell(w, 6, _safe(label), border=0, align=align, fill=True)
    pdf.ln()

    # Agrupar Lun–Sáb
    weeks_groups: list[list[str]] = []
    current_week: list[str] = []
    for d in range(1, days_count + 1):
        date_str = f"{year}-{month_idx+1:02d}-{d:02d}"
        dow = datetime(year, month_idx + 1, d).weekday()  # 0=Lun, 6=Dom
        if dow == 0 and current_week:
            weeks_groups.append(current_week)
            current_week = []
        if dow != 6:
            current_week.append(date_str)
    if current_week:
        weeks_groups.append(current_week)

    for wi, wdates in enumerate(weeks_groups):
        wSales = [s for s in sales if str(s.sale_date) in wdates]
        wIndep = [s for s in wSales if s.branch_id == 2]
        wLuro  = [s for s in wSales if s.branch_id == 1]
        wiT  = sum(float(s.total_amount or 0) for s in wIndep)
        wlT  = sum(float(s.total_amount or 0) for s in wLuro)
        wiTk = sum(int(s.ticket_count   or 0) for s in wIndep)
        wlTk = sum(int(s.ticket_count   or 0) for s in wLuro)
        days_wd = len(wdates)
        days_data = len(set(str(s.sale_date) for s in wSales if s.total_amount))

        label = f"Semana {wi + 1}"
        if days_wd < 6:
            label += f" ({days_wd} dias)"

        pdf.set_fill_color(*(LIGHT_C if wi % 2 == 0 else WHITE_C))
        pdf.set_text_color(*TEXT_C)
        pdf.set_font("Helvetica", "", 7)

        wrow: list[tuple[str, int, str]] = [
            (_safe(label),                          36, "L"),
            (str(days_data) if days_data else "-",  22, "R"),
        ]
        if show_indep:
            wrow += [(fmt(wiT) if wiT else "-",           32, "R"),
                     (fmt(wiT/days_data) if days_data else "-", 30, "R"),
                     (str(wiTk) if wiTk else "-",         24, "R")]
        if show_luro:
            wrow += [(fmt(wlT) if wlT else "-",           32, "R"),
                     (fmt(wlT/days_data) if days_data else "-", 30, "R"),
                     (str(wlTk) if wlTk else "-",         24, "R")]
        wTotal = (wiT if show_indep else 0) + (wlT if show_luro else 0)
        wrow.append((fmt(wTotal) if wTotal else "-", 30, "R"))

        for text, w, align in wrow:
            pdf.cell(w, 5, str(text), border=0, align=align, fill=True)
        pdf.ln()

    # Pie
    pdf.ln(4)
    pdf.set_text_color(*MUTED_C); pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 5, "Sur Maderas · Mar del Plata · Sistema ERP v1.0", align="C", ln=True)

    return bytes(pdf.output())
