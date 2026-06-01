from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CajaDiaria(Base):
    __tablename__ = "caja_diaria"

    id                = Column(Integer, primary_key=True, index=True)
    fecha             = Column(Date, nullable=False)
    sucursal          = Column(String(50), nullable=False)   # luro | independencia

    # Efectivo ingresado manualmente al cerrar el día
    efectivo_del_dia  = Column(Numeric(15, 2), default=0, nullable=False)

    # Tarjetas — terminales fijas
    tarjeta_provincia = Column(Numeric(15, 2), default=0, nullable=False)
    tarjeta_nave      = Column(Numeric(15, 2), default=0, nullable=False)
    tarjeta_frances   = Column(Numeric(15, 2), default=0, nullable=False)
    tarjeta_comafi    = Column(Numeric(15, 2), default=0, nullable=False)

    observaciones     = Column(String(500), default='')
    cerrada           = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    movimientos = relationship(
        "CajaMovimiento",
        back_populates="caja",
        cascade="all, delete-orphan",
        order_by="CajaMovimiento.id",
    )


class CajaMovimiento(Base):
    __tablename__ = "caja_movimientos"

    id          = Column(Integer, primary_key=True, index=True)
    caja_id     = Column(Integer, ForeignKey("caja_diaria.id", ondelete="CASCADE"), nullable=False)
    tipo        = Column(String(20), nullable=False)   # gasto | transferencia | retiro | link
    descripcion = Column(String(200), default='')
    monto       = Column(Numeric(15, 2), nullable=False, default=0)
    categoria   = Column(String(50), nullable=True)    # para tipo='gasto': Proveedores | Limpieza | Insumos | Transporte | Servicios

    caja = relationship("CajaDiaria", back_populates="movimientos")
