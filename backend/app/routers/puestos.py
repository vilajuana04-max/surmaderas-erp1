"""Perfiles de puesto (descripciones de cargo) de Sur Maderas."""
import json
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.puestos import Puesto

router = APIRouter(prefix="/puestos", tags=["puestos"])

INFO_EMPRESA = (
    "Sur Maderas es una maderera de Mar del Plata especializada en tableros, "
    "melaminas, cortes a medida y materiales para mueblería y construcción. "
    "Atendemos a particulares y al rubro (carpinteros, mueblerías, constructores) "
    "en nuestras sucursales de Luro e Independencia, con foco en la atención "
    "personalizada y la calidad del producto."
)


class PuestoIn(BaseModel):
    titulo:            str
    empleado:          Optional[str] = ""
    info_empresa:      Optional[str] = ""
    resumen:           Optional[str] = ""
    responsabilidades: Any = None     # {diarias:[], semanales:[], quincenales:[]}
    expectativas:      Optional[str] = ""
    requisitos:        Optional[str] = ""
    llamada_accion:    Optional[str] = ""
    contacto_nombre:   Optional[str] = ""
    contacto_email:    Optional[str] = ""
    orden:             int = 0


class PuestoUpdate(BaseModel):
    titulo:            Optional[str] = None
    empleado:          Optional[str] = None
    info_empresa:      Optional[str] = None
    resumen:           Optional[str] = None
    responsabilidades: Optional[Any] = None
    expectativas:      Optional[str] = None
    requisitos:        Optional[str] = None
    llamada_accion:    Optional[str] = None
    contacto_nombre:   Optional[str] = None
    contacto_email:    Optional[str] = None
    orden:             Optional[int] = None


def _norm_resp(raw) -> dict:
    """Normaliza a {diarias, semanales, quincenales}. Soporta el formato viejo (lista)."""
    if isinstance(raw, list):
        return {"diarias": raw, "semanales": [], "quincenales": []}
    if isinstance(raw, dict):
        return {
            "diarias":     raw.get("diarias", []) or [],
            "semanales":   raw.get("semanales", []) or [],
            "quincenales": raw.get("quincenales", []) or [],
        }
    return {"diarias": [], "semanales": [], "quincenales": []}


def _serialize(p: Puesto) -> dict:
    try:
        raw = json.loads(p.responsabilidades) if p.responsabilidades else {}
    except Exception:
        raw = {}
    resp = _norm_resp(raw)
    return {
        "id":                p.id,
        "titulo":            p.titulo,
        "empleado":          p.empleado or "",
        "info_empresa":      p.info_empresa or "",
        "resumen":           p.resumen or "",
        "responsabilidades": resp,
        "expectativas":      p.expectativas or "",
        "requisitos":        p.requisitos or "",
        "llamada_accion":    p.llamada_accion or "",
        "contacto_nombre":   p.contacto_nombre or "",
        "contacto_email":    p.contacto_email or "",
        "orden":             p.orden or 0,
    }


@router.get("")
@router.get("/")
def list_puestos(db: Session = Depends(get_db)):
    _seed_if_empty(db)
    items = db.query(Puesto).order_by(Puesto.orden, Puesto.id).all()
    return [_serialize(p) for p in items]


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_puesto(data: PuestoIn, db: Session = Depends(get_db)):
    payload = data.model_dump()
    payload["responsabilidades"] = json.dumps(_norm_resp(payload.get("responsabilidades")))
    if not payload.get("info_empresa"):
        payload["info_empresa"] = INFO_EMPRESA
    p = Puesto(**payload)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.put("/{puesto_id}")
def update_puesto(puesto_id: int, data: PuestoUpdate, db: Session = Depends(get_db)):
    p = db.query(Puesto).filter(Puesto.id == puesto_id).first()
    if not p:
        raise HTTPException(404, "Puesto no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "responsabilidades":
            v = json.dumps(_norm_resp(v))
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.delete("/{puesto_id}", status_code=204)
def delete_puesto(puesto_id: int, db: Session = Depends(get_db)):
    p = db.query(Puesto).filter(Puesto.id == puesto_id).first()
    if not p:
        raise HTTPException(404, "Puesto no encontrado")
    db.delete(p)
    db.commit()


# ── Seed de los puestos de Sur Maderas ────────────────────────────
def _seed_if_empty(db: Session):
    if db.query(Puesto).first():
        return
    base = [
        ("Vendedor 1",                    "Ariel",    "Vendedor de salón"),
        ("Vendedor 2",                    "Pato",     "Vendedor de salón"),
        ("Vendedor 3",                    "Cecilia",  "Vendedora de salón"),
        ("Vendedor 4 y Encargado",        "Martin",   "Vendedor y encargado de sucursal"),
        ("Producción 1",                  "Facundo",  "Operario de producción"),
        ("Producción 2",                  "Marcelo",  "Operario de producción"),
        ("Venta Online",                  "Matias",   "Responsable de ventas online"),
        ("Administración y Marketing",    "Juana",    "Administración y marketing"),
    ]
    for i, (titulo, empleado, resumen) in enumerate(base):
        db.add(Puesto(
            titulo=titulo, empleado=empleado, resumen=resumen,
            info_empresa=INFO_EMPRESA,
            responsabilidades=json.dumps({"diarias": [], "semanales": [], "quincenales": []}),
            contacto_nombre="", contacto_email="rrhh@surmaderas.com.ar",
            orden=i,
        ))
    db.commit()
