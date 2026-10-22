"""Configuración editable de precios de los cotizadores (armado de marcos, etc.)."""
from sqlalchemy import Column, Integer, Text
from app.database import Base


class CotizadorConfig(Base):
    __tablename__ = "cotizador_config"

    id   = Column(Integer, primary_key=True, index=True)   # singleton id=1
    data = Column(Text, default="{}")                      # JSON con los precios editables
