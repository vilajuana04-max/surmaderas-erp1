"""
Calendario de Contenido y Marketing — Sur Maderas.
CRUD de eventos/campañas + seed de fechas especiales y automatizaciones.
"""
import calendar
import json
from datetime import date
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.marketing import MarketingEvent

router = APIRouter(prefix="/marketing", tags=["marketing"])


# ── Helpers de fechas ─────────────────────────────────────────────
def nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """n-ésimo weekday (0=lunes … 6=domingo) del mes."""
    count = 0
    for day in range(1, calendar.monthrange(year, month)[1] + 1):
        d = date(year, month, day)
        if d.weekday() == weekday:
            count += 1
            if count == n:
                return d
    return date(year, month, 1)


def last_weekday(year: int, month: int, weekday: int) -> date:
    last = calendar.monthrange(year, month)[1]
    for day in range(last, 0, -1):
        d = date(year, month, day)
        if d.weekday() == weekday:
            return d
    return date(year, month, last)


# ── Schemas ───────────────────────────────────────────────────────
class EventIn(BaseModel):
    titulo:           str
    fecha_inicio:     Optional[date] = None
    fecha_fin:        Optional[date] = None
    tipo:             str = "campaña_manual"
    estado:           str = "idea"
    descripcion:      Optional[str] = ""
    segmento:         str = "todos"
    descuento:        Optional[str] = ""
    canal:            str = "email"
    asunto_email:     Optional[str] = ""
    link_doppler:     Optional[str] = ""
    es_permanente:    bool = False
    tareas:           list[Any] = []
    dias_preparacion: int = 0
    color:            Optional[str] = ""


class EventUpdate(BaseModel):
    titulo:           Optional[str]  = None
    fecha_inicio:     Optional[date] = None
    fecha_fin:        Optional[date] = None
    tipo:             Optional[str]  = None
    estado:           Optional[str]  = None
    descripcion:      Optional[str]  = None
    segmento:         Optional[str]  = None
    descuento:        Optional[str]  = None
    canal:            Optional[str]  = None
    asunto_email:     Optional[str]  = None
    link_doppler:     Optional[str]  = None
    es_permanente:    Optional[bool] = None
    tareas:           Optional[list[Any]] = None
    dias_preparacion: Optional[int]  = None
    color:            Optional[str]  = None


def _serialize(e: MarketingEvent) -> dict:
    try:
        tareas = json.loads(e.tareas) if e.tareas else []
    except Exception:
        tareas = []
    return {
        "id":               e.id,
        "titulo":           e.titulo,
        "fecha_inicio":     e.fecha_inicio.isoformat() if e.fecha_inicio else None,
        "fecha_fin":        e.fecha_fin.isoformat() if e.fecha_fin else None,
        "tipo":             e.tipo,
        "estado":           e.estado,
        "descripcion":      e.descripcion or "",
        "segmento":         e.segmento,
        "descuento":        e.descuento or "",
        "canal":            e.canal,
        "asunto_email":     e.asunto_email or "",
        "link_doppler":     e.link_doppler or "",
        "es_permanente":    bool(e.es_permanente),
        "tareas":           tareas,
        "dias_preparacion": e.dias_preparacion or 0,
        "color":            e.color or "",
    }


# ── Endpoints ─────────────────────────────────────────────────────
@router.get("")
@router.get("/")
def list_events(db: Session = Depends(get_db)):
    # Asegura el seed una vez (idempotente)
    _seed_if_empty(db)
    eventos = db.query(MarketingEvent).order_by(
        MarketingEvent.es_permanente.desc(),
        MarketingEvent.fecha_inicio,
    ).all()
    return [_serialize(e) for e in eventos]


def _sync_doppler_task(e: MarketingEvent, db: Session):
    """Si la campaña es un email automático con fecha, crea/actualiza una tarea
    en el planificador de contenido: 'Programar en Doppler'."""
    if e.tipo != "email_automatico" or not e.fecha_inicio:
        return
    from datetime import datetime, time
    from app.models.contenido import ContentEvent
    existente = db.query(ContentEvent).filter(ContentEvent.campana_id == e.id).first()
    fecha = datetime.combine(e.fecha_inicio, time(9, 0))
    titulo = f"Programar en Doppler: {e.titulo}"
    if existente:
        existente.titulo = titulo
        existente.fecha_publicacion = fecha
        existente.copy_text = e.descripcion or e.asunto_email or ""
    else:
        db.add(ContentEvent(
            titulo=titulo, redes=json.dumps(["email_doppler"]), tipo="post_estatico",
            fecha_publicacion=fecha, copy_text=e.descripcion or e.asunto_email or "",
            estado="borrador", campana_id=e.id, archivos="[]",
        ))
    db.commit()


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_event(data: EventIn, db: Session = Depends(get_db)):
    payload = data.model_dump()
    payload["tareas"] = json.dumps(payload.get("tareas") or [])
    e = MarketingEvent(**payload)
    db.add(e)
    db.commit()
    db.refresh(e)
    _sync_doppler_task(e, db)
    return _serialize(e)


@router.put("/{event_id}")
def update_event(event_id: int, data: EventUpdate, db: Session = Depends(get_db)):
    e = db.query(MarketingEvent).filter(MarketingEvent.id == event_id).first()
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "tareas":
            v = json.dumps(v or [])
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    _sync_doppler_task(e, db)
    return _serialize(e)


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(MarketingEvent).filter(MarketingEvent.id == event_id).first()
    if not e:
        raise HTTPException(404, "Evento no encontrado")
    db.delete(e)
    db.commit()


@router.post("/{event_id}/duplicar")
def duplicar_evento(event_id: int, anio_siguiente: bool = Query(False), db: Session = Depends(get_db)):
    e = db.query(MarketingEvent).filter(MarketingEvent.id == event_id).first()
    if not e:
        raise HTTPException(404, "Evento no encontrado")

    def shift(d: Optional[date]):
        if not d:
            return None
        try:
            return d.replace(year=d.year + 1)
        except ValueError:  # 29/02
            return d.replace(year=d.year + 1, day=28)

    nuevo = MarketingEvent(
        titulo        = e.titulo,
        fecha_inicio  = shift(e.fecha_inicio) if anio_siguiente else e.fecha_inicio,
        fecha_fin     = shift(e.fecha_fin) if anio_siguiente else e.fecha_fin,
        tipo          = e.tipo,
        estado        = "idea",
        descripcion   = e.descripcion,
        segmento      = e.segmento,
        descuento     = e.descuento,
        canal         = e.canal,
        asunto_email  = e.asunto_email,
        link_doppler  = "",
        es_permanente = e.es_permanente,
        tareas        = e.tareas,
        dias_preparacion = e.dias_preparacion,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return _serialize(nuevo)


# ── Seed de fechas especiales + automatizaciones ──────────────────
def _seed_if_empty(db: Session):
    if db.query(MarketingEvent).first():
        return  # ya hay datos, no re-seedear

    y = date.today().year

    especiales = [
        ("San Valentin",        date(y, 2, 14), "fecha_especial", "B2C"),
        ("Dia del Artesano",    date(y, 3, 18), "fecha_especial", "B2B"),
        ("Dia de la Madre",     nth_weekday(y, 5, 6, 2), "fecha_especial", "B2C"),   # 2do domingo de mayo
        ("Dia del Padre",       nth_weekday(y, 6, 6, 3), "fecha_especial", "B2C"),   # 3er domingo de junio
        ("Hot Sale",            last_weekday(y, 5, 5),   "promo", "todos"),          # ultimo sabado de mayo
        ("Dia del Emprendedor", date(y, 9, 1),  "fecha_especial", "B2B"),
        ("Dia del Comercio",    nth_weekday(y, 10, 0, 1), "fecha_especial", "B2B"),  # 1er lunes de octubre
        ("Dia del Jefe",        date(y, 10, 16), "fecha_especial", "B2B"),
        ("CyberMonday",         nth_weekday(y, 11, 0, 2), "promo", "todos"),         # 2da semana noviembre (lunes)
        ("11.11 Singles Day",   date(y, 11, 11), "promo", "todos"),
        ("Campana fin de ano",  nth_weekday(y, 12, 0, 2), "campaña_manual", "todos"),# diciembre semana 2
    ]
    for titulo, f, tipo, seg in especiales:
        db.add(MarketingEvent(
            titulo=titulo, fecha_inicio=f, tipo=tipo, estado="idea", segmento=seg,
            canal="ambos", descripcion="",
        ))

    automatizaciones = [
        ("Bienvenida + cupon 15%",          "B2C"),
        ("Recordatorio vencimiento cupon",  "B2C"),
        ("Cumpleanos (FELIZ15)",            "B2C"),
        ("B2B Emprendedores",               "B2B"),
    ]
    for titulo, seg in automatizaciones:
        db.add(MarketingEvent(
            titulo=titulo, fecha_inicio=None, tipo="email_automatico",
            estado="enviado", segmento=seg, canal="email", es_permanente=True,
            descripcion="Automatizacion activa en Doppler",
        ))

    db.commit()
