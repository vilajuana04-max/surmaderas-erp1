from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    DateTime, ForeignKey, UniqueConstraint,
)
from sqlalchemy.sql import func
from app.database import Base


class Vencimiento(Base):
    """Definición recurrente de un vencimiento (template mensual)."""
    __tablename__ = "vencimientos"

    id           = Column(Integer, primary_key=True)
    name         = Column(String(100), nullable=False)
    amount       = Column(Numeric(15, 2), default=0)
    day_of_month = Column(Integer, nullable=False)        # 1-31
    category     = Column(String(50), default='Servicios')
    color        = Column(String(20), default='#3b82f6')
    active       = Column(Boolean, default=True)
    notes        = Column(String(300))
    sort_order   = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())


class VencimientoEstado(Base):
    """Estado mensual de un vencimiento: override de día/monto + status de pago."""
    __tablename__ = "vencimiento_estados"
    __table_args__ = (
        UniqueConstraint("vencimiento_id", "year", "month", name="uq_venc_estado"),
    )

    id              = Column(Integer, primary_key=True)
    vencimiento_id  = Column(
        Integer, ForeignKey("vencimientos.id", ondelete="CASCADE"), nullable=False
    )
    year            = Column(Integer,  nullable=False)
    month           = Column(String(20), nullable=False)       # 'ENERO', 'FEBRERO', …
    day_override    = Column(Integer)                           # si es None usa day_of_month
    amount_override = Column(Numeric(15, 2))                   # si es None usa amount
    status          = Column(String(20), default='pendiente')  # pendiente|pagado|omitido
    paid_at         = Column(DateTime(timezone=True))
    notes           = Column(String(300))
