from sqlalchemy import Column, Integer, String, Numeric, UniqueConstraint
from app.database import Base


class CashFlowEntry(Base):
    """
    Almacena cada celda editable del flujo de caja.
    row_key: identificador de la fila (ej: 'ventas_efectivo')
    month:   nombre del mes en mayúsculas (ej: 'ENERO')
    year:    año fiscal
    amount:  valor numérico de la celda
    """
    __tablename__ = "cash_flow_entries"
    __table_args__ = (UniqueConstraint("year", "row_key", "month", name="uq_cashflow"),)

    id      = Column(Integer, primary_key=True)
    year    = Column(Integer,     nullable=False)
    row_key = Column(String(60),  nullable=False)
    month   = Column(String(20),  nullable=False)
    amount  = Column(Numeric(15, 2), default=0)
