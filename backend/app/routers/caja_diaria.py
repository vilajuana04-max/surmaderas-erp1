from datetime import date as DateType
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jinja2 import Environment, DictLoader
from weasyprint import HTML

from app.database import get_db
from app.models.caja import CajaDiaria, CajaMovimiento

router = APIRouter(prefix="/caja-diaria", tags=["caja-diaria"])

NAVY  = "#070614"
CORAL = "#C8603A"

# ── Schemas ──────────────────────────────────────────────────────
class MovimientoIn(BaseModel):
    tipo:        str
    descripcion: str = ''
    monto:       float = 0

class MovimientoUpdate(BaseModel):
    descripcion: Optional[str]   = None
    monto:       Optional[float] = None

class CajaUpdate(BaseModel):
    efectivo_del_dia:  Optional[float] = None
    tarjeta_provincia: Optional[float] = None
    tarjeta_nave:      Optional[float] = None
    tarjeta_frances:   Optional[float] = None
    tarjeta_comafi:    Optional[float] = None
    observaciones:     Optional[str]   = None
    cerrada:           Optional[bool]  = None


# ── Helpers ───────────────────────────────────────────────────────
def _fmt(n) -> str:
    return f"$ {float(n):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def _serialize_caja(c: CajaDiaria) -> dict:
    movs = [
        {
            "id":          m.id,
            "tipo":        m.tipo,
            "descripcion": m.descripcion or '',
            "monto":       float(m.monto),
        }
        for m in c.movimientos
    ]
    total_gastos   = sum(m["monto"] for m in movs if m["tipo"] == "gasto")
    total_transf   = sum(m["monto"] for m in movs if m["tipo"] == "transferencia")
    total_retiros  = sum(m["monto"] for m in movs if m["tipo"] == "retiro")
    total_tarjetas = (
        float(c.tarjeta_provincia) + float(c.tarjeta_nave) +
        float(c.tarjeta_frances)   + float(c.tarjeta_comafi)
    )
    efectivo      = float(c.efectivo_del_dia)
    total_del_dia = total_transf + efectivo + total_tarjetas
    total_salidas = total_gastos + total_retiros

    return {
        "id":                 c.id,
        "fecha":              c.fecha.isoformat(),
        "sucursal":           c.sucursal,
        "efectivo_del_dia":   efectivo,
        "tarjeta_provincia":  float(c.tarjeta_provincia),
        "tarjeta_nave":       float(c.tarjeta_nave),
        "tarjeta_frances":    float(c.tarjeta_frances),
        "tarjeta_comafi":     float(c.tarjeta_comafi),
        "observaciones":      c.observaciones or '',
        "cerrada":            c.cerrada,
        "movimientos":        movs,
        "total_gastos":       total_gastos,
        "total_transf":       total_transf,
        "total_retiros":      total_retiros,
        "total_tarjetas":     total_tarjetas,
        "total_del_dia":      total_del_dia,
        "total_salidas":      total_salidas,
    }


# ── PDF Template (WeasyPrint — solo tables, sin grid/flex) ────────
_PDF_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 1.2cm 1.5cm; size: A4; }
  body  { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; margin: 0; }

  /* Header */
  table.header { width: 100%; border-bottom: 3px solid {{ coral }}; margin-bottom: 12px; border-collapse: collapse; }
  .brand-name  { font-size: 18pt; font-weight: bold; color: {{ navy }}; }
  .brand-sub   { font-size: 8pt; color: #777; }
  .doc-title   { font-size: 12pt; font-weight: bold; color: {{ coral }}; text-align: right; }
  .doc-gen     { font-size: 8pt; color: #777; text-align: right; }

  /* Meta strip */
  table.meta   { width: 100%; background: {{ navy }}; color: white;
                 margin-bottom: 12px; border-collapse: collapse; }
  table.meta td { padding: 7px 12px; font-size: 8.5pt; }
  .meta-label  { font-size: 7pt; color: rgba(255,255,255,0.55);
                 text-transform: uppercase; display: block; }
  .meta-val    { font-weight: bold; }
  .badge-open  { background: #16a34a; color: white; padding: 1px 7px;
                 font-size: 7.5pt; font-weight: bold; }
  .badge-closed{ background: #dc2626; color: white; padding: 1px 7px;
                 font-size: 7.5pt; font-weight: bold; }

  /* Sections wrapper — 2 cols via table */
  table.sections { width: 100%; border-collapse: separate; border-spacing: 6px;
                   margin-bottom: 10px; }
  table.sections td.sec-cell { width: 50%; vertical-align: top; }

  .section     { border: 1px solid #e5e7eb; }

  table.sec-hdr { width: 100%; border-collapse: collapse; }
  table.sec-hdr td { padding: 5px 9px; font-weight: bold; font-size: 8.5pt; }
  .hdr-gastos  { background: #fee2e2; color: #dc2626; border-left: 4px solid #dc2626; }
  .hdr-transf  { background: #dbeafe; color: #2563eb; border-left: 4px solid #2563eb; }
  .hdr-retiros { background: #fef3c7; color: #d97706; border-left: 4px solid #d97706; }
  .hdr-tarjetas{ background: #ede9fe; color: #7c3aed; border-left: 4px solid #7c3aed; }

  table.rows   { width: 100%; border-collapse: collapse; }
  table.rows td{ padding: 3px 9px; font-size: 8.5pt; border-bottom: 1px solid #f3f4f6; }
  td.amt       { text-align: right; font-weight: 500; width: 35%; }
  .empty-row   { padding: 5px 9px; font-size: 8pt; color: #9ca3af; font-style: italic; }

  /* Efectivo */
  table.efectivo { width: 100%; border: 2px solid {{ coral }};
                   margin-bottom: 10px; border-collapse: collapse; }
  table.efectivo td { padding: 7px 12px; font-size: 9pt; }
  .ef-label    { color: #6b7280; text-transform: uppercase; font-size: 7.5pt;
                 font-weight: bold; letter-spacing: 0.5px; }
  .ef-value    { text-align: right; font-size: 14pt; font-weight: bold; color: {{ navy }}; }

  /* Summary */
  table.summary { width: 100%; border-collapse: separate; border-spacing: 5px;
                  margin-bottom: 10px; }
  table.summary td { width: 25%; border: 1px solid #e5e7eb; padding: 7px 9px;
                     vertical-align: top; }
  .sum-label   { font-size: 7pt; color: #6b7280; text-transform: uppercase;
                 letter-spacing: 0.4px; display: block; margin-bottom: 2px; }
  .sum-val     { font-size: 11pt; font-weight: bold; display: block; }
  .c-transf  { color: #2563eb; }
  .c-efectivo{ color: #16a34a; }
  .c-tarjeta { color: #7c3aed; }
  .c-salidas { color: #dc2626; }

  /* Total */
  table.total-row { width: 100%; background: {{ navy }}; color: white;
                    border-collapse: collapse; margin-bottom: 10px; }
  table.total-row td { padding: 9px 14px; }
  .tot-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px;
               opacity: 0.65; }
  .tot-val   { text-align: right; font-size: 20pt; font-weight: bold;
               color: {{ coral }}; }

  /* Observaciones */
  .obs-box   { border: 1px solid #e5e7eb; padding: 8px 12px; margin-bottom: 8px; }
  .obs-title { font-size: 7.5pt; font-weight: bold; color: #6b7280;
               text-transform: uppercase; margin-bottom: 4px; }
  .obs-text  { font-size: 8.5pt; color: #374151; }

  .footer    { border-top: 1px solid #e5e7eb; padding-top: 5px; margin-top: 12px;
               text-align: center; font-size: 7.5pt; color: #9ca3af; }
</style>
</head>
<body>

<!-- Header -->
<table class="header"><tr>
  <td><div class="brand-name">SUR MADERAS</div><div class="brand-sub">Mar del Plata · Sistema ERP v1.0</div></td>
  <td><div class="doc-title">Cierre de Caja</div><div class="doc-gen">Generado: {{ generated }}</div></td>
</tr></table>

<!-- Meta strip -->
<table class="meta"><tr>
  <td><span class="meta-label">Fecha</span><span class="meta-val">{{ fecha }}</span></td>
  <td><span class="meta-label">Sucursal</span><span class="meta-val">{{ sucursal }}</span></td>
  <td><span class="meta-label">Estado</span>
      {% if cerrada %}<span class="badge-closed">CERRADA</span>
      {% else %}<span class="badge-open">ABIERTA</span>{% endif %}
  </td>
</tr></table>

<!-- 4 sections: 2 rows x 2 cols -->
<table class="sections">
<tr>
  <!-- Gastos -->
  <td class="sec-cell">
    <div class="section">
      <table class="sec-hdr"><tr>
        <td class="hdr-gastos">Gastos</td>
        <td class="hdr-gastos" style="text-align:right">{{ fmt(total_gastos) }}</td>
      </tr></table>
      {% if gastos %}
        <table class="rows">
          {% for m in gastos %}
          <tr><td>{{ m.descripcion or '—' }}</td><td class="amt">{{ fmt(m.monto) }}</td></tr>
          {% endfor %}
        </table>
      {% else %}<div class="empty-row">Sin registros</div>{% endif %}
    </div>
  </td>
  <!-- Transferencias -->
  <td class="sec-cell">
    <div class="section">
      <table class="sec-hdr"><tr>
        <td class="hdr-transf">Transferencias</td>
        <td class="hdr-transf" style="text-align:right">{{ fmt(total_transf) }}</td>
      </tr></table>
      {% if transf %}
        <table class="rows">
          {% for m in transf %}
          <tr><td>{{ m.descripcion or '—' }}</td><td class="amt">{{ fmt(m.monto) }}</td></tr>
          {% endfor %}
        </table>
      {% else %}<div class="empty-row">Sin registros</div>{% endif %}
    </div>
  </td>
</tr>
<tr>
  <!-- Retiro de caja -->
  <td class="sec-cell">
    <div class="section">
      <table class="sec-hdr"><tr>
        <td class="hdr-retiros">Retiro de Caja</td>
        <td class="hdr-retiros" style="text-align:right">{{ fmt(total_retiros) }}</td>
      </tr></table>
      {% if retiros %}
        <table class="rows">
          {% for m in retiros %}
          <tr><td>{{ m.descripcion or '—' }}</td><td class="amt">{{ fmt(m.monto) }}</td></tr>
          {% endfor %}
        </table>
      {% else %}<div class="empty-row">Sin registros</div>{% endif %}
    </div>
  </td>
  <!-- Tarjetas -->
  <td class="sec-cell">
    <div class="section">
      <table class="sec-hdr"><tr>
        <td class="hdr-tarjetas">Tarjetas</td>
        <td class="hdr-tarjetas" style="text-align:right">{{ fmt(total_tarjetas) }}</td>
      </tr></table>
      <table class="rows">
        <tr><td>PROVINCIA</td><td class="amt">{{ fmt(tarjeta_provincia) }}</td></tr>
        <tr><td>NAVE</td><td class="amt">{{ fmt(tarjeta_nave) }}</td></tr>
        <tr><td>FRANCES</td><td class="amt">{{ fmt(tarjeta_frances) }}</td></tr>
        <tr><td>COMAFI</td><td class="amt">{{ fmt(tarjeta_comafi) }}</td></tr>
      </table>
    </div>
  </td>
</tr>
</table>

<!-- Efectivo del día -->
<table class="efectivo"><tr>
  <td class="ef-label">Efectivo del día</td>
  <td class="ef-value">{{ fmt(efectivo_del_dia) }}</td>
</tr></table>

<!-- Resumen -->
<table class="summary"><tr>
  <td><span class="sum-label">Transferencias</span><span class="sum-val c-transf">{{ fmt(total_transf) }}</span></td>
  <td><span class="sum-label">Efectivo</span><span class="sum-val c-efectivo">{{ fmt(efectivo_del_dia) }}</span></td>
  <td><span class="sum-label">Tarjetas</span><span class="sum-val c-tarjeta">{{ fmt(total_tarjetas) }}</span></td>
  <td><span class="sum-label">Gastos + Retiros</span><span class="sum-val c-salidas">- {{ fmt(total_salidas) }}</span></td>
</tr></table>

<!-- Total del día -->
<table class="total-row"><tr>
  <td class="tot-label">Total del Día</td>
  <td class="tot-val">{{ fmt(total_del_dia) }}</td>
</tr></table>

{% if observaciones %}
<div class="obs-box">
  <div class="obs-title">Observaciones</div>
  <div class="obs-text">{{ observaciones }}</div>
</div>
{% endif %}

<div class="footer">Sur Maderas · Mar del Plata · Sistema ERP v1.0 — Documento interno</div>
</body>
</html>
"""

def _generate_caja_pdf(data: dict) -> bytes:
    from datetime import date
    env = Environment(loader=DictLoader({"t": _PDF_TEMPLATE}))
    env.globals["fmt"] = _fmt
    tmpl = env.get_template("t")

    fecha_parts    = data["fecha"].split("-")
    fecha_str      = f"{fecha_parts[2]}/{fecha_parts[1]}/{fecha_parts[0]}"
    sucursal_label = "Sucursal Luro" if data["sucursal"] == "luro" else "Sucursal Independencia"

    html_str = tmpl.render(
        navy              = NAVY,
        coral             = CORAL,
        fecha             = fecha_str,
        sucursal          = sucursal_label,
        cerrada           = data["cerrada"],
        generated         = date.today().strftime("%d/%m/%Y"),
        gastos            = [m for m in data["movimientos"] if m["tipo"] == "gasto"],
        transf            = [m for m in data["movimientos"] if m["tipo"] == "transferencia"],
        retiros           = [m for m in data["movimientos"] if m["tipo"] == "retiro"],
        total_gastos      = data["total_gastos"],
        total_transf      = data["total_transf"],
        total_retiros     = data["total_retiros"],
        total_tarjetas    = data["total_tarjetas"],
        total_del_dia     = data["total_del_dia"],
        total_salidas     = data["total_salidas"],
        efectivo_del_dia  = data["efectivo_del_dia"],
        tarjeta_provincia = data["tarjeta_provincia"],
        tarjeta_nave      = data["tarjeta_nave"],
        tarjeta_frances   = data["tarjeta_frances"],
        tarjeta_comafi    = data["tarjeta_comafi"],
        observaciones     = data.get("observaciones", ""),
    )
    return HTML(string=html_str).write_pdf()


# ═══════════════════════════════════════════════════════════════
# IMPORTANTE: las rutas con segmentos literales ("historial",
# "pdf", "movimientos") DEBEN ir ANTES de las rutas genéricas
# con parámetros ({fecha}/{sucursal}, {caja_id}), porque FastAPI
# las evalúa en orden y /{fecha}/{sucursal} capturaría todo.
# ═══════════════════════════════════════════════════════════════

# ── GET /caja-diaria/historial/{sucursal} ────────────────────────
@router.get("/historial/{sucursal}")
def get_historial(sucursal: str, db: Session = Depends(get_db)):
    cajas = (
        db.query(CajaDiaria)
        .filter(CajaDiaria.sucursal == sucursal)
        .order_by(CajaDiaria.fecha.desc())
        .limit(60)
        .all()
    )
    return [_serialize_caja(c) for c in cajas]


# ── GET /caja-diaria/pdf/{caja_id} ───────────────────────────────
@router.get("/pdf/{caja_id}")
def download_pdf(caja_id: int, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    data      = _serialize_caja(caja)
    pdf_bytes = _generate_caja_pdf(data)
    fname     = f"caja_{caja.sucursal}_{caja.fecha}.pdf"
    return Response(
        content    = pdf_bytes,
        media_type = "application/pdf",
        headers    = {"Content-Disposition": f"attachment; filename={fname}"},
    )


# ── PUT /caja-diaria/movimientos/{mov_id} ────────────────────────
@router.put("/movimientos/{mov_id}")
def update_movimiento(mov_id: int, body: MovimientoUpdate, db: Session = Depends(get_db)):
    mov = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    if body.descripcion is not None: mov.descripcion = body.descripcion
    if body.monto       is not None: mov.monto       = body.monto
    db.commit()
    return {"ok": True}


# ── DELETE /caja-diaria/movimientos/{mov_id} ─────────────────────
@router.delete("/movimientos/{mov_id}")
def delete_movimiento(mov_id: int, db: Session = Depends(get_db)):
    mov = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not mov:
        raise HTTPException(404, "Movimiento no encontrado")
    db.delete(mov)
    db.commit()
    return {"ok": True}


# ── GET /caja-diaria/{fecha}/{sucursal} ──────────────────────────
@router.get("/{fecha}/{sucursal}")
def get_or_create_caja(fecha: DateType, sucursal: str, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(
        CajaDiaria.fecha    == fecha,
        CajaDiaria.sucursal == sucursal,
    ).first()
    if not caja:
        caja = CajaDiaria(fecha=fecha, sucursal=sucursal)
        db.add(caja)
        db.commit()
        db.refresh(caja)
    return _serialize_caja(caja)


# ── PUT /caja-diaria/{caja_id} ────────────────────────────────────
@router.put("/{caja_id}")
def update_caja(caja_id: int, body: CajaUpdate, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    if body.efectivo_del_dia  is not None: caja.efectivo_del_dia  = body.efectivo_del_dia
    if body.tarjeta_provincia is not None: caja.tarjeta_provincia = body.tarjeta_provincia
    if body.tarjeta_nave      is not None: caja.tarjeta_nave      = body.tarjeta_nave
    if body.tarjeta_frances   is not None: caja.tarjeta_frances   = body.tarjeta_frances
    if body.tarjeta_comafi    is not None: caja.tarjeta_comafi    = body.tarjeta_comafi
    if body.observaciones     is not None: caja.observaciones     = body.observaciones
    if body.cerrada           is not None: caja.cerrada           = body.cerrada
    db.commit()
    db.refresh(caja)
    return _serialize_caja(caja)


# ── POST /caja-diaria/{caja_id}/movimientos ───────────────────────
@router.post("/{caja_id}/movimientos", status_code=201)
def add_movimiento(caja_id: int, body: MovimientoIn, db: Session = Depends(get_db)):
    caja = db.query(CajaDiaria).filter(CajaDiaria.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    mov = CajaMovimiento(
        caja_id     = caja_id,
        tipo        = body.tipo,
        descripcion = body.descripcion,
        monto       = body.monto,
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return {"id": mov.id, "tipo": mov.tipo, "descripcion": mov.descripcion, "monto": float(mov.monto)}
