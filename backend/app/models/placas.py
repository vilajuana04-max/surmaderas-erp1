"""Lista de precios de placas de madera — Sur Maderas."""
from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class Placa(Base):
    __tablename__ = "placas"

    id                  = Column(Integer, primary_key=True, index=True)
    categoria           = Column(String(80),  nullable=False, default="")
    nombre              = Column(String(120), nullable=False, default="")
    medida              = Column(String(60),  default="")     # ej "1,83 x 2,75"
    espesor             = Column(String(30),  default="")     # ej "18mm"
    precio_placa_entera = Column(Numeric(15, 2), default=0, nullable=False)
    # precio_media_placa se calcula (entera * % config); no se persiste
    activo              = Column(Boolean, default=True)
    orden               = Column(Integer, default=0)
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PlacaHistorial(Base):
    __tablename__ = "placas_historial"

    id              = Column(Integer, primary_key=True, index=True)
    placa_id        = Column(Integer, ForeignKey("placas.id", ondelete="CASCADE"), nullable=False)
    precio_anterior = Column(Numeric(15, 2), default=0)
    precio_nuevo    = Column(Numeric(15, 2), default=0)
    motivo          = Column(Text, default="")
    usuario         = Column(String(120), default="")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class ClienteDescuento(Base):
    __tablename__ = "clientes_descuento"

    id                   = Column(Integer, primary_key=True, index=True)
    nombre               = Column(String(120), nullable=False, default="")
    porcentaje_descuento = Column(Numeric(6, 2), default=0)
    notas                = Column(Text, default="")
    orden                = Column(Integer, default=0)


class PlacaConfig(Base):
    __tablename__ = "placas_config"

    id                      = Column(Integer, primary_key=True, index=True)   # singleton id=1
    porcentaje_media_placa  = Column(Numeric(6, 2), default=65)
