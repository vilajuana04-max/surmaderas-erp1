"""Control horario (fichaje) — entrada/salida de empleados y resumen mensual."""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fichaje import FichajeEmpleado, Fichaje

router = APIRouter(prefix="/fichaje", tags=["fichaje"])

AR = timezone(timedelta(hours=-3))   # Argentina (UTC-3)


# ── Helpers ───────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> Optional[datetime]:
    """Garantiza datetime timezone-aware en UTC (SQLite puede devolver naive)."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _ar(dt: datetime):
    dt = _aware(dt)
    return dt.astimezone(AR) if dt else None


def _dur_min(entrada: datetime, salida: Optional[datetime]) -> int:
    ini = _aware(entrada)
    fin = _aware(salida) or _utcnow()
    return max(0, int((fin - ini).total_seconds() // 60))


def _hhmm(mins: int) -> str:
    return f"{mins // 60}:{mins % 60:02d}"


def _parse_ar(s: str) -> datetime:
    """'YYYY-MM-DDTHH:MM' (hora local AR) → datetime UTC aware."""
    s = (s or "").strip().replace(" ", "T")
    local = datetime.strptime(s[:16], "%Y-%m-%dT%H:%M").replace(tzinfo=AR)
    return local.astimezone(timezone.utc)


def _fichaje_dict(f: Fichaje) -> dict:
    ent = _ar(f.entrada)
    sal = _ar(f.salida)
    return {
        "id": f.id,
        "empleado_id": f.empleado_id,
        "fecha": ent.strftime("%Y-%m-%d") if ent else "",
        "entrada": f.entrada.astimezone(timezone.utc).isoformat() if f.entrada else None,
        "salida": f.salida.astimezone(timezone.utc).isoformat() if f.salida else None,
        "entrada_hora": ent.strftime("%H:%M") if ent else "",
        "salida_hora": sal.strftime("%H:%M") if sal else "",
        "min": _dur_min(f.entrada, f.salida),
        "abierto": f.salida is None,
        "nota": f.nota or "",
    }


# ── Empleados / estado actual (kiosco) ────────────────────────────
@router.get("/empleados")
def empleados(db: Session = Depends(get_db)):
    emps = db.query(FichajeEmpleado).filter(FichajeEmpleado.activo == True).order_by(
        FichajeEmpleado.orden, FichajeEmpleado.nombre
    ).all()
    hoy_ar = _ar(_utcnow()).strftime("%Y-%m-%d")
    out = []
    for e in emps:
        abierto = db.query(Fichaje).filter(Fichaje.empleado_id == e.id, Fichaje.salida == None).order_by(Fichaje.id.desc()).first()
        # minutos de hoy (AR)
        hoy_min = 0
        for f in db.query(Fichaje).filter(Fichaje.empleado_id == e.id).all():
            ent = _ar(f.entrada)
            if ent and ent.strftime("%Y-%m-%d") == hoy_ar:
                hoy_min += _dur_min(f.entrada, f.salida)
        out.append({
            "id": e.id, "nombre": e.nombre,
            "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida,
            "abierto": abierto is not None,
            "entrada_actual": (abierto.entrada.astimezone(timezone.utc).isoformat() if abierto else None),
            "entrada_actual_hora": (_ar(abierto.entrada).strftime("%H:%M") if abierto else ""),
            "hoy_min": hoy_min, "hoy_hhmm": _hhmm(hoy_min),
        })
    return out


@router.post("/{emp_id}/entrada")
def marcar_entrada(emp_id: int, db: Session = Depends(get_db)):
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == emp_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    abierto = db.query(Fichaje).filter(Fichaje.empleado_id == emp_id, Fichaje.salida == None).first()
    if abierto:
        raise HTTPException(400, "Ya tenés una entrada abierta. Marcá la salida primero.")
    f = Fichaje(empleado_id=emp_id, entrada=_utcnow())
    db.add(f); db.commit(); db.refresh(f)
    return _fichaje_dict(f)


@router.post("/{emp_id}/salida")
def marcar_salida(emp_id: int, db: Session = Depends(get_db)):
    abierto = db.query(Fichaje).filter(Fichaje.empleado_id == emp_id, Fichaje.salida == None).order_by(Fichaje.id.desc()).first()
    if not abierto:
        raise HTTPException(400, "No hay una entrada abierta.")
    abierto.salida = _utcnow()
    db.commit(); db.refresh(abierto)
    return _fichaje_dict(abierto)


# ── Resumen mensual ───────────────────────────────────────────────
@router.get("/resumen")
def resumen(month: str = "", db: Session = Depends(get_db)):
    """month = 'YYYY-MM' (local AR). Suma horas por empleado en ese mes."""
    now_ar = _ar(_utcnow())
    if not month:
        month = now_ar.strftime("%Y-%m")
    try:
        y, m = int(month[:4]), int(month[5:7])
    except Exception:
        raise HTTPException(400, "Mes inválido (YYYY-MM)")
    ini_ar = datetime(y, m, 1, tzinfo=AR)
    ini_next = datetime(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1, tzinfo=AR)
    ini_utc = ini_ar.astimezone(timezone.utc)
    fin_utc = ini_next.astimezone(timezone.utc)

    emps = db.query(FichajeEmpleado).order_by(FichajeEmpleado.orden, FichajeEmpleado.nombre).all()
    fichajes = db.query(Fichaje).filter(Fichaje.entrada >= ini_utc, Fichaje.entrada < fin_utc).order_by(Fichaje.entrada).all()

    por_emp: dict = {}
    for f in fichajes:
        por_emp.setdefault(f.empleado_id, []).append(f)

    filas = []
    total_general = 0
    for e in emps:
        regs = por_emp.get(e.id, [])
        if not e.activo and not regs:
            continue
        total_min = sum(_dur_min(f.entrada, f.salida) for f in regs)
        dias = len({_ar(f.entrada).strftime("%Y-%m-%d") for f in regs})
        total_general += total_min
        filas.append({
            "empleado_id": e.id, "nombre": e.nombre,
            "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida,
            "activo": bool(e.activo),
            "total_min": total_min, "total_hhmm": _hhmm(total_min), "dias": dias,
            "fichajes": [_fichaje_dict(f) for f in sorted(regs, key=lambda x: x.entrada, reverse=True)],
        })
    return {"month": month, "total_general_min": total_general, "total_general_hhmm": _hhmm(total_general), "empleados": filas}


# ── Correcciones manuales (olvidos) ───────────────────────────────
class ManualIn(BaseModel):
    empleado_id: int
    entrada: str            # 'YYYY-MM-DDTHH:MM' (AR)
    salida: Optional[str] = None
    nota: Optional[str] = ""


@router.post("/manual", status_code=201)
def agregar_manual(body: ManualIn, db: Session = Depends(get_db)):
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == body.empleado_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    ent = _parse_ar(body.entrada)
    sal = _parse_ar(body.salida) if body.salida else None
    if sal and sal <= ent:
        raise HTTPException(400, "La salida debe ser posterior a la entrada.")
    f = Fichaje(empleado_id=body.empleado_id, entrada=ent, salida=sal, nota=(body.nota or ""))
    db.add(f); db.commit(); db.refresh(f)
    return _fichaje_dict(f)


class EditIn(BaseModel):
    entrada: Optional[str] = None
    salida: Optional[str] = None
    nota: Optional[str] = None


@router.put("/fichajes/{fid}")
def editar_fichaje(fid: int, body: EditIn, db: Session = Depends(get_db)):
    f = db.query(Fichaje).filter(Fichaje.id == fid).first()
    if not f:
        raise HTTPException(404, "Fichaje no encontrado")
    if body.entrada is not None:
        f.entrada = _parse_ar(body.entrada)
    if body.salida is not None:
        f.salida = _parse_ar(body.salida) if body.salida else None
    if body.nota is not None:
        f.nota = body.nota
    if f.salida and _aware(f.salida) <= _aware(f.entrada):
        raise HTTPException(400, "La salida debe ser posterior a la entrada.")
    db.commit(); db.refresh(f)
    return _fichaje_dict(f)


@router.delete("/fichajes/{fid}", status_code=204)
def borrar_fichaje(fid: int, db: Session = Depends(get_db)):
    f = db.query(Fichaje).filter(Fichaje.id == fid).first()
    if not f:
        raise HTTPException(404, "Fichaje no encontrado")
    db.delete(f); db.commit()


# ── Gestión de empleados ──────────────────────────────────────────
class EmpIn(BaseModel):
    nombre: str
    hora_entrada: Optional[str] = "08:00"
    hora_salida: Optional[str] = "17:00"
    activo: Optional[bool] = True


@router.post("/empleados", status_code=201)
def crear_empleado(body: EmpIn, db: Session = Depends(get_db)):
    if not body.nombre.strip():
        raise HTTPException(400, "El nombre es obligatorio.")
    if db.query(FichajeEmpleado).filter(FichajeEmpleado.nombre == body.nombre.strip()).first():
        raise HTTPException(409, "Ya existe un empleado con ese nombre.")
    orden = (db.query(FichajeEmpleado).count())
    e = FichajeEmpleado(nombre=body.nombre.strip(), hora_entrada=body.hora_entrada or "08:00",
                        hora_salida=body.hora_salida or "17:00", activo=bool(body.activo), orden=orden)
    db.add(e); db.commit(); db.refresh(e)
    return {"id": e.id, "nombre": e.nombre, "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": e.activo}


@router.put("/empleados/{emp_id}")
def editar_empleado(emp_id: int, body: EmpIn, db: Session = Depends(get_db)):
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == emp_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    e.nombre = body.nombre.strip() or e.nombre
    if body.hora_entrada is not None:
        e.hora_entrada = body.hora_entrada
    if body.hora_salida is not None:
        e.hora_salida = body.hora_salida
    if body.activo is not None:
        e.activo = bool(body.activo)
    db.commit(); db.refresh(e)
    return {"id": e.id, "nombre": e.nombre, "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": e.activo}
