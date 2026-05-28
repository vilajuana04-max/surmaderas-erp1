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


# ── PDF Template ─────────────────────────────────────────────────
_PDF_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 1.2cm 1.5cm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; margin: 0; }

  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid {{ coral }}; padding-bottom: 10px; margin-bottom: 14px; }
  .brand-name { font-size: 18pt; font-weight: bold; color: {{ navy }}; letter-spacing: 1px; }
  .brand-sub { font-size: 8pt; color: #666; margin-top: 2px; }
  .doc-info { text-align: right; font-size: 8pt; color: #555; }
  .doc-title { font-size: 12pt; font-weight: bold; color: {{ coral }}; }

  .meta-strip { display: flex; gap: 20px; background: {{ navy }}; color: white;
                padding: 8px 12px; border-radius: 6px; margin-bottom: 14px; font-size: 8.5pt; }
  .meta-item label { opacity: 0.6; display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-item span  { font-weight: bold; }
  .badge-open   { background: #16a34a; padding: 2px 8px; border-radius: 10px; font-size: 7.5pt; }
  .badge-closed { background: #dc2626; padding: 2px 8px; border-radius: 10px; font-size: 7.5pt; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .section { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .section-header { display: flex; justify-content: space-between; align-items: center;
                    padding: 6px 10px; font-weight: bold; font-size: 8.5pt; }
  .section-body { padding: 0 10px 6px; }
  .section-body table { width: 100%; border-collapse: collapse; }
  .section-body td { padding: 3px 0; font-size: 8.5pt; border-bottom: 1px solid #f3f4f6; }
  .section-body td:last-child { text-align: right; font-weight: 500; }
  .section-body .empty { color: #9ca3af; font-style: italic; font-size: 8pt; padding: 4px 0; }

  .section-header.gastos  { background: #fee2e2; color: #dc2626; border-left: 3px solid #dc2626; }
  .section-header.transf  { background: #dbeafe; color: #2563eb; border-left: 3px solid #2563eb; }
  .section-header.retiros { background: #fef3c7; color: #d97706; border-left: 3px solid #d97706; }
  .section-header.tarjetas{ background: #ede9fe; color: #7c3aed; border-left: 3px solid #7c3aed; }

  .terminal-row { display: flex; justify-content: space-between; padding: 3px 0;
                  font-size: 8.5pt; border-bottom: 1px solid #f3f4f6; }
  .terminal-row .t-label { color: #6b7280; font-weight: bold; font-size: 7.5pt; }

  .efectivo-box { border: 2px solid {{ coral }}; border-radius: 6px; padding: 8px 12px;
                  display: flex; justify-content: space-between; align-items: center;
                  margin-bottom: 12px; }
  .efectivo-box .label { font-size: 8pt; color: #6b7280; text-transform: uppercase;
                          letter-spacing: 0.5px; font-weight: bold; }
  .efectivo-box .value { font-size: 14pt; font-weight: bold; color: {{ navy }}; }

  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr);
                  gap: 8px; margin-bottom: 12px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .summary-card .s-label { font-size: 7pt; color: #6b7280; text-transform: uppercase;
                            letter-spacing: 0.4px; margin-bottom: 2px; }
  .summary-card .s-value { font-size: 11pt; font-weight: bold; }
  .s-transf  { color: #2563eb; }
  .s-efectivo{ color: #16a34a; }
  .s-tarjeta { color: #7c3aed; }
  .s-salidas { color: #dc2626; }

  .total-box { background: {{ navy }}; color: white; border-radius: 6px; padding: 10px 16px;
               display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .total-box .t-label { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
  .total-box .t-value { font-size: 20pt; font-weight: bold; color: {{ coral }}; }

  .obs-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
  .obs-box .obs-title { font-size: 7.5pt; font-weight: bold; color: #6b7280;
                         text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
  .obs-box .obs-text  { font-size: 8.5pt; color: #374151; }

  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 6px;
            text-align: center; font-size: 7.5pt; color: #9ca3af; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="brand-name">SUR MADERAS</div>
    <div class="brand-sub">Mar del Plata · Sistema ERP v1.0</div>
  </div>
  <div class="doc-info">
    <div class="doc-title">Cierre de Caja</div>
    <div>Generado: {{ generated }}</div>
  </div>
</div>

<!-- Meta strip -->
<div class="meta-strip">
  <div class="meta-item">
    <label>Fecha</label>
    <span>{{ fecha }}</span>
  </div>
  <div class="meta-item">
    <label>Sucursal</label>
    <span>{{ sucursal }}</span>
  </div>
  <div class="meta-item">
    <label>Estado</label>
    <span>
      {% if cerrada %}
        <span class="badge-closed">CERRADA</span>
      {% else %}
        <span class="badge-open">ABIERTA</span>
      {% endif %}
    </span>
  </div>
</div>

<!-- 4 sections grid -->
<div class="grid">

  <!-- Gastos -->
  <div class="section">
    <div class="section-header gastos">
      <span>⬆ Gastos</span>
      <span>{{ fmt(total_gastos) }}</span>
    </div>
    <div class="section-body">
      {% if gastos %}
        <table>
          {% for m in gastos %}
          <tr>
            <td>{{ m.descripcion or '—' }}</td>
            <td>{{ fmt(m.monto) }}</td>
          </tr>
          {% endfor %}
        </table>
      {% else %}
        <p class="empty">Sin registros</p>
      {% endif %}
    </div>
  </div>

  <!-- Transferencias -->
  <div class="section">
    <div class="section-header transf">
      <span>⬇ Transferencias</span>
      <span>{{ fmt(total_transf) }}</span>
    </div>
    <div class="section-body">
      {% if transf %}
        <table>
          {% for m in transf %}
          <tr>
            <td>{{ m.descripcion or '—' }}</td>
            <td>{{ fmt(m.monto) }}</td>
          </tr>
          {% endfor %}
        </table>
      {% else %}
        <p class="empty">Sin registros</p>
      {% endif %}
    </div>
  </div>

  <!-- Retiro de caja -->
  <div class="section">
    <div class="section-header retiros">
      <span>💵 Retiro de Caja</span>
      <span>{{ fmt(total_retiros) }}</span>
    </div>
    <div class="section-body">
      {% if retiros %}
        <table>
          {% for m in retiros %}
          <tr>
            <td>{{ m.descripcion or '—' }}</td>
            <td>{{ fmt(m.monto) }}</td>
          </tr>
          {% endfor %}
        </table>
      {% else %}
        <p class="empty">Sin registros</p>
      {% endif %}
    </div>
  </div>

  <!-- Tarjetas -->
  <div class="section">
    <div class="section-header tarjetas">
      <span>💳 Tarjetas</span>
      <span>{{ fmt(total_tarjetas) }}</span>
    </div>
    <div class="section-body" style="padding-top:6px">
      <div class="terminal-row">
        <span class="t-label">PROVINCIA</span>
        <span>{{ fmt(tarjeta_provincia) }}</span>
      </div>
      <div class="terminal-row">
        <span class="t-label">NAVE</span>
        <span>{{ fmt(tarjeta_nave) }}</span>
      </div>
      <div class="terminal-row">
        <span class="t-label">FRANCÉS</span>
        <span>{{ fmt(tarjeta_frances) }}</span>
      </div>
      <div class="terminal-row" style="border-bottom:none">
        <span class="t-label">COMAFI</span>
        <span>{{ fmt(tarjeta_comafi) }}</span>
      </div>
    </div>
  </div>

</div>

<!-- Efectivo del día -->
<div class="efectivo-box">
  <span class="label">Efectivo del día</span>
  <span class="value">{{ fmt(efectivo_del_dia) }}</span>
</div>

<!-- Summary -->
<div class="summary-grid">
  <div class="summary-card">
    <div class="s-label">Transferencias</div>
    <div class="s-value s-transf">{{ fmt(total_transf) }}</div>
  </div>
  <div class="summary-card">
    <div class="s-label">Efectivo</div>
    <div class="s-value s-efectivo">{{ fmt(efectivo_del_dia) }}</div>
  </div>
  <div class="summary-card">
    <div class="s-label">Tarjetas</div>
    <div class="s-value s-tarjeta">{{ fmt(total_tarjetas) }}</div>
  </div>
  <div class="summary-card">
    <div class="s-label">Gastos + Retiros</div>
    <div class="s-value s-salidas">- {{ fmt(total_salidas) }}</div>
  </div>
</div>

<!-- Total del día -->
<div class="total-box">
  <span class="t-label">Total del Día</span>
  <span class="t-value">{{ fmt(total_del_dia) }}</span>
</div>

{% if observaciones %}
<div class="obs-box">
  <div class="obs-title">Observaciones del día</div>
  <div class="obs-text">{{ observaciones }}</div>
</div>
{% endif %}

<div class="footer">Sur Maderas · Mar del Plata · Sistema ERP v1.0 — Documento generado automáticamente</div>

</body>
</html>
"""

def _generate_caja_pdf(data: dict) -> bytes:
    from datetime import date
    env = Environment(loader=DictLoader({"t": _PDF_TEMPLATE}))
    env.globals["fmt"] = _fmt
    tmpl = env.get_template("t")

    fecha_parts = data["fecha"].split("-")
    fecha_str   = f"{fecha_parts[2]}/{fecha_parts[1]}/{fecha_parts[0]}"
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
def historial(sucursal: str, db: Session = Depends(get_db)):
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
