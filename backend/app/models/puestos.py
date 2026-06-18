from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Puesto(Base):
    __tablename__ = "puestos"

    id              = Column(Integer, primary_key=True, index=True)
    titulo          = Column(String(150), nullable=False)
    empleado        = Column(String(150), default="")   # persona que ocupa el puesto
    info_empresa    = Column(Text, default="")
    resumen         = Column(Text, default="")
    responsabilidades = Column(Text, default="[]")       # JSON: lista de strings
    expectativas    = Column(Text, default="")
    requisitos      = Column(Text, default="")
    llamada_accion  = Column(Text, default="")
    contacto_nombre = Column(String(150), default="")
    contacto_email  = Column(String(150), default="")
    orden           = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
