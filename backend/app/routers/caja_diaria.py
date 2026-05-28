from datetime import date as DateType
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.caja import CajaDiaria, CajaMovimiento

router = APIRouter(prefix="/caja-diaria", tags=["caja-diaria"])


# ── Schemas ──────────────────────────────────────────────────────
class MovimientoIn(BaseModel):
    tipo:        str   # gasto | transferencia | retiro
    descripcion: str = ''
    monto:       float = 0

class MovimientoUpdate(BaseModel):
    descripcion: Optional[str] = None
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
    total_gastos     = sum(m["monto"] for m in movs if m["tipo"] == "gasto")
    total_transf     = sum(m["monto"] for m in movs if m["tipo"] == "transferencia")
    total_retiros    = sum(m["monto"] for m in movs if m["tipo"] == "retiro")
    total_tarjetas   = (
        float(c.tarjeta_provincia) + float(c.tarjeta_nave) +
        float(c.tarjeta_frances)   + float(c.tarjeta_comafi)
    )
    efectivo         = float(c.efectivo_del_dia)
    total_del_dia    = total_transf + efectivo + total_tarjetas
    total_salidas    = total_gastos + total_retiros

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
        # calculados
        "total_gastos":       total_gastos,
        "total_transf":       total_transf,
        "total_retiros":      total_retiros,
        "total_tarjetas":     total_tarjetas,
        "total_del_dia":      total_del_dia,
        "total_salidas":      total_salidas,
    }


# ── GET /caja-diaria/{fecha}/{sucursal}  — get or create ─────────
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


# ── GET /caja-diaria/historial/{sucursal} ────────────────────────
@router.get("/historial/{sucursal}")
def historial(sucursal: str, year: int = 0, month: int = 0, db: Session = Depends(get_db)):
    q = db.query(CajaDiaria).filter(CajaDiaria.sucursal == sucursal)
    if year  > 0: q = q.filter(db.query(CajaDiaria).filter(
        CajaDiaria.fecha.between(f"{year}-{month:02d}-01", f"{year}-{month:02d}-31")
    ))
    cajas = (
        db.query(CajaDiaria)
        .filter(CajaDiaria.sucursal == sucursal)
        .order_by(CajaDiaria.fecha.desc())
        .limit(60)
        .all()
    )
    return [_serialize_caja(c) for c in cajas]
