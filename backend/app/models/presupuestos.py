"""Solicitudes y seguimiento de presupuestos — Sur Maderas."""
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class QuoteRequest(Base):
    __tablename__ = "quote_requests"

    id                  = Column(Integer, primary_key=True, index=True)
    quote_number        = Column(String(20), unique=True, index=True)   # P-00001
    customer_name       = Column(String(160), nullable=False, default="")
    phone               = Column(String(60), default="")                # como lo tipeó el vendedor
    phone_normalized    = Column(String(40), default="")                # para wa.me (54 9 …)
    request_date        = Column(Date, nullable=False)
    vendedor            = Column(String(120), default="")               # quién tomó la consulta

    materials           = Column(Text, default="")
    description         = Column(Text, default="")
    # Snapshot original (lo que cargó el vendedor) — no se modifica
    orig_materials      = Column(Text, default="")
    orig_description    = Column(Text, default="")

    status              = Column(String(30), default="pendiente")
    quoted_amount       = Column(Numeric(15, 2), nullable=True)
    estimated_lead_time = Column(String(120), default="")
    validity            = Column(String(120), default="")
    internal_notes      = Column(Text, default="")
    whatsapp_message    = Column(Text, default="")
    close_reason        = Column(String(120), default="")

    created_by          = Column(String(120), default="")
    assigned_to         = Column(String(120), default="")
    sent_at             = Column(DateTime(timezone=True), nullable=True)
    sent_by             = Column(String(120), default="")

    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    attachments = relationship("QuoteAttachment", back_populates="quote", cascade="all, delete-orphan")
    history     = relationship("QuoteHistory", back_populates="quote", cascade="all, delete-orphan")


class QuoteAttachment(Base):
    __tablename__ = "quote_attachments"

    id         = Column(Integer, primary_key=True, index=True)
    quote_id   = Column(Integer, ForeignKey("quote_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    data       = Column(Text, default="")   # data URL base64 (imagen comprimida en el cliente)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quote = relationship("QuoteRequest", back_populates="attachments")


class QuoteHistory(Base):
    __tablename__ = "quote_history"

    id         = Column(Integer, primary_key=True, index=True)
    quote_id   = Column(Integer, ForeignKey("quote_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    actor      = Column(String(120), default="")
    action     = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quote = relationship("QuoteRequest", back_populates="history")
