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
    categoria:   Optional[str] = None

class MovimientoUpdate(BaseModel):
    descripcion: Optional[str]   = None
    monto:       Optional[float] = None
    categoria:   Optional[str]   = None

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

# fpdf2 con Helvetica solo soporta Latin-1 (ISO 8859-1).
# Esta funcion reemplaza cualquier caracter fuera de ese rango con '?'
# para que jamas explote, sin importar lo que escribio el usuario.
_LATIN1_SUBS = {
    '—': '-',   # em dash —
    '–': '-',   # en dash -
    '‘': "'",   # comilla izq '
    '’': "'",   # comilla der '
    '“': '"',   # comilla doble izq "
    '”': '"',   # comilla doble der "
    '…': '...',  # puntos suspensivos
    '·': '.',   # punto medio
    '•': '*',   # bullet
}
def _safe(text: str) -> str:
    if not text:
        return ''
    for src, dst in _LATIN1_SUBS.items():
        text = text.replace(src, dst)
    return text.encode('latin-1', errors='replace').decode('latin-1')

MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

def _serialize_caja(c: CajaDiaria) -> dict:
    movs = [
        {
            "id":          m.id,
            "tipo":        m.tipo,
            "descripcion": m.descripcion or '',
            "monto":       float(m.monto),
            "categoria":   m.categoria or '',
        }
        for m in c.movimientos
    ]
    total_gastos   = sum(m["monto"] for m in movs if m["tipo"] == "gasto")
    total_transf   = sum(m["monto"] for m in movs if m["tipo"] == "transferencia")
    total_retiros  = sum(m["monto"] for m in movs if m["tipo"] == "retiro")
    total_link     = sum(m["monto"] for m in movs if m["tipo"] == "link")
    total_tarjetas = (
        float(c.tarjeta_provincia) + float(c.tarjeta_nave) +
        float(c.tarjeta_frances)   + float(c.tarjeta_comafi)
    )
    # efectivo_del_dia ya no se ingresa manualmente; se deriva del total de links
    total_del_dia = total_transf + total_link + total_tarjetas
    total_salidas = total_gastos + total_retiros

    return {
        "id":                 c.id,
        "fecha":              c.fecha.isoformat(),
        "sucursal":           c.sucursal,
        "efectivo_del_dia":   total_link,   # compat: expuesto como efectivo = link
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
        "total_link":         total_link,
        "total_tarjetas":     total_tarjetas,
        "total_del_dia":      total_del_dia,
        "total_salidas":      total_salidas,
    }


# ── PDF con fpdf2 — Landscape A4 ─────────────────────────────────
def _generate_caja_pdf(data: dict) -> bytes:
    y_parts   = data["fecha"].split("-")
    fecha_str = f"{y_parts[2]}/{y_parts[1]}/{y_parts[0]}"
    suc_label = "Sucursal Luro" if data["sucursal"] == "luro" else "Sucursal Independencia"
    generado  = date.today().strftime("%d/%m/%Y")

    gastos  = [m for m in data["movimientos"] if m["tipo"] == "gasto"]
    transf  = [m for m in data["movimientos"] if m["tipo"] == "transferencia"]
    retiros = [m for m in data["movimientos"] if m["tipo"] == "retiro"]
    links   = [m for m in data["movimientos"] if m["tipo"] == "link"]

    # Landscape A4: 297 x 210 mm
    pdf = FPDF(orientation="L", format="A4")
    pdf.set_auto_page_break(auto=False)   # una sola hoja, sin páginas fantasma
    pdf.add_page()
    W  = 267.0   # 297 - 30 (margenes 15 c/u)
    x0 = 15.0

    # ── Header ────────────────────────────────────────────────────
    pdf.set_y(15)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.set_x(x0)
    pdf.cell(W * 0.65, 10, "SUR MADERAS", ln=0)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W * 0.35, 10, "Cierre de Caja Diaria", ln=0, align="R")
    pdf.ln(10)
    pdf.set_x(x0)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(130, 130, 130)
    pdf.cell(W * 0.65, 4, "Mar del Plata  |  Sistema ERP v1.0", ln=0)
    pdf.cell(W * 0.35, 4, f"Generado: {generado}", ln=0, align="R")
    pdf.ln(4)
    # linea coral
    pdf.set_draw_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.set_line_width(0.8)
    pdf.line(x0, pdf.get_y(), x0 + W, pdf.get_y())
    pdf.ln(3)

    # ── Meta strip (navy, 4 columnas) ────────────────────────────
    strip_y = pdf.get_y()
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(x0, strip_y, W, 14, "F")
    meta_items = [
        ("FECHA",    fecha_str),
        ("SUCURSAL", suc_label),
        ("ESTADO",   "CERRADA" if data["cerrada"] else "ABIERTA"),
        ("GENERADO", generado),
    ]
    cw_meta = W / 4
    for i, (lbl, val) in enumerate(meta_items):
        xi = x0 + cw_meta * i
        pdf.set_xy(xi + 3, strip_y + 2)
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(140, 140, 170)
        pdf.cell(cw_meta - 3, 4, lbl, ln=0)
        pdf.set_xy(xi + 3, strip_y + 7)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(cw_meta - 3, 5, val, ln=0)
    pdf.set_y(strip_y + 18)

    # ── Escala dinámica: una sola hoja siempre ────────────────────
    # Calculamos alto de fila (rh) y tamaño de letra (fs) según cuántos
    # movimientos hay, para que TODO entre en una página.
    n_g, n_t, n_l, n_r = len(gastos), len(transf), len(links), len(retiros)
    filas_apiladas = max(n_g or 1, n_t or 1) + max(n_l or 1, n_r or 1) + 4  # +4 tarjetas
    sec_start = pdf.get_y()
    TOTALS_H  = 46.0           # parcial + tarjetas/link + total del día
    FOOTER_H  = 14.0
    HEADERS_H = 8 + 8 + 11 + 10  # 2 headers de sección + tarjetas + gaps
    disponible = (pdf.h - FOOTER_H) - sec_start - TOTALS_H - HEADERS_H
    rh = disponible / filas_apiladas
    rh = max(3.0, min(6.0, rh))
    fs = 8.0 if rh >= 5.5 else 7.0 if rh >= 4.5 else 6.0 if rh >= 3.8 else 5.0

    # ── Helper: dibujar una seccion con coordenadas fijas ─────────
    def draw_section(title, items, total, hdr_r, hdr_g, hdr_b,
                     x_off, y_off, col_width):
        # cabecera coloreada: primero el fondo, luego título (izq) y total (der)
        pdf.set_fill_color(hdr_r, hdr_g, hdr_b)
        pdf.rect(x_off, y_off, col_width, 8, "F")
        pdf.set_text_color(255, 255, 255)
        pdf.set_xy(x_off + 2, y_off)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(col_width * 0.55, 8, _safe(title), ln=0, align="L")
        pdf.set_xy(x_off, y_off)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(col_width - 2, 8, _fmt(total), ln=0, align="R")
        y = y_off + 8
        # filas
        if not items:
            pdf.set_xy(x_off, y)
            pdf.set_text_color(160, 160, 160)
            pdf.set_font("Helvetica", "I", max(5.5, fs - 1))
            pdf.cell(col_width, rh, "  Sin registros", border="LRB", ln=0)
            y += rh
        else:
            for idx, m in enumerate(items):
                bg = (250, 250, 252) if idx % 2 == 1 else (255, 255, 255)
                pdf.set_fill_color(*bg)
                desc = _safe(m["descripcion"] or "-")[:42]
                pdf.set_xy(x_off, y)
                pdf.set_font("Helvetica", "", fs)
                pdf.set_text_color(40, 40, 40)
                pdf.cell(col_width * 0.6, rh, f"  {desc}",
                         border="LB", fill=True, ln=0)
                pdf.set_xy(x_off + col_width * 0.6, y)
                pdf.set_font("Helvetica", "B", fs)
                pdf.cell(col_width * 0.4, rh, _fmt(m["monto"]),
                         border="RB", align="R", fill=True, ln=0)
                y += rh
        return y

    # ── Secciones en 2 columnas ───────────────────────────────────
    gap   = 5.0
    col_w = (W - gap) / 2
    x_l   = x0
    x_r   = x0 + col_w + gap

    # Fila 1: Gastos | Transferencias — misma y de arranque
    row1_y = pdf.get_y()
    yL = draw_section("GASTOS",         gastos, data["total_gastos"],
                      200, 70, 70,   x_l, row1_y, col_w)
    yR = draw_section("TRANSFERENCIAS", transf, data["total_transf"],
                      50, 100, 210,  x_r, row1_y, col_w)

    # Fila 2: Link de Pago | Retiro de Caja
    row2_y = max(yL, yR) + 5
    yL2 = draw_section("LINK DE PAGO", links, data["total_link"],
                       34, 197, 94,  x_l, row2_y, col_w)
    yR2 = draw_section("RETIRO DE CAJA", retiros, data["total_retiros"],
                       200, 150, 40, x_r, row2_y, col_w)

    # Fila 3: Tarjetas (izquierda)
    row3_y = max(yL2, yR2) + 5
    # dummy yL3 for alignment
    yL3 = row3_y

    # Tarjetas (filas fijas de terminales) — fila 3 lado izquierdo
    pdf.set_fill_color(110, 70, 200)
    pdf.rect(x_l, row3_y, col_w, 11, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(x_l + 2, row3_y)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(col_w * 0.5, 11, "TARJETAS", ln=0, align="L")
    pdf.set_xy(x_l, row3_y)
    pdf.set_font("Helvetica", "B", 14)   # total tarjetas mas grande
    pdf.cell(col_w - 3, 11, _fmt(data["total_tarjetas"]), ln=0, align="R")
    yT = row3_y + 11
    for idx, (label, key) in enumerate([
            ("PROVINCIA", "tarjeta_provincia"), ("NAVE",   "tarjeta_nave"),
            ("FRANCES",   "tarjeta_frances"),   ("COMAFI", "tarjeta_comafi")]):
        bg = (250, 250, 252) if idx % 2 == 1 else (255, 255, 255)
        pdf.set_fill_color(*bg)
        pdf.set_xy(x_l, yT)
        pdf.set_font("Helvetica", "", fs)
        pdf.set_text_color(40, 40, 40)
        pdf.cell(col_w * 0.55, rh, f"  {label}", border="LB", fill=True, ln=0)
        pdf.set_xy(x_l + col_w * 0.55, yT)
        pdf.set_font("Helvetica", "B", fs)
        pdf.cell(col_w * 0.45, rh, _fmt(data[key]),
                 border="RB", align="R", fill=True, ln=0)
        yT += rh

    pdf.set_y(max(yL3, yT) + 5)

    # Agrupación: Parcial = Transferencias + Salidas | Tarjetas+Link aparte
    parcial        = data["total_transf"] + data["total_salidas"]
    tarjetas_link  = data["total_tarjetas"] + data["total_link"]
    total_pdf      = parcial + tarjetas_link

    def strip(label, value, bg, fg, y, h=11, fs=14):
        pdf.set_fill_color(*bg)
        pdf.rect(x0, y, W, h, "F")
        pdf.set_text_color(*fg)
        pdf.set_xy(x0 + 5, y + (h - 5) / 2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(W * 0.5, 5, label, ln=0, align="L")
        pdf.set_xy(x0, y + 1)
        pdf.set_font("Helvetica", "B", fs)
        pdf.cell(W - 5, h - 2, _fmt(value), ln=0, align="R")

    y = pdf.get_y()
    strip("PARCIAL (Transferencias + Salidas)", parcial, (240, 244, 255), (37, 99, 235), y, h=10, fs=13)
    y += 11
    strip("TARJETAS + LINK DE PAGO", tarjetas_link, (243, 240, 252), (110, 70, 200), y, h=10, fs=13)
    y += 13

    # ── Total del Dia (banner navy, grande) ───────────────────────
    pdf.set_fill_color(NAVY_R, NAVY_G, NAVY_B)
    pdf.rect(x0, y, W, 20, "F")
    pdf.set_xy(x0 + 6, y + 6)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(200, 200, 220)
    pdf.cell(W * 0.45, 8, "TOTAL DEL DIA", ln=0)
    pdf.set_xy(x0, y + 2)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(CORAL_R, CORAL_G, CORAL_B)
    pdf.cell(W - 6, 16, _fmt(total_pdf), ln=0, align="R")
    pdf.set_y(y + 23)

    # ── Observaciones ────────────────────────────────────────────
    if data.get("observaciones"):
        pdf.set_x(x0)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(110, 110, 110)
        pdf.cell(W, 5, "OBSERVACIONES", ln=1)
        pdf.set_x(x0)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(W, 5, _safe(data.get("observaciones") or ""))

    # ── Footer ───────────────────────────────────────────────────
    pdf.set_y(pdf.h - 13)
    pdf.set_draw_color(210, 210, 210)
    pdf.set_line_width(0.3)
    pdf.line(x0, pdf.get_y(), x0 + W, pdf.get_y())
    pdf.ln(2)
    pdf.set_x(x0)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(W, 5,
             "Sur Maderas  |  Mar del Plata  |  Sistema ERP v1.0  |  Documento interno",
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


# ── POST /caja-diaria/resync-cierres ─────────────────────────────
@router.post("/resync-cierres")
def resync_cierres(db: Session = Depends(get_db)):
    """Re-sincroniza Gastos Luro y Ventas para TODAS las cajas ya cerradas."""
    from app.models.expenses import LuroExpense
    cajas = db.query(CajaDiaria).filter(CajaDiaria.cerrada == True).all()  # noqa: E712
    ok = 0
    errores = []
    for c in cajas:
        errs = _sync_cierre(c, c.id, db)
        if errs:
            errores.append(f"{c.fecha} {c.sucursal}: {'; '.join(errs)}")
        else:
            ok += 1

    # Diagnóstico: gastos de caja por mes que quedaron en Gastos Luro
    rows = db.query(LuroExpense).filter(LuroExpense.caja_id.isnot(None)).all()
    por_mes: dict = {}
    for r in rows:
        k = f"{r.month}/{r.year}"
        por_mes[k] = por_mes.get(k, 0) + 1

    return {
        "cajas_sincronizadas": ok,
        "con_error": len(errores),
        "errores": errores[:10],
        "gastos_de_caja_total": len(rows),
        "gastos_por_mes": por_mes,
    }


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
    if body.categoria   is not None: mov.categoria   = body.categoria
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

    # Guardar el estado de la caja PRIMERO (el cierre nunca debe fallar
    # por un problema en las sincronizaciones posteriores).
    db.commit()
    db.refresh(caja)

    # ── Sincronizaciones al cerrar (independientes entre sí) ──
    errores = []
    if body.cerrada is True:
        errores = _sync_cierre(caja, caja_id, db)

    db.refresh(caja)
    if errores:
        # La caja YA quedó cerrada; sólo avisamos qué sincronización falló.
        raise HTTPException(500, "Caja cerrada, pero falló: " + " | ".join(errores))
    return _serialize_caja(caja)


def _sync_cierre(caja, caja_id: int, db: Session) -> list:
    """Al cerrar: gastos → Gastos Luro y tarjetas/total → Ventas.
    Cada sincronización es independiente: si una falla, la otra igual corre."""
    from app.models.expenses import LuroExpense
    from app.models.sales import DailySales

    errores = []
    fecha = caja.fecha
    # La planilla de Gastos Luro filtra por mes en MAYÚSCULAS (ej: "JUNIO")
    month_name = MESES_ES[fecha.month - 1].upper()

    # 1) Gastos → Gastos Luro (idempotente)
    try:
        db.query(LuroExpense).filter(LuroExpense.caja_id == caja_id).delete()
        for mov in [m for m in caja.movimientos if m.tipo == 'gasto']:
            db.add(LuroExpense(
                caja_id=caja_id, month=month_name, year=fecha.year, expense_date=fecha,
                categoria=mov.categoria or 'Gastos Caja',
                subcategoria=mov.descripcion or '', detail=mov.descripcion or '',
                amount=mov.monto, payment_method='efectivo', tipo_costo='variable',
                pagado='SI', paid_status=True,
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        errores.append(f"Gastos Luro: {type(e).__name__}: {e}")

    # 2) Tarjetas + Total del día → Ventas
    try:
        branch_id = 1 if caja.sucursal == 'luro' else 2
        d = _serialize_caja(caja)
        total_tarjetas = d["total_tarjetas"]
        total_dia = d["total_transf"] + d["total_salidas"] + d["total_tarjetas"] + d["total_link"]
        venta = db.query(DailySales).filter(
            DailySales.sale_date == fecha, DailySales.branch_id == branch_id,
        ).first()
        if venta:
            venta.card_payments = total_tarjetas
            venta.total_amount  = total_dia
        else:
            db.add(DailySales(
                sale_date=fecha, branch_id=branch_id,
                total_amount=total_dia, card_payments=total_tarjetas,
                month_label=MESES_ES[fecha.month - 1].upper(), year=fecha.year,
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        errores.append(f"Ventas: {type(e).__name__}: {e}")

    return errores


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
        categoria   = body.categoria,
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return {
        "id":          mov.id,
        "tipo":        mov.tipo,
        "descripcion": mov.descripcion,
        "monto":       float(mov.monto),
        "categoria":   mov.categoria or '',
    }
