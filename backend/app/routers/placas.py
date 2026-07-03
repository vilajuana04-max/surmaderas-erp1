"""Lista de precios de placas — CRUD, actualizador masivo, historial, comparador."""
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.placas import Placa, PlacaHistorial, ClienteDescuento, PlacaConfig

router = APIRouter(prefix="/placas", tags=["placas"])


# ── Schemas ───────────────────────────────────────────────────────
class PlacaIn(BaseModel):
    categoria:           str
    nombre:              str
    medida:              Optional[str] = ""
    espesor:             Optional[str] = ""
    precio_placa_entera: float = 0
    orden:               int = 0


class PrecioUpdate(BaseModel):
    precio_nuevo: float
    motivo:       Optional[str] = ""
    usuario:      Optional[str] = ""


class PlacaMeta(BaseModel):
    categoria: Optional[str] = None
    nombre:    Optional[str] = None
    medida:    Optional[str] = None
    espesor:   Optional[str] = None
    orden:     Optional[int] = None


class AumentoIn(BaseModel):
    porcentaje: float
    categoria:  Optional[str] = None   # None = todas
    motivo:     Optional[str] = ""
    usuario:    Optional[str] = ""


class ConfigIn(BaseModel):
    porcentaje_media_placa: float


class ClienteDescIn(BaseModel):
    nombre:               str
    porcentaje_descuento: Optional[float] = 0
    notas:                Optional[str] = ""
    orden:                int = 0


# ── Helpers ───────────────────────────────────────────────────────
def _get_config(db: Session) -> PlacaConfig:
    cfg = db.query(PlacaConfig).filter(PlacaConfig.id == 1).first()
    if not cfg:
        cfg = PlacaConfig(id=1, porcentaje_media_placa=Decimal("65"))
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _pct_media(db: Session) -> Decimal:
    return Decimal(str(_get_config(db).porcentaje_media_placa or 65))


def _serialize(p: Placa, pct: Decimal) -> dict:
    entera = Decimal(str(p.precio_placa_entera or 0))
    media = (entera * pct / Decimal("100")).quantize(Decimal("0.01"))
    return {
        "id":                  p.id,
        "categoria":           p.categoria or "",
        "nombre":              p.nombre or "",
        "medida":              p.medida or "",
        "espesor":             p.espesor or "",
        "precio_placa_entera": float(entera),
        "precio_media_placa":  float(media),
        "activo":              bool(p.activo),
        "orden":               p.orden or 0,
        "updated_at":          p.updated_at.isoformat() if p.updated_at else None,
    }


def _log(db: Session, placa: Placa, anterior, nuevo, motivo, usuario):
    db.add(PlacaHistorial(
        placa_id=placa.id,
        precio_anterior=Decimal(str(anterior or 0)),
        precio_nuevo=Decimal(str(nuevo or 0)),
        motivo=motivo or "",
        usuario=usuario or "",
    ))


# ── Endpoints principales ─────────────────────────────────────────
@router.get("")
@router.get("/")
def list_placas(db: Session = Depends(get_db)):
    _seed_if_empty(db)
    pct = _pct_media(db)
    items = db.query(Placa).order_by(Placa.orden, Placa.id).all()
    return {
        "porcentaje_media_placa": float(pct),
        "placas": [_serialize(p, pct) for p in items],
    }


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_placa(data: PlacaIn, db: Session = Depends(get_db)):
    p = Placa(
        categoria=data.categoria, nombre=data.nombre, medida=data.medida or "",
        espesor=data.espesor or "", precio_placa_entera=Decimal(str(data.precio_placa_entera or 0)),
        orden=data.orden or 0, activo=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p, _pct_media(db))


# ── Config (declarado antes de /{placa_id} para no ser capturado) ─
@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    cfg = _get_config(db)
    return {"porcentaje_media_placa": float(cfg.porcentaje_media_placa or 65)}


@router.put("/config")
def set_config(data: ConfigIn, db: Session = Depends(get_db)):
    cfg = _get_config(db)
    cfg.porcentaje_media_placa = Decimal(str(data.porcentaje_media_placa))
    db.commit()
    return {"porcentaje_media_placa": float(cfg.porcentaje_media_placa)}


@router.put("/{placa_id}/precio")
def update_precio(placa_id: int, data: PrecioUpdate, db: Session = Depends(get_db)):
    p = db.query(Placa).filter(Placa.id == placa_id).first()
    if not p:
        raise HTTPException(404, "Placa no encontrada")
    anterior = Decimal(str(p.precio_placa_entera or 0))
    nuevo = Decimal(str(data.precio_nuevo or 0))
    if nuevo != anterior:
        _log(db, p, anterior, nuevo, data.motivo, data.usuario)
        p.precio_placa_entera = nuevo
        db.commit()
        db.refresh(p)
    return _serialize(p, _pct_media(db))


@router.put("/{placa_id}")
def update_placa_meta(placa_id: int, data: PlacaMeta, db: Session = Depends(get_db)):
    p = db.query(Placa).filter(Placa.id == placa_id).first()
    if not p:
        raise HTTPException(404, "Placa no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _serialize(p, _pct_media(db))


@router.delete("/{placa_id}", status_code=204)
def delete_placa(placa_id: int, db: Session = Depends(get_db)):
    p = db.query(Placa).filter(Placa.id == placa_id).first()
    if not p:
        raise HTTPException(404, "Placa no encontrada")
    db.delete(p)
    db.commit()


# ── Actualizador masivo (aumento %) ───────────────────────────────
@router.post("/aumento")
def aumento_masivo(data: AumentoIn, db: Session = Depends(get_db)):
    q = db.query(Placa)
    if data.categoria:
        q = q.filter(Placa.categoria == data.categoria)
    placas = q.all()
    factor = Decimal("1") + Decimal(str(data.porcentaje)) / Decimal("100")
    n = 0
    for p in placas:
        anterior = Decimal(str(p.precio_placa_entera or 0))
        if anterior <= 0:
            continue
        nuevo = (anterior * factor).quantize(Decimal("0.01"))
        _log(db, p, anterior, nuevo, data.motivo or f"Aumento {data.porcentaje}%", data.usuario)
        p.precio_placa_entera = nuevo
        n += 1
    db.commit()
    return {"actualizadas": n}


# ── Historial ─────────────────────────────────────────────────────
def _serialize_hist(h: PlacaHistorial, nombre="") -> dict:
    ant = float(h.precio_anterior or 0)
    nue = float(h.precio_nuevo or 0)
    diff = nue - ant
    pct = (diff / ant * 100) if ant else 0
    return {
        "id":              h.id,
        "placa_id":        h.placa_id,
        "placa_nombre":    nombre,
        "precio_anterior": ant,
        "precio_nuevo":    nue,
        "diff":            round(diff, 2),
        "diff_pct":        round(pct, 2),
        "motivo":          h.motivo or "",
        "usuario":         h.usuario or "",
        "created_at":      h.created_at.isoformat() if h.created_at else None,
    }


@router.get("/historial")
def historial_global(db: Session = Depends(get_db)):
    nombres = {p.id: f"{p.nombre} {p.espesor}".strip() for p in db.query(Placa).all()}
    rows = db.query(PlacaHistorial).order_by(PlacaHistorial.created_at.desc(), PlacaHistorial.id.desc()).limit(500).all()
    return [_serialize_hist(h, nombres.get(h.placa_id, "")) for h in rows]


@router.get("/{placa_id}/historial")
def historial_placa(placa_id: int, db: Session = Depends(get_db)):
    p = db.query(Placa).filter(Placa.id == placa_id).first()
    nombre = f"{p.nombre} {p.espesor}".strip() if p else ""
    rows = db.query(PlacaHistorial).filter(PlacaHistorial.placa_id == placa_id)\
        .order_by(PlacaHistorial.created_at.desc(), PlacaHistorial.id.desc()).all()
    return [_serialize_hist(h, nombre) for h in rows]


# ── Comparador (precio actual vs anterior inmediato) ──────────────
@router.get("/comparador")
def comparador(db: Session = Depends(get_db)):
    pct = _pct_media(db)
    placas = db.query(Placa).order_by(Placa.orden, Placa.id).all()
    out = []
    for p in placas:
        ultimo = db.query(PlacaHistorial).filter(PlacaHistorial.placa_id == p.id)\
            .order_by(PlacaHistorial.created_at.desc(), PlacaHistorial.id.desc()).first()
        actual = float(p.precio_placa_entera or 0)
        anterior = float(ultimo.precio_anterior) if ultimo else None
        diff = (actual - anterior) if anterior is not None else None
        diff_pct = (diff / anterior * 100) if (anterior not in (None, 0)) else None
        out.append({
            "id":          p.id,
            "categoria":   p.categoria or "",
            "nombre":      p.nombre or "",
            "espesor":     p.espesor or "",
            "medida":      p.medida or "",
            "actual":      actual,
            "anterior":    anterior,
            "diff":        round(diff, 2) if diff is not None else None,
            "diff_pct":    round(diff_pct, 2) if diff_pct is not None else None,
            "cambio_fecha": ultimo.created_at.isoformat() if ultimo and ultimo.created_at else None,
        })
    return out


# ── Clientes con descuento (lista de caja) ────────────────────────
def _serialize_cd(c: ClienteDescuento) -> dict:
    return {
        "id":                   c.id,
        "nombre":               c.nombre or "",
        "porcentaje_descuento": float(c.porcentaje_descuento or 0),
        "notas":                c.notas or "",
        "orden":                c.orden or 0,
    }


@router.get("/clientes-descuento")
def list_clientes_desc(db: Session = Depends(get_db)):
    _seed_clientes_if_empty(db)
    rows = db.query(ClienteDescuento).order_by(ClienteDescuento.orden, ClienteDescuento.id).all()
    return [_serialize_cd(c) for c in rows]


@router.post("/clientes-descuento", status_code=201)
def create_cliente_desc(data: ClienteDescIn, db: Session = Depends(get_db)):
    c = ClienteDescuento(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize_cd(c)


@router.put("/clientes-descuento/{cd_id}")
def update_cliente_desc(cd_id: int, data: ClienteDescIn, db: Session = Depends(get_db)):
    c = db.query(ClienteDescuento).filter(ClienteDescuento.id == cd_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _serialize_cd(c)


@router.delete("/clientes-descuento/{cd_id}", status_code=204)
def delete_cliente_desc(cd_id: int, db: Session = Depends(get_db)):
    c = db.query(ClienteDescuento).filter(ClienteDescuento.id == cd_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    db.delete(c)
    db.commit()


# ── Seed ──────────────────────────────────────────────────────────
# Datos de la lista de difusión vigente (01-jul-2026). Precio placa entera.
_SEED = [
    ("Melamina",           "MEL Blanco",             "1,83 x 2,75", "18mm",  106209.40),
    ("Melamina",           "MEL Negro",              "1,83 x 2,75", "18mm",  120077.10),
    ("MDF",                "Fibro Facil",            "1,83 x 2,60", "3mm",   26974.20),
    ("MDF",                "Fibro Facil",            "1,83 x 2,60", "5,5mm", 37485.80),
    ("MDF",                "Fibro Facil",            "1,83 x 2,75", "9mm",   51961.80),
    ("MDF",                "Fibro Facil",            "1,83 x 2,75", "12mm",  67081.30),
    ("MDF",                "Fibro Facil",            "1,83 x 2,75", "15mm",  74236.80),
    ("MDF",                "Fibro Facil",            "1,83 x 2,75", "18mm",  98959.30),
    ("Fondos",             "Plus blanco",            "1,83 x 2,60", "3mm",   44466.40),
    ("Fondos",             "Plus negros y colores",  "1,83 x 2,60", "3mm",   48920.30),
    ("Fenolicos",          "Fenolico pino C + C",    "1,2 x 2,4",   "8mm",   38164.80),
    ("Fenolicos",          "Fenolico pino C + C",    "1,2 x 2,4",   "12mm",  47722.80),
    ("Fenolicos",          "Fenolico pino C + C",    "1,2 x 2,4",   "18mm",  58513.64),
    ("OSB",                "APA (Estructural)",      "1,2 x 2,4",   "9,5mm", 34560.00),
    ("Tableros",           "Pino finger S1",         "1,2 x 3,05",  "15mm",  68631.20),
    ("Tableros",           "Pino finger S1",         "1,2 x 3,06",  "18mm",  76505.00),
    ("Tableros",           "Pino finger S1",         "1,2 x 3,05",  "20-22m",80765.30),
    ("Tableros",           "Pino finger S1",         "1,2 x 3,05",  "30mm",  122530.10),
    ("Chapadur pizarron",  "Verde/negro",            "1,22x2,75",   "3mm",   42298.76),
    ("Terciado",           "Pino",                   "1,60 x 2,10", "3mm",   27622.10),
    ("Terciado",           "Pino",                   "1,60 x 2,10", "4mm",   34606.00),
]


def _seed_if_empty(db: Session):
    if db.query(Placa).first():
        return
    for i, (cat, nombre, medida, espesor, precio) in enumerate(_SEED):
        db.add(Placa(
            categoria=cat, nombre=nombre, medida=medida, espesor=espesor,
            precio_placa_entera=Decimal(str(precio)), orden=i, activo=True,
        ))
    db.commit()


def _seed_clientes_if_empty(db: Session):
    if db.query(ClienteDescuento).first():
        return
    for i, nombre in enumerate(["Molmar", "Silvia", "Penelope"]):
        db.add(ClienteDescuento(nombre=nombre, porcentaje_descuento=Decimal("15"), notas="", orden=i))
    db.commit()
