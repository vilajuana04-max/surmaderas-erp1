from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class ContentEvent(Base):
    __tablename__ = "content_calendar"

    id                = Column(Integer, primary_key=True, index=True)
    titulo            = Column(String(200), nullable=False)
    redes             = Column(Text, default="[]")   # JSON: ["instagram_feed", ...]
    tipo              = Column(String(20), default="post_estatico")
    # post_estatico | reel | story | carrusel
    fecha_publicacion = Column(DateTime, nullable=True)
    copy_text         = Column(Text, default="")
    hashtags          = Column(Text, default="")
    archivo_url       = Column(Text, default="")     # data URL o link (principal)
    archivo_tipo      = Column(String(10), default="")   # imagen | video
    archivos          = Column(Text, default="[]")   # JSON: [{url, tipo}] (carrusel)
    estado            = Column(String(20), default="borrador")
    # borrador | en_revision | listo | publicado
    campana_id        = Column(Integer, nullable=True)   # FK lógico → marketing_calendar
    notas_internas    = Column(Text, default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
