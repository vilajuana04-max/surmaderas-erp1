from sqlalchemy import (
    Column, Integer, String, Boolean, Date, DateTime, Numeric,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id               = Column(Integer, primary_key=True, index=True)
    # Número de cliente = código del cupón de registro (puede repetirse vacío)
    numero_cliente   = Column(String(60), index=True)
    nombre           = Column(String(150), nullable=False)
    telefono         = Column(String(60),  default="")
    email            = Column(String(150), default="")
    fecha_nacimiento = Column(Date, nullable=True)
    sucursal         = Column(String(50), default="")
    notas            = Column(String(500), default="")

    # Cupón de registro (15% OFF de bienvenida)
    cupon_registro_usado = Column(Boolean, default=False)
    cupon_registro_fecha = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compras = relationship(
        "ClienteCompra", back_populates="cliente",
        cascade="all, delete-orphan", order_by="ClienteCompra.fecha.desc()",
    )
    feliz15 = relationship(
        "ClienteFeliz15", back_populates="cliente",
        cascade="all, delete-orphan", order_by="ClienteFeliz15.anio.desc()",
    )


class ClienteCompra(Base):
    """Cada registro = una compra del cliente (para medir frecuencia)."""
    __tablename__ = "cliente_compras"

    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    fecha      = Column(Date, nullable=False)
    monto      = Column(Numeric(15, 2), nullable=True)
    nota       = Column(String(200), default="")

    cliente = relationship("Cliente", back_populates="compras")


class ClienteFeliz15(Base):
    """Baja del cupón de cumpleaños FELIZ15 — una sola vez por año."""
    __tablename__ = "cliente_feliz15"
    __table_args__ = (UniqueConstraint("cliente_id", "anio", name="uq_feliz15_cliente_anio"),)

    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    anio       = Column(Integer, nullable=False)
    fecha      = Column(Date, nullable=False)

    cliente = relationship("Cliente", back_populates="feliz15")
