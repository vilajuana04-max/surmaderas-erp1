"""
Base de datos de clientes de Sur Maderas.

- CRUD de clientes (número de cliente = código de cupón de registro)
- Registro de compras (frecuencia)
- Cupón de registro (15% OFF bienvenida)
- Cupón de cumpleaños FELIZ15 — baja una sola vez por año
"""
from datetime import date, datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.clientes import Cliente, ClienteCompra, ClienteFeliz15

router = APIRouter(prefix="/clientes", tags=["clientes"])


# ── Schemas ───────────────────────────────────────────────────────
class ClienteIn(BaseModel):
    numero_cliente:   Optional[str]  = ""
    nombre:           str
    telefono:         Optional[str]  = ""
    email:            Optional[str]  = ""
    fecha_nacimiento: Optional[date] = None
    sucursal:         Optional[str]  = ""
    notas:            Optional[str]  = ""


class ClienteUpdate(BaseModel):
    numero_cliente:   Optional[str]  = None
    nombre:           Optional[str]  = None
    telefono:         Optional[str]  = None
    email:            Optional[str]  = None
    fecha_nacimiento: Optional[date] = None
    sucursal:         Optional[str]  = None
    notas:            Optional[str]  = None
    cupon_registro_usado: Optional[bool] = None


class CompraIn(BaseModel):
    fecha: Optional[date]  = None
    monto: Optional[float] = None
    nota:  Optional[str]   = ""


# ── Serializadores ────────────────────────────────────────────────
def _serialize(c: Cliente) -> dict:
    return {
        "id":               c.id,
        "numero_cliente":   c.numero_cliente or "",
        "nombre":           c.nombre,
        "telefono":         c.telefono or "",
        "email":            c.email or "",
        "fecha_nacimiento": c.fecha_nacimiento.isoformat() if c.fecha_nacimiento else None,
        "sucursal":         c.sucursal or "",
        "notas":            c.notas or "",
        "cupon_registro_usado": bool(c.cupon_registro_usado),
        "cupon_registro_fecha": c.cupon_registro_fecha.isoformat() if c.cupon_registro_fecha else None,
        "total_compras":    len(c.compras),
        "ultima_compra":    c.compras[0].fecha.isoformat() if c.compras else None,
        "compras": [
            {
                "id":    m.id,
                "fecha": m.fecha.isoformat(),
                "monto": float(m.monto) if m.monto is not None else None,
                "nota":  m.nota or "",
            }
            for m in c.compras
        ],
        "feliz15": [
            {"id": f.id, "anio": f.anio, "fecha": f.fecha.isoformat()}
            for f in c.feliz15
        ],
    }


# ── Endpoints ─────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_clientes(q: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Cliente)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (Cliente.nombre.ilike(like))
            | (Cliente.numero_cliente.ilike(like))
            | (Cliente.telefono.ilike(like))
            | (Cliente.email.ilike(like))
        )
    clientes = query.order_by(Cliente.nombre).all()
    return [_serialize(c) for c in clientes]


# ── Sincronización con el registro de cupones (sistema de encuestas) ──
def _norm_sucursal(b: str) -> str:
    b = (b or "").strip().lower()
    if "luro" in b: return "Luro"
    if "indep" in b: return "Independencia"
    return ""

def _parse_iso_date(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except Exception:
        return None


@router.post("/sync-cupones")
async def sync_cupones(db: Session = Depends(get_db)):
    """Importa/actualiza clientes desde las encuestas de cupones de registro."""
    from app.routers.cupones import _get_token, _auth_headers, ENCUESTAS_BASE

    token = await _get_token()
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(f"{ENCUESTAS_BASE}/api/encuestas", headers=_auth_headers(token))
    if not res.is_success:
        raise HTTPException(502, f"No se pudo obtener las encuestas ({res.status_code})")

    data = res.json()
    items = data.get("items") or data.get("encuestas") or (data if isinstance(data, list) else [])

    creados = 0
    actualizados = 0
    for e in items:
        codigo = (e.get("couponCode") or "").strip().upper()
        nombre = (e.get("fullName") or "").strip()
        if not codigo and not nombre:
            continue

        existente = None
        if codigo:
            existente = db.query(Cliente).filter(Cliente.numero_cliente == codigo).first()
        if not existente and e.get("email"):
            existente = db.query(Cliente).filter(Cliente.email == e.get("email").strip()).first()

        usado  = bool(e.get("couponUsed"))
        f_uso  = _parse_iso_date(e.get("couponUsedAt"))
        suc    = _norm_sucursal(e.get("branch") or "")
        tel    = (e.get("phone") or "").strip()
        mail   = (e.get("email") or "").strip()

        if existente:
            # Completa solo campos vacíos para no pisar ediciones manuales
            if not existente.numero_cliente and codigo: existente.numero_cliente = codigo
            if not existente.telefono and tel:  existente.telefono = tel
            if not existente.email and mail:    existente.email = mail
            if not existente.sucursal and suc:  existente.sucursal = suc
            # El estado del cupón de registro SÍ se sincroniza siempre
            existente.cupon_registro_usado = usado
            existente.cupon_registro_fecha = f_uso if usado else None
            actualizados += 1
        else:
            db.add(Cliente(
                numero_cliente       = codigo,
                nombre               = nombre or "(sin nombre)",
                telefono             = tel,
                email                = mail,
                sucursal             = suc,
                cupon_registro_usado = usado,
                cupon_registro_fecha = f_uso if usado else None,
            ))
            creados += 1

    db.commit()
    return {"creados": creados, "actualizados": actualizados, "total_encuestas": len(items)}


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_cliente(data: ClienteIn, db: Session = Depends(get_db)):
    cliente = Cliente(
        numero_cliente   = (data.numero_cliente or "").strip().upper(),
        nombre           = data.nombre.strip(),
        telefono         = (data.telefono or "").strip(),
        email            = (data.email or "").strip(),
        fecha_nacimiento = data.fecha_nacimiento,
        sucursal         = (data.sucursal or "").strip(),
        notas            = (data.notas or "").strip(),
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return _serialize(cliente)


@router.get("/{cliente_id}")
def get_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    return _serialize(c)


@router.put("/{cliente_id}")
def update_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")

    if data.numero_cliente   is not None: c.numero_cliente   = data.numero_cliente.strip().upper()
    if data.nombre           is not None: c.nombre           = data.nombre.strip()
    if data.telefono         is not None: c.telefono         = data.telefono.strip()
    if data.email            is not None: c.email            = data.email.strip()
    if data.fecha_nacimiento is not None: c.fecha_nacimiento = data.fecha_nacimiento
    if data.sucursal         is not None: c.sucursal         = data.sucursal.strip()
    if data.notas            is not None: c.notas            = data.notas.strip()
    if data.cupon_registro_usado is not None:
        c.cupon_registro_usado = data.cupon_registro_usado
        c.cupon_registro_fecha = date.today() if data.cupon_registro_usado else None

    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{cliente_id}", status_code=204)
def delete_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    db.delete(c)
    db.commit()


# ── Compras ───────────────────────────────────────────────────────
@router.post("/{cliente_id}/compras", status_code=201)
def add_compra(cliente_id: int, data: CompraIn, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    compra = ClienteCompra(
        cliente_id = cliente_id,
        fecha      = data.fecha or date.today(),
        monto      = data.monto,
        nota       = (data.nota or "").strip(),
    )
    db.add(compra)
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{cliente_id}/compras/{compra_id}")
def del_compra(cliente_id: int, compra_id: int, db: Session = Depends(get_db)):
    compra = db.query(ClienteCompra).filter(
        ClienteCompra.id == compra_id,
        ClienteCompra.cliente_id == cliente_id,
    ).first()
    if not compra:
        raise HTTPException(404, "Compra no encontrada")
    db.delete(compra)
    db.commit()
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    return _serialize(c)


# ── Cupón de cumpleaños FELIZ15 (una vez por año) ─────────────────
@router.post("/{cliente_id}/feliz15")
def baja_feliz15(cliente_id: int, anio: Optional[int] = None, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")

    year = anio or date.today().year
    ya = db.query(ClienteFeliz15).filter(
        ClienteFeliz15.cliente_id == cliente_id,
        ClienteFeliz15.anio == year,
    ).first()
    if ya:
        raise HTTPException(
            400,
            f"El cupón FELIZ15 ya fue dado de baja en {year} (el {ya.fecha.strftime('%d/%m/%Y')}). "
            "Solo se puede usar una vez por año.",
        )

    reg = ClienteFeliz15(cliente_id=cliente_id, anio=year, fecha=date.today())
    db.add(reg)
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{cliente_id}/feliz15/{anio}")
def revertir_feliz15(cliente_id: int, anio: int, db: Session = Depends(get_db)):
    """Revierte la baja del cupón FELIZ15 de un año (por si fue un error)."""
    reg = db.query(ClienteFeliz15).filter(
        ClienteFeliz15.cliente_id == cliente_id,
        ClienteFeliz15.anio == anio,
    ).first()
    if not reg:
        raise HTTPException(404, "No hay baja registrada para ese año")
    db.delete(reg)
    db.commit()
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    return _serialize(c)
