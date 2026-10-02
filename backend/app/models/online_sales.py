"""Venta Online — registro comercial y control de cobranzas (Sur Maderas).

NO duplica Caja Diaria: es un registro comercial independiente. Las transferencias
se registran para control/conciliación posterior, pero NO generan ingresos
automáticos en Caja Diaria en esta etapa.
"""
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class OnlineSaleCategory(Base):
    __tablename__ = "online_sale_categories"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OnlineCustomer(Base):
    __tablename__ = "online_customers"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(160), nullable=False)
    phone      = Column(String(60), default="")
    notes      = Column(Text, default="")
    active     = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OnlineSale(Base):
    __tablename__ = "online_sales"

    id              = Column(Integer, primary_key=True, index=True)
    sale_number     = Column(String(20), unique=True, index=True)   # VO-000001
    date            = Column(Date, nullable=False)
    customer_id     = Column(Integer, ForeignKey("online_customers.id"), nullable=True)
    customer_name   = Column(String(160), default="")   # snapshot / cliente libre
    contact         = Column(String(80), default="")
    category_id     = Column(Integer, ForeignKey("online_sale_categories.id"), nullable=True)
    description     = Column(Text, default="")
    total           = Column(Numeric(15, 2), nullable=False, default=0)

    payment_status  = Column(String(15), default="pendiente")   # pendiente | senado | pagado
    amount_paid     = Column(Numeric(15, 2), default=0)
    amount_pending  = Column(Numeric(15, 2), default=0)

    payment_method  = Column(String(15), default="")   # efectivo | transferencia | mixto (solo pagado)
    cash_amount     = Column(Numeric(15, 2), default=0)
    transfer_amount = Column(Numeric(15, 2), default=0)   # total recibido por transferencia (histórico)
    sena_amount     = Column(Numeric(15, 2), default=0)
    sena_method     = Column(String(15), default="")   # transferencia | efectivo (solo señado)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(120), default="")
    updated_by = Column(String(120), default="")

    customer = relationship("OnlineCustomer")
    category = relationship("OnlineSaleCategory")
    transfers = relationship("OnlineTransfer", back_populates="sale", cascade="all, delete-orphan")


class OnlineTransfer(Base):
    __tablename__ = "online_transfers"

    id                   = Column(Integer, primary_key=True, index=True)
    sale_id              = Column(Integer, ForeignKey("online_sales.id", ondelete="CASCADE"), nullable=False)
    date                 = Column(Date)
    amount               = Column(Numeric(15, 2), default=0)
    type                 = Column(String(10), default="pago")   # pago | sena
    reconciliation_status = Column(String(20), default="pendiente")  # pendiente | controlada
    reconciled_at        = Column(DateTime(timezone=True), nullable=True)
    reconciled_by        = Column(String(120), default="")
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    sale = relationship("OnlineSale", back_populates="transfers")
