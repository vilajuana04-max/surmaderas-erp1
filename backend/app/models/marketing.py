from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class MarketingEvent(Base):
    __tablename__ = "marketing_calendar"

    id            = Column(Integer, primary_key=True, index=True)
    titulo        = Column(String(200), nullable=False)
    fecha_inicio  = Column(Date, nullable=True)   # null = permanente (automatización)
    fecha_fin     = Column(Date, nullable=True)
    tipo          = Column(String(30), default="campaña_manual")
    # email_automatico | campaña_manual | promo | fecha_especial | recordatorio
    estado        = Column(String(20), default="idea")
    # idea | en_progreso | listo | enviado
    descripcion   = Column(Text, default="")
    segmento      = Column(String(10), default="todos")   # B2B | B2C | todos
    descuento     = Column(String(20), default="")
    canal         = Column(String(15), default="email")   # email | whatsapp | ambos
    asunto_email  = Column(String(200), default="")
    link_doppler  = Column(String(400), default="")
    es_permanente = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
