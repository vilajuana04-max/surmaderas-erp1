"""Campañas de cupones — endpoints públicos (formulario QR) y de administración."""
import json
import re
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.users import User
from app.models.campaigns import CouponCampaign, CampaignResponse
from app.permissions import effective_permissions, LEVEL_RANK

router = APIRouter(prefix="/campaigns", tags=["campanias"])


# ── Schemas ───────────────────────────────────────────────────────
class CampaignIn(BaseModel):
    name: str
    slug: Optional[str] = None
    coupon_prefix: str = "SUR"
    next_number: int = 1
    discount_pct: float = 0
    scope_text: Optional[str] = ""
    intro_text: Optional[str] = ""
    questions: Optional[List[Dict[str, Any]]] = None
    public_url: Optional[str] = ""
    active: Optional[bool] = True


class SubmitIn(BaseModel):
    customer_name: str
    phone: str
    email: Optional[str] = ""
    answers: Optional[Dict[str, Any]] = None


class ValidateIn(BaseModel):
    code: str


# ── Helpers ───────────────────────────────────────────────────────
def _admin(user: User, db: Session) -> User:
    if user.is_primary_admin:
        return user
    perms = effective_permissions(user, db)
    if LEVEL_RANK.get(perms.get("clientes", "none"), 0) >= LEVEL_RANK["edit"]:
        return user
    raise HTTPException(403, "Necesitás permiso de gestión de Clientes/Cupones.")


def _slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = s.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "campania"


def _unique_slug(base: str, db: Session, exclude_id: int = None) -> str:
    slug = base
    i = 1
    while True:
        q = db.query(CouponCampaign).filter(CouponCampaign.slug == slug)
        if exclude_id:
            q = q.filter(CouponCampaign.id != exclude_id)
        if not q.first():
            return slug
        i += 1
        slug = f"{base}-{i}"


def _questions(c: CouponCampaign) -> list:
    try:
        return json.loads(c.questions or "[]")
    except Exception:
        return []


def _pub(c: CouponCampaign) -> dict:
    """Vista pública del formulario (sin datos sensibles)."""
    return {
        "slug": c.slug, "name": c.name, "discount_pct": float(c.discount_pct or 0),
        "scope_text": c.scope_text or "", "intro_text": c.intro_text or "",
        "questions": _questions(c), "active": bool(c.active),
    }


def _admin_campaign(c: CouponCampaign, db: Session) -> dict:
    total = db.query(CampaignResponse).filter(CampaignResponse.campaign_id == c.id).count()
    usados = db.query(CampaignResponse).filter(CampaignResponse.campaign_id == c.id, CampaignResponse.used == True).count()
    return {
        "id": c.id, "slug": c.slug, "name": c.name, "coupon_prefix": c.coupon_prefix,
        "next_number": c.next_number, "discount_pct": float(c.discount_pct or 0),
        "scope_text": c.scope_text or "", "intro_text": c.intro_text or "",
        "questions": _questions(c), "public_url": c.public_url or "", "active": bool(c.active),
        "created_by": c.created_by or "", "created_at": c.created_at.isoformat() if c.created_at else None,
        "respuestas": total, "canjeados": usados,
    }


def _resp(r: CampaignResponse) -> dict:
    try:
        ans = json.loads(r.answers or "{}")
    except Exception:
        ans = {}
    return {
        "id": r.id, "campaign_id": r.campaign_id, "coupon_code": r.coupon_code,
        "customer_name": r.customer_name or "", "phone": r.phone or "", "email": r.email or "",
        "answers": ans, "used": bool(r.used), "used_at": r.used_at.isoformat() if r.used_at else None,
        "active": bool(r.active), "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── PÚBLICO (sin login — formulario del QR) ───────────────────────
@router.get("/public/{slug}")
def public_campaign(slug: str, db: Session = Depends(get_db)):
    c = db.query(CouponCampaign).filter(CouponCampaign.slug == slug).first()
    if not c or not c.active:
        raise HTTPException(404, "Campaña no disponible")
    return _pub(c)


@router.post("/public/{slug}/submit", status_code=201)
def public_submit(slug: str, body: SubmitIn, db: Session = Depends(get_db)):
    c = db.query(CouponCampaign).filter(CouponCampaign.slug == slug).first()
    if not c or not c.active:
        raise HTTPException(404, "Campaña no disponible")
    if not (body.customer_name or "").strip():
        raise HTTPException(400, "El nombre es obligatorio.")
    if not (body.phone or "").strip():
        raise HTTPException(400, "El teléfono es obligatorio.")

    # Genera cupón único: prefijo + número correlativo
    number = int(c.next_number or 1)
    code = f"{c.coupon_prefix}{number}"
    while db.query(CampaignResponse).filter(CampaignResponse.coupon_code == code).first():
        number += 1
        code = f"{c.coupon_prefix}{number}"
    c.next_number = number + 1

    r = CampaignResponse(
        campaign_id=c.id, coupon_code=code,
        customer_name=body.customer_name.strip(), phone=body.phone.strip(), email=(body.email or "").strip(),
        answers=json.dumps(body.answers or {}), used=False, active=True,
    )
    db.add(r)
    db.commit()
    return {
        "coupon_code": code,
        "discount_pct": float(c.discount_pct or 0),
        "scope_text": c.scope_text or "",
        "name": c.name,
    }


# ── ADMIN ─────────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_campaigns(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    rows = db.query(CouponCampaign).order_by(CouponCampaign.id.desc()).all()
    return [_admin_campaign(c, db) for c in rows]


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_campaign(data: CampaignIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    slug = _unique_slug(_slugify(data.slug or data.name), db)
    c = CouponCampaign(
        slug=slug, name=data.name.strip(),
        coupon_prefix=(data.coupon_prefix or "SUR").strip().upper().replace(" ", ""),
        next_number=max(1, int(data.next_number or 1)),
        discount_pct=Decimal(str(data.discount_pct or 0)),
        scope_text=data.scope_text or "", intro_text=data.intro_text or "",
        questions=json.dumps(data.questions or []), public_url=(data.public_url or ""),
        active=bool(data.active), created_by=user.username,
    )
    db.add(c); db.commit(); db.refresh(c)
    return _admin_campaign(c, db)


@router.put("/{cid}")
def update_campaign(cid: int, data: CampaignIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    c = db.query(CouponCampaign).filter(CouponCampaign.id == cid).first()
    if not c:
        raise HTTPException(404, "Campaña no encontrada")
    c.name = data.name.strip()
    if data.slug:
        c.slug = _unique_slug(_slugify(data.slug), db, exclude_id=c.id)
    c.coupon_prefix = (data.coupon_prefix or "SUR").strip().upper().replace(" ", "")
    c.next_number = max(1, int(data.next_number or 1))
    c.discount_pct = Decimal(str(data.discount_pct or 0))
    c.scope_text = data.scope_text or ""
    c.intro_text = data.intro_text or ""
    if data.public_url is not None:
        c.public_url = data.public_url or ""
    if data.questions is not None:
        c.questions = json.dumps(data.questions)
    if data.active is not None:
        c.active = bool(data.active)
    db.commit(); db.refresh(c)
    return _admin_campaign(c, db)


@router.delete("/{cid}", status_code=204)
def delete_campaign(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    c = db.query(CouponCampaign).filter(CouponCampaign.id == cid).first()
    if not c:
        raise HTTPException(404, "Campaña no encontrada")
    if db.query(CampaignResponse).filter(CampaignResponse.campaign_id == c.id).first():
        raise HTTPException(409, "La campaña tiene respuestas. Desactivala en lugar de eliminarla.")
    db.delete(c); db.commit()


@router.get("/{cid}/responses")
def list_responses(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    rows = db.query(CampaignResponse).filter(CampaignResponse.campaign_id == cid).order_by(CampaignResponse.id.desc()).all()
    return [_resp(r) for r in rows]


@router.post("/responses/{rid}/toggle-active")
def toggle_active(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    r = db.query(CampaignResponse).filter(CampaignResponse.id == rid).first()
    if not r:
        raise HTTPException(404, "Respuesta no encontrada")
    r.active = not r.active
    db.commit(); db.refresh(r)
    return _resp(r)


@router.post("/responses/{rid}/toggle-used")
def toggle_used(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    r = db.query(CampaignResponse).filter(CampaignResponse.id == rid).first()
    if not r:
        raise HTTPException(404, "Respuesta no encontrada")
    r.used = not r.used
    r.used_at = datetime.utcnow() if r.used else None
    db.commit(); db.refresh(r)
    return _resp(r)


# ── Búsqueda de cupones por código o nombre (mostrador) ───────────
@router.get("/search")
def search_responses(q: str = "", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Busca respuestas/cupones por código, nombre del cliente o teléfono,
    en todas las campañas. Para el validador del mostrador."""
    _admin(user, db)
    term = (q or "").strip()
    if not term:
        return []
    like = f"%{term}%"
    rows = (
        db.query(CampaignResponse)
        .filter(
            CampaignResponse.coupon_code.ilike(like)
            | CampaignResponse.customer_name.ilike(like)
            | CampaignResponse.phone.ilike(like)
        )
        .order_by(CampaignResponse.id.desc())
        .limit(50)
        .all()
    )
    out = []
    for r in rows:
        c = r.campaign
        d = _resp(r)
        d["campaign"] = c.name if c else ""
        d["discount_pct"] = float(c.discount_pct or 0) if c else 0
        d["scope_text"] = (c.scope_text or "") if c else ""
        out.append(d)
    return out


# ── Validación de cupón (para el mostrador) ───────────────────────
@router.post("/validate")
def validate(body: ValidateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    code = (body.code or "").strip().upper()
    r = db.query(CampaignResponse).filter(CampaignResponse.coupon_code == code).first()
    if not r:
        return {"ok": False, "status": "not_found", "message": "Cupón no encontrado."}
    c = r.campaign
    if not r.active:
        return {"ok": False, "status": "baja", "message": "Cupón dado de baja.", "response": _resp(r)}
    if r.used:
        return {"ok": False, "status": "used", "message": "Cupón ya canjeado.", "response": _resp(r)}
    return {
        "ok": True, "status": "valid",
        "message": f"Válido · {float(c.discount_pct or 0):g}% OFF · {c.scope_text or ''}",
        "discount_pct": float(c.discount_pct or 0), "scope_text": c.scope_text or "",
        "campaign": c.name, "response": _resp(r),
    }
