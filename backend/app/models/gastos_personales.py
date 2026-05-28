from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.sql import func
from app.database import Base


class GastoPersonal(Base):
    """Gasto personal individual (no vinculado a la empresa)."""
    __tablename__ = "gastos_personales"

    id             = Column(Integer, primary_key=True)
    year           = Column(Integer,      nullable=False)
    month          = Column(String(20),   nullable=False)   # 'ENERO', …
    day            = Column(Integer,      nullable=False)   # 1-31
    description    = Column(String(200),  nullable=False)
    amount         = Column(Numeric(15, 2), nullable=False)
    category       = Column(String(50),   default='Otros')
    payment_method = Column(String(30),   nullable=False)   # efectivo | transferencia | tarjeta_debito | tarjeta_credito
    bank           = Column(String(60))                     # solo para transferencia
    notes          = Column(String(300))
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
