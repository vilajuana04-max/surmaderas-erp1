"""Campañas de cupones — formularios públicos (QR) que generan cupones.

Ej: colaboración con Batata → cupón SURBATATA### con 15% off en línea infantil.
Genérico: el admin crea cualquier campaña con sus preguntas, prefijo y descuento.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CouponCampaign(Base):
    __tablename__ = "coupon_campaigns"

    id            = Column(Integer, primary_key=True, index=True)
    slug          = Column(String(60), unique=True, index=True)   # URL pública /c/<slug>
    name          = Column(String(160), nullable=False)
    coupon_prefix = Column(String(40), default="SUR")             # ej: SURBATATA
    next_number   = Column(Integer, default=1)                    # correlativo del cupón
    discount_pct  = Column(Numeric(6, 2), default=0)              # ej: 15
    scope_text    = Column(String(300), default="")              # ej: "línea infantil, todos los medios de pago"
    intro_text    = Column(Text, default="")                     # texto de bienvenida del formulario
    questions     = Column(Text, default="[]")                   # JSON: [{id,label,type,options,required}]
    public_url    = Column(String(300), default="")             # dónde vive el form (ej: surmaderas.com.ar/Batataxsur/)
    active        = Column(Boolean, default=True)
    created_by    = Column(String(120), default="")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    responses = relationship("CampaignResponse", back_populates="campaign", cascade="all, delete-orphan")


class CampaignResponse(Base):
    __tablename__ = "campaign_responses"

    id            = Column(Integer, primary_key=True, index=True)
    campaign_id   = Column(Integer, ForeignKey("coupon_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    coupon_code   = Column(String(60), unique=True, index=True)
    customer_name = Column(String(160), default="")
    phone         = Column(String(60), default="")
    email         = Column(String(150), default="")
    answers       = Column(Text, default="{}")                   # JSON {questionId: value}
    used          = Column(Boolean, default=False)               # cupón canjeado
    used_at       = Column(DateTime(timezone=True), nullable=True)
    active        = Column(Boolean, default=True)                # dar de baja (invalida el cupón)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("CouponCampaign", back_populates="responses")
