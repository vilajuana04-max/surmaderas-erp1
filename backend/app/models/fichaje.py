"""Control horario (fichaje) — cada empleado marca entrada/salida.

Simple: sin login individual. El empleado elige su nombre y toca Entrar/Salir.
Las horas se suman por mes. Pensado para el mostrador de Sur Maderas.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class FichajeEmpleado(Base):
    __tablename__ = "fichaje_empleados"

    id           = Column(Integer, primary_key=True, index=True)
    nombre       = Column(String(120), unique=True, nullable=False)
    hora_entrada = Column(String(5), default="08:00")   # horario esperado (referencia)
    hora_salida  = Column(String(5), default="17:00")
    activo       = Column(Boolean, default=True)
    orden        = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    fichajes = relationship("Fichaje", back_populates="empleado", cascade="all, delete-orphan")


class Fichaje(Base):
    __tablename__ = "fichajes"

    id          = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("fichaje_empleados.id", ondelete="CASCADE"), nullable=False, index=True)
    entrada     = Column(DateTime(timezone=True), nullable=False)   # UTC aware
    salida      = Column(DateTime(timezone=True), nullable=True)    # UTC aware (null = en curso)
    nota        = Column(String(200), default="")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    empleado = relationship("FichajeEmpleado", back_populates="fichajes")
