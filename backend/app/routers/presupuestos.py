"""Solicitudes y seguimiento de presupuestos.

Permisos (módulo 'presupuestos'):
  - view  = Cargar  (vendedor: solo registra nuevas solicitudes)
  - edit  = Gestionar (ver todo, presupuestar, enviar, cambiar estados)
  - admin = Administrar (acceso completo)
El gate global (enforce) exige 'view' para todo /presupuestos; acá se exige
'edit' en los endpoints de gestión vía require_manage.
"""
import re
from decimal import Decimal
from datetime import date as DateType, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.users import User
from app.models.presupuestos import QuoteRequest, QuoteAttachment, QuoteHistory
from app.permissions import effective_permissions, LEVEL_RANK

router = APIRouter(prefix="/presupuestos", tags=["presupuestos"])

VENDEDORES = ["Ariel Viejo", "Pato", "Juana", "Martin", "Cecilia", "Gustavo"]
STATUSES = ["pendiente", "en_preparacion", "listo", "enviado", "aceptado", "no_concretado"]
STATUS_LABELS = {
    "pendiente": "Pendiente",
    "en_preparacion": "En preparación",
    "listo": "Listo para enviar",
    "enviado": "Enviado · Esperando respuesta",
    "aceptado": "Aceptado",
    "no_concretado": "No concretado",
}
CLOSE_REASONS = ["Precio", "Demora", "Cliente no respondió", "Lo resolvió por otro lado", "Otro"]
WA_TEMPLATE = (
    "Hola {cliente}! ¿Cómo estás? Te envío el presupuesto que consultaste en Sur Maderas.\n\n"
    "{descripcion}\n\n"
    "Total: {total}\n"
    "Plazo estimado: {plazo}\n\n"
    "Cualquier consulta estamos a disposición."
)


# ── Schemas ───────────────────────────────────────────────────────
class QuoteCreate(BaseModel):
    customer_name: str
    phone: str
    phone_normalized: Optional[str] = ""
    request_date: Optional[DateType] = None
    vendedor: Optional[str] = ""
    materials: Optional[str] = ""
    description: Optional[str] = ""
    images: Optional[List[str]] = None   # data URLs base64 (comprimidas en el cliente)


class QuoteUpdate(BaseModel):
    materials: Optional[str] = None
    description: Optional[str] = None
    quoted_amount: Optional[float] = None
    estimated_lead_time: Optional[str] = None
    validity: Optional[str] = None
    internal_notes: Optional[str] = None
    whatsapp_message: Optional[str] = None


class StatusChange(BaseModel):
    status: str
    close_reason: Optional[str] = ""


# ── Helpers ───────────────────────────────────────────────────────
def require_manage(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    lvl = effective_permissions(user, db).get("presupuestos", "none")
    if LEVEL_RANK.get(lvl, 0) < LEVEL_RANK["edit"]:
        raise HTTPException(403, "Necesitás permiso de gestión de presupuestos.")
    return user


def normalize_ar_phone(raw: str) -> str:
    d = re.sub(r"\D", "", raw or "")
    if not d:
        return ""
    if d.startswith("00"):
        d = d[2:]
    if d.startswith("54"):
        return d
    if d.startswith("0"):
        d = d[1:]
    m = re.match(r"^(\d{2,4})15(\d{6,8})$", d)   # saca el "15" de móviles nacionales
    if m:
        d = m.group(1) + m.group(2)
    return "549" + d


def _fmt_money(v) -> str:
    if v is None:
        return ""
    try:
        return "$ " + f"{int(round(float(v))):,}".replace(",", ".")
    except Exception:
        return str(v)


def _suggested_message(q: QuoteRequest) -> str:
    nombre = (q.customer_name or "").split(" ")[0] or q.customer_name or "Hola"
    return WA_TEMPLATE.format(
        cliente=nombre,
        descripcion=(q.description or q.materials or ""),
        total=_fmt_money(q.quoted_amount),
        plazo=(q.estimated_lead_time or "a confirmar"),
    )


def _log(db, q, actor, action):
    db.add(QuoteHistory(quote_id=q.id, actor=actor or "", action=action))


def _serialize(q: QuoteRequest, full: bool = False) -> dict:
    atts = sorted(q.attachments, key=lambda a: a.id)
    base = {
        "id": q.id,
        "quote_number": q.quote_number,
        "customer_name": q.customer_name or "",
        "phone": q.phone or "",
        "phone_normalized": q.phone_normalized or "",
        "request_date": q.request_date.isoformat() if q.request_date else None,
        "vendedor": q.vendedor or "",
        "materials": q.materials or "",
        "description": q.description or "",
        "status": q.status,
        "status_label": STATUS_LABELS.get(q.status, q.status),
        "quoted_amount": float(q.quoted_amount) if q.quoted_amount is not None else None,
        "estimated_lead_time": q.estimated_lead_time or "",
        "validity": q.validity or "",
        "created_by": q.created_by or "",
        "assigned_to": q.assigned_to or "",
        "sent_at": q.sent_at.isoformat() if q.sent_at else None,
        "sent_by": q.sent_by or "",
        "close_reason": q.close_reason or "",
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
        "photo_count": len(atts),
        "thumb": atts[0].data if atts else None,
    }
    if full:
        base.update({
            "orig_materials": q.orig_materials or "",
            "orig_description": q.orig_description or "",
            "internal_notes": q.internal_notes or "",
            "whatsapp_message": q.whatsapp_message or "",
            "suggested_message": _suggested_message(q),
            "attachments": [{"id": a.id, "data": a.data} for a in atts],
            "history": [{
                "id": h.id, "actor": h.actor, "action": h.action,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            } for h in sorted(q.history, key=lambda x: x.id)],
        })
    return base


# ── Meta ──────────────────────────────────────────────────────────
@router.get("/meta")
def meta(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lvl = effective_permissions(user, db).get("presupuestos", "none")
    return {
        "vendedores": VENDEDORES,
        "statuses": [{"key": s, "label": STATUS_LABELS[s]} for s in STATUSES],
        "close_reasons": CLOSE_REASONS,
        "can_manage": LEVEL_RANK.get(lvl, 0) >= LEVEL_RANK["edit"],
    }


# ── Crear (view = Cargar) ─────────────────────────────────────────
@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_quote(data: QuoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not data.customer_name.strip():
        raise HTTPException(400, "El nombre del cliente es obligatorio.")
    if not (data.phone or "").strip():
        raise HTTPException(400, "El teléfono es obligatorio.")
    norm = (data.phone_normalized or "").strip() or normalize_ar_phone(data.phone)

    q = QuoteRequest(
        customer_name=data.customer_name.strip(),
        phone=data.phone.strip(),
        phone_normalized=norm,
        request_date=data.request_date or DateType.today(),
        vendedor=(data.vendedor or "").strip(),
        materials=data.materials or "",
        description=data.description or "",
        orig_materials=data.materials or "",
        orig_description=data.description or "",
        status="pendiente",
        created_by=user.username,
    )
    db.add(q)
    db.flush()
    q.quote_number = f"P-{q.id:05d}"
    for img in (data.images or [])[:3]:
        if img:
            db.add(QuoteAttachment(quote_id=q.id, data=img))
    _log(db, q, (q.vendedor or user.username), f"cargó la solicitud")
    db.commit()
    db.refresh(q)
    return _serialize(q, full=True)


# ── Listado / pendientes / detalle (edit = Gestionar) ─────────────
@router.get("")
@router.get("/")
def list_quotes(
    status: Optional[str] = None,
    vendedor: Optional[str] = None,
    date_from: Optional[DateType] = None,
    date_to: Optional[DateType] = None,
    search: Optional[str] = None,
    user: User = Depends(require_manage),
    db: Session = Depends(get_db),
):
    qry = db.query(QuoteRequest)
    if status:    qry = qry.filter(QuoteRequest.status == status)
    if vendedor:  qry = qry.filter(QuoteRequest.vendedor == vendedor)
    if date_from: qry = qry.filter(QuoteRequest.request_date >= date_from)
    if date_to:   qry = qry.filter(QuoteRequest.request_date <= date_to)
    if search:
        like = f"%{search.strip()}%"
        qry = qry.filter(
            (QuoteRequest.customer_name.ilike(like)) |
            (QuoteRequest.phone.ilike(like)) |
            (QuoteRequest.quote_number.ilike(like))
        )
    rows = qry.order_by(QuoteRequest.created_at.desc(), QuoteRequest.id.desc()).all()
    return [_serialize(q) for q in rows]


@router.get("/pendientes")
def list_pendientes(user: User = Depends(require_manage), db: Session = Depends(get_db)):
    # Pendientes de trabajar: todo lo que no esté cerrado ni enviado
    rows = db.query(QuoteRequest).filter(
        QuoteRequest.status.in_(["pendiente", "en_preparacion", "listo"])
    ).order_by(QuoteRequest.created_at.asc(), QuoteRequest.id.asc()).all()   # más antiguo primero
    return [_serialize(q) for q in rows]


@router.get("/{quote_id}")
def get_quote(quote_id: int, user: User = Depends(require_manage), db: Session = Depends(get_db)):
    q = db.query(QuoteRequest).filter(QuoteRequest.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Presupuesto no encontrado")
    return _serialize(q, full=True)


# ── Guardar presupuesto / avances ─────────────────────────────────
@router.put("/{quote_id}")
def update_quote(quote_id: int, data: QuoteUpdate, user: User = Depends(require_manage), db: Session = Depends(get_db)):
    q = db.query(QuoteRequest).filter(QuoteRequest.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Presupuesto no encontrado")
    if not q.assigned_to:
        q.assigned_to = user.username

    # Primera vez que se trabaja → En preparación
    if q.status == "pendiente":
        q.status = "en_preparacion"
        _log(db, q, user.username, "comenzó a prepararla")

    for k in ("materials", "description", "estimated_lead_time", "validity", "internal_notes", "whatsapp_message"):
        v = getattr(data, k)
        if v is not None:
            setattr(q, k, v)

    if data.quoted_amount is not None:
        q.quoted_amount = Decimal(str(data.quoted_amount))
        _log(db, q, user.username, f"cargó presupuesto {_fmt_money(data.quoted_amount)}")
        if q.status in ("pendiente", "en_preparacion"):
            q.status = "listo"

    db.commit()
    db.refresh(q)
    return _serialize(q, full=True)


# ── Cambio de estado ──────────────────────────────────────────────
@router.post("/{quote_id}/status")
def change_status(quote_id: int, data: StatusChange, user: User = Depends(require_manage), db: Session = Depends(get_db)):
    q = db.query(QuoteRequest).filter(QuoteRequest.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Presupuesto no encontrado")
    if data.status not in STATUSES:
        raise HTTPException(400, "Estado inválido")

    q.status = data.status
    if data.status == "enviado":
        q.sent_at = datetime.utcnow()
        q.sent_by = user.username
        _log(db, q, user.username, "marcó el presupuesto como enviado")
    elif data.status == "aceptado":
        _log(db, q, user.username, "marcó el presupuesto como aceptado")
    elif data.status == "no_concretado":
        q.close_reason = data.close_reason or ""
        motivo = f" ({data.close_reason})" if data.close_reason else ""
        _log(db, q, user.username, f"marcó como no concretado{motivo}")
    else:
        _log(db, q, user.username, f"cambió el estado a {STATUS_LABELS.get(data.status, data.status)}")

    db.commit()
    db.refresh(q)
    return _serialize(q, full=True)


# ── Eliminar (admin) ──────────────────────────────────────────────
@router.delete("/{quote_id}", status_code=204)
def delete_quote(quote_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if effective_permissions(user, db).get("presupuestos", "none") != "admin":
        raise HTTPException(403, "Solo un administrador de presupuestos puede eliminar.")
    q = db.query(QuoteRequest).filter(QuoteRequest.id == quote_id).first()
    if not q:
        raise HTTPException(404, "Presupuesto no encontrado")
    db.delete(q)
    db.commit()
