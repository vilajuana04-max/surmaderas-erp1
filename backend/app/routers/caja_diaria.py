from datetime import date as DateType, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fpdf import FPDF

from app.database import get_db
from app.models.caja import CajaDiaria, CajaMovimiento

router = APIRouter(prefix="/caja-diaria", tags=["caja-diaria"])

NAVY_R,  NAVY_G,  NAVY_B  = 7,   6,  20   # #070614
CORAL_R, CORAL_G, CORAL_B = 200, 96, 58   # #C8603A

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
def _fmt(n: float) -> str:
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


# ── PDF con fpdf2 (sin dependencias del sistema) ──────────────────
def _generate_caja_pdf(data: dict) -> bytes:
    y_parts  = data["fecha"].split("-")
    fecha_str = f"{y_parts[2]}/{y_parts[1]}/{y_parts[0]}"
    suc_label = "Sucursal Luro" if data["sucursal"] == "luro" else "Sucursal Independencia"
    generado  = date.today().strftime("%d/%m/%Y")

    gastos  = [m for m in data["movimientos"] if m["tipo"] == "gasto"]
    transf  = [m for m in data["movimientos"] if m["tipo"] == "transferencia"]
    retiros = [m for m in data["movimientos"] if m["tipo"] == "retiro"]

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    W = pdf.w - 30   # usable width

    # ── Header ────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.cell(W * 0.65, 8, "SUR MADERAS", ln=0)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W * 0.35, 8, "Cierre de Caja", ln=0, align="R")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(W * 0.65, 5, "Mar del Plata  |  Sistema ERP v1.0", ln=0)
    pdf.cell(W * 0.35, 5, f"Generado: {generado}", ln=0, align="R")
    pdf.ln(5)
    # separador coral
    pdf.set_draw_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.set_line_width(0.8)
    pdf.line(15, pdf.get_y(), 15 + W, pdf.get_y())
    pdf.ln(4)

    # ── Meta strip (fondo navy) ───────────────────────────────────
    strip_y = pdf.get_y()
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(15, strip_y, W, 12, "F")
    pdf.set_y(strip_y + 2)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(180, 180, 200)

    col = W / 3
    for label, val in [("FECHA", fecha_str), ("SUCURSAL", suc_label),
                        ("ESTADO", "CERRADA" if data["cerrada"] else "ABIERTA")]:
        x = 15 + col * [("FECHA", fecha_str), ("SUCURSAL", suc_label),
                          ("ESTADO", "CERRADA" if data["cerrada"] else "ABIERTA")].index((label, val))
        pdf.set_xy(x, strip_y + 1.5)
        pdf.cell(col, 4, label, ln=0)
    pdf.set_y(strip_y + 5)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    for i, val in enumerate([fecha_str, suc_label,
                              "CERRADA" if data["cerrada"] else "ABIERTA"]):
        pdf.set_xy(15 + col * i, strip_y + 6)
        pdf.cell(col, 5, val, ln=0)
    pdf.ln(16)
    pdf.set_text_color(30, 30, 30)

    # ── Secciones (2 columnas) ────────────────────────────────────
    def section(title: str, items: list, total: float,
                hdr_r: int, hdr_g: int, hdr_b: int,
                x_off: float, col_w: float):
        y0 = pdf.get_y()
        # cabecera de sección
        pdf.set_fill_color(hdr_r, hdr_g, hdr_b)
        pdf.set_xy(x_off, y0)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(col_w, 7, f"  {title}", ln=0, fill=True)
        pdf.set_xy(x_off, y0)
        pdf.cell(col_w, 7, _fmt(total), ln=0, align="R", fill=True)
        y0 += 7
        # filas
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(40, 40, 40)
        if not items:
            pdf.set_xy(x_off, y0)
            pdf.set_text_color(160, 160, 160)
            pdf.set_font("Helvetica", "I", 7.5)
            pdf.cell(col_w, 6, "  Sin registros", ln=0,
                     border="LRB", fill=False)
            pdf.set_text_color(40, 40, 40)
            y0 += 6
        else:
            for m in items:
                pdf.set_xy(x_off, y0)
                desc = (m["descripcion"] or "-")[:32]
                pdf.cell(col_w * 0.6, 6, f"  {desc}", ln=0, border="L")
                pdf.set_xy(x_off + col_w * 0.6, y0)
                pdf.cell(col_w * 0.4, 6, _fmt(m["monto"]), ln=0,
                         align="R", border="R")
                y0 += 6
        # borde inferior
        pdf.set_draw_color(220, 220, 220)
        pdf.set_line_width(0.3)
        pdf.line(x_off, y0, x_off + col_w, y0)
        return y0

    gap  = 4
    col_w = (W - gap) / 2
    x_l  = 15
    x_r  = 15 + col_w + gap

    y_start = pdf.get_y()

    # fila 1: Gastos | Transferencias
    yL = section("Gastos",        gastos, data["total_gastos"],
                 200, 80, 80,  x_l, col_w)
    yR = section("Transferencias", transf, data["total_transf"],
                 60, 100, 210, x_r, col_w)
    pdf.set_y(max(yL, yR) + 4)

    # fila 2: Retiro de Caja | Tarjetas
    yL2 = section("Retiro de Caja", retiros, data["total_retiros"],
                  210, 160, 50, x_l, col_w)

    # Tarjetas: sección especial con terminales fijas
    y0t = pdf.get_y()
    # Si la col izquierda terminó más abajo, ajustar
    y0t = max(yL2, pdf.get_y()) - (max(yL2, pdf.get_y()) - pdf.get_y())
    # Recalcular: usar misma y que col izquierda empezo
    y0t_start = max(yL, yR) + 4
    pdf.set_xy(x_r, y0t_start)

    pdf.set_fill_color(120, 80, 200)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(col_w, 7, "  Tarjetas", ln=0, fill=True)
    pdf.set_xy(x_r, y0t_start)
    pdf.cell(col_w, 7, _fmt(data["total_tarjetas"]), ln=0, align="R", fill=True)
    y0t = y0t_start + 7
    pdf.set_text_color(40, 40, 40)
    pdf.set_font("Helvetica", "", 8)
    for label, key in [("PROVINCIA", "tarjeta_provincia"), ("NAVE", "tarjeta_nave"),
                        ("FRANCES",  "tarjeta_frances"),   ("COMAFI", "tarjeta_comafi")]:
        pdf.set_xy(x_r, y0t)
        pdf.cell(col_w * 0.55, 6, f"  {label}", ln=0, border="L")
        pdf.set_xy(x_r + col_w * 0.55, y0t)
        pdf.cell(col_w * 0.45, 6, _fmt(data[key]), ln=0, align="R", border="R")
        y0t += 6
    pdf.set_draw_color(220, 220, 220)
    pdf.set_line_width(0.3)
    pdf.line(x_r, y0t, x_r + col_w, y0t)

    pdf.set_y(max(yL2, y0t) + 5)

    # ── Efectivo del día ──────────────────────────────────────────
    pdf.set_draw_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.set_line_width(0.5)
    ef_y = pdf.get_y()
    pdf.rect(15, ef_y, W, 10)
    pdf.set_xy(17, ef_y + 1.5)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(W * 0.5, 7, "EFECTIVO DEL DÍA", ln=0)
    pdf.set_xy(15, ef_y + 1.5)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.cell(W - 2, 7, _fmt(data["efectivo_del_dia"]), ln=0, align="R")
    pdf.ln(14)

    # ── Resumen 4 celdas ─────────────────────────────────────────
    cw4 = W / 4
    sum_y = pdf.get_y()
    colors = [
        ("Transferencias", data["total_transf"],      37, 99, 235),
        ("Efectivo",       data["efectivo_del_dia"],  22, 163, 74),
        ("Tarjetas",       data["total_tarjetas"],   124, 58, 237),
        ("Gastos+Retiros", data["total_salidas"],    220, 38, 38),
    ]
    pdf.set_draw_color(220, 220, 220)
    pdf.set_line_width(0.3)
    for i, (lbl, val, r, g, b) in enumerate(colors):
        x = 15 + cw4 * i
        pdf.rect(x, sum_y, cw4, 14)
        pdf.set_xy(x + 1, sum_y + 1.5)
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(cw4 - 2, 4, lbl.upper(), ln=0)
        pdf.set_xy(x + 1, sum_y + 6)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(r, g, b)
        prefix = "- " if lbl == "Gastos+Retiros" else ""
        pdf.cell(cw4 - 2, 6, prefix + _fmt(val), ln=0)
    pdf.ln(18)

    # ── Total del día ─────────────────────────────────────────────
    tot_y = pdf.get_y()
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(15, tot_y, W, 14, "F")
    pdf.set_xy(17, tot_y + 3)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(180, 180, 200)
    pdf.cell(W * 0.5, 8, "TOTAL DEL DÍA", ln=0)
    pdf.set_xy(15, tot_y + 2)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W - 2, 10, _fmt(data["total_del_dia"]), ln=0, align="R")
    pdf.ln(18)

    # ── Observaciones ─────────────────────────────────────────────
    if data.get("observaciones"):
        pdf.set_draw_color(220, 220, 220)
        pdf.set_line_width(0.3)
        obs_y = pdf.get_y()
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(W, 5, "OBSERVACIONES", ln=1)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(W, 5, data["observaciones"])
        pdf.ln(2)

    # ── Footer ────────────────────────────────────────────────────
    pdf.set_y(-18)
    pdf.set_draw_color(220, 220, 220)
    pdf.set_line_width(0.3)
    pdf.line(15, pdf.get_y(), 15 + W, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(W, 5, "Sur Maderas  |  Mar del Plata  |  Sistema ERP v1.0  |  Documento interno",
             align="C")

    return bytes(pdf.output())


# ═══════════════════════════════════════════════════════════════
# RUTAS: literales primero, paramétricas al final
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
    try:
        data      = _serialize_caja(caja)
        pdf_bytes = _generate_caja_pdf(data)
    except Exception as exc:
        raise HTTPException(500, f"Error generando PDF: {exc}")
    fname = f"caja_{caja.sucursal}_{caja.fecha}.pdf"
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
