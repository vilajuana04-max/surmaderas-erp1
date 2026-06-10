"""
Planificador de Contenido — Sur Maderas.
Planifica publicaciones para Instagram, Facebook y Estados de WhatsApp.
La publicación se ejecuta manualmente / vía Meta Business Suite.
"""
import json
from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contenido import ContentEvent

router = APIRouter(prefix="/contenido", tags=["contenido"])


# ── Schemas ───────────────────────────────────────────────────────
class ContentIn(BaseModel):
    titulo:            str
    redes:             list[str] = []
    tipo:              str = "post_estatico"
    fecha_publicacion: Optional[datetime] = None
    copy:              Optional[str] = ""
    hashtags:          Optional[str] = ""
    archivo_url:       Optional[str] = ""
    archivo_tipo:      Optional[str] = ""
    archivos:          list[Any] = []
    estado:            str = "borrador"
    campana_id:        Optional[int] = None
    notas_internas:    Optional[str] = ""


class ContentUpdate(BaseModel):
    titulo:            Optional[str]      = None
    redes:             Optional[list[str]] = None
    tipo:              Optional[str]      = None
    fecha_publicacion: Optional[datetime] = None
    copy:              Optional[str]      = None
    hashtags:          Optional[str]      = None
    archivo_url:       Optional[str]      = None
    archivo_tipo:      Optional[str]      = None
    archivos:          Optional[list[Any]] = None
    estado:            Optional[str]      = None
    campana_id:        Optional[int]      = None
    notas_internas:    Optional[str]      = None


def _serialize(e: ContentEvent) -> dict:
    def _loads(s, fb):
        try: return json.loads(s) if s else fb
        except Exception: return fb
    return {
        "id":                e.id,
        "titulo":            e.titulo,
        "redes":             _loads(e.redes, []),
        "tipo":              e.tipo,
        "fecha_publicacion": e.fecha_publicacion.isoformat() if e.fecha_publicacion else None,
        "copy":              e.copy_text or "",
        "hashtags":          e.hashtags or "",
        "archivo_url":       e.archivo_url or "",
        "archivo_tipo":      e.archivo_tipo or "",
        "archivos":          _loads(e.archivos, []),
        "estado":            e.estado,
        "campana_id":        e.campana_id,
        "notas_internas":    e.notas_internas or "",
    }


def _apply(e: ContentEvent, data: dict):
    for k, v in data.items():
        if k == "copy":
            e.copy_text = v or ""
        elif k == "redes":
            e.redes = json.dumps(v or [])
        elif k == "archivos":
            e.archivos = json.dumps(v or [])
        else:
            setattr(e, k, v)


# ── Endpoints ─────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_content(campana_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    _seed_if_empty(db)
    q = db.query(ContentEvent)
    if campana_id is not None:
        q = q.filter(ContentEvent.campana_id == campana_id)
    items = q.order_by(ContentEvent.fecha_publicacion).all()
    return [_serialize(e) for e in items]


@router.get("/counts-por-campana")
def counts_por_campana(db: Session = Depends(get_db)):
    """Cuántas publicaciones de contenido hay por campaña de marketing."""
    rows = db.query(ContentEvent.campana_id).filter(ContentEvent.campana_id.isnot(None)).all()
    counts: dict = {}
    for (cid,) in rows:
        counts[cid] = counts.get(cid, 0) + 1
    return counts


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_content(data: ContentIn, db: Session = Depends(get_db)):
    e = ContentEvent()
    _apply(e, data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return _serialize(e)


@router.put("/{cid}")
def update_content(cid: int, data: ContentUpdate, db: Session = Depends(get_db)):
    e = db.query(ContentEvent).filter(ContentEvent.id == cid).first()
    if not e:
        raise HTTPException(404, "Publicación no encontrada")
    _apply(e, data.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(e)
    return _serialize(e)


@router.delete("/{cid}", status_code=204)
def delete_content(cid: int, db: Session = Depends(get_db)):
    e = db.query(ContentEvent).filter(ContentEvent.id == cid).first()
    if not e:
        raise HTTPException(404, "Publicación no encontrada")
    db.delete(e)
    db.commit()


@router.post("/{cid}/duplicar")
def duplicar(cid: int, db: Session = Depends(get_db)):
    e = db.query(ContentEvent).filter(ContentEvent.id == cid).first()
    if not e:
        raise HTTPException(404, "Publicación no encontrada")
    nuevo = ContentEvent(
        titulo=e.titulo + " (copia)", redes=e.redes, tipo=e.tipo,
        fecha_publicacion=e.fecha_publicacion, copy_text=e.copy_text, hashtags=e.hashtags,
        archivo_url=e.archivo_url, archivo_tipo=e.archivo_tipo, archivos=e.archivos,
        estado="borrador", campana_id=e.campana_id, notas_internas=e.notas_internas,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _serialize(nuevo)


# ── Seed de ejemplos (julio 2026) ─────────────────────────────────
def _seed_if_empty(db: Session):
    if db.query(ContentEvent).first():
        return
    ejemplos = [
        dict(
            titulo="Reel — Cómo elegir el tablero ideal",
            redes=["instagram_feed", "facebook"], tipo="reel",
            fecha=datetime(2026, 7, 3, 19, 0),
            copy="¿Melamina, MDF o multilaminado? Te contamos en 30 segundos cuál conviene para tu proyecto 🪵",
            hashtags="#SurMaderas #MarDelPlata #Melamina #Maderas #Carpintería",
            estado="listo",
        ),
        dict(
            titulo="Story — Llegó stock de melamina",
            redes=["instagram_story", "whatsapp_estado"], tipo="story",
            fecha=datetime(2026, 7, 8, 12, 0),
            copy="¡Nuevo stock de melaminas en más de 20 colores! Pasá por el local 🎨",
            hashtags="",
            estado="borrador",
        ),
        dict(
            titulo="Post — Cotizador online de cortes",
            redes=["instagram_feed", "facebook"], tipo="post_estatico",
            fecha=datetime(2026, 7, 15, 13, 0),
            copy="Ahora cotizás tus cortes a medida desde casa con nuestro cotizador online. Link en bio 👆",
            hashtags="#CortesAMedida #SurMaderas #Cotizador #MarDelPlata",
            estado="en_revision",
        ),
        dict(
            titulo="Carrusel — Antes y después de clientes",
            redes=["instagram_feed"], tipo="carrusel",
            fecha=datetime(2026, 7, 22, 19, 0),
            copy="Proyectos reales hechos con nuestros materiales. Deslizá para ver las transformaciones ➡️",
            hashtags="#Inspiración #Muebles #SurMaderas #HechoEnMDP",
            estado="borrador",
        ),
    ]
    for ej in ejemplos:
        db.add(ContentEvent(
            titulo=ej["titulo"], redes=json.dumps(ej["redes"]), tipo=ej["tipo"],
            fecha_publicacion=ej["fecha"], copy_text=ej["copy"], hashtags=ej["hashtags"],
            estado=ej["estado"], archivos="[]",
        ))
    db.commit()
