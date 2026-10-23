"""Control horario (fichaje): entrada/salida con PIN, feriados y resumen mensual.

Reglas Sur Maderas:
- Domingos: no se trabaja.
- Sábados: todos 09:00–13:00 (4 h esperadas).
- Feriados cargados: no cuentan como falta.
- Lun–Vie: horario esperado propio de cada empleado.
"""
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.users import User
from app.models.fichaje import FichajeEmpleado, Fichaje, FichajeFeriado
from app.permissions import effective_permissions, LEVEL_RANK

router = APIRouter(prefix="/fichaje", tags=["fichaje"])

AR = timezone(timedelta(hours=-3))   # Argentina (UTC-3)
DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
SAB_MIN = 240   # sábados 09–13


# ── Auth admin (para gestión) ─────────────────────────────────────
def _admin(user: User, db: Session) -> User:
    if user.is_primary_admin:
        return user
    perms = effective_permissions(user, db)
    if LEVEL_RANK.get(perms.get("rrhh", "none"), 0) >= LEVEL_RANK["edit"]:
        return user
    raise HTTPException(403, "Necesitás permiso de RRHH.")


# ── Helpers de tiempo ─────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _ar(dt):
    dt = _aware(dt)
    return dt.astimezone(AR) if dt else None


def _dur_min(entrada, salida) -> int:
    ini = _aware(entrada)
    fin = _aware(salida) or _utcnow()
    return max(0, int((fin - ini).total_seconds() // 60))


def _hhmm(mins: int) -> str:
    return f"{mins // 60}:{mins % 60:02d}"


def _sched_min(e: FichajeEmpleado) -> int:
    try:
        h1, m1 = map(int, (e.hora_entrada or "08:00").split(":"))
        h2, m2 = map(int, (e.hora_salida or "17:00").split(":"))
        return max(0, (h2 * 60 + m2) - (h1 * 60 + m1))
    except Exception:
        return 540


def _parse_ar(s: str) -> datetime:
    s = (s or "").strip().replace(" ", "T")
    local = datetime.strptime(s[:16], "%Y-%m-%dT%H:%M").replace(tzinfo=AR)
    return local.astimezone(timezone.utc)


def _fichaje_dict(f: Fichaje) -> dict:
    ent = _ar(f.entrada); sal = _ar(f.salida)
    return {
        "id": f.id, "empleado_id": f.empleado_id,
        "fecha": ent.strftime("%Y-%m-%d") if ent else "",
        "entrada_hora": ent.strftime("%H:%M") if ent else "",
        "salida_hora": sal.strftime("%H:%M") if sal else "",
        "min": _dur_min(f.entrada, f.salida), "abierto": f.salida is None,
        "nota": f.nota or "",
    }


# ── Kiosco: empleados + estado (sin exponer PIN) ──────────────────
@router.get("/empleados")
def empleados(db: Session = Depends(get_db)):
    emps = db.query(FichajeEmpleado).filter(FichajeEmpleado.activo == True).order_by(
        FichajeEmpleado.orden, FichajeEmpleado.nombre).all()
    hoy_ar = _ar(_utcnow()).strftime("%Y-%m-%d")
    out = []
    for e in emps:
        abierto = db.query(Fichaje).filter(Fichaje.empleado_id == e.id, Fichaje.salida == None).order_by(Fichaje.id.desc()).first()
        hoy_min = 0
        for f in db.query(Fichaje).filter(Fichaje.empleado_id == e.id).all():
            ent = _ar(f.entrada)
            if ent and ent.strftime("%Y-%m-%d") == hoy_ar:
                hoy_min += _dur_min(f.entrada, f.salida)
        out.append({
            "id": e.id, "nombre": e.nombre,
            "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida,
            "tiene_pin": bool((e.pin or "").strip()),
            "abierto": abierto is not None,
            "entrada_actual_hora": (_ar(abierto.entrada).strftime("%H:%M") if abierto else ""),
            "hoy_min": hoy_min, "hoy_hhmm": _hhmm(hoy_min),
        })
    return out


class PinIn(BaseModel):
    pin: str = ""


def _check_pin(e: FichajeEmpleado, pin: str):
    real = (e.pin or "").strip()
    if real and (pin or "").strip() != real:
        raise HTTPException(403, "PIN incorrecto.")


@router.post("/{emp_id}/entrada")
def marcar_entrada(emp_id: int, body: PinIn, db: Session = Depends(get_db)):
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == emp_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    _check_pin(e, body.pin)
    if db.query(Fichaje).filter(Fichaje.empleado_id == emp_id, Fichaje.salida == None).first():
        raise HTTPException(400, "Ya tenés una entrada abierta. Marcá la salida primero.")
    f = Fichaje(empleado_id=emp_id, entrada=_utcnow())
    db.add(f); db.commit(); db.refresh(f)
    return _fichaje_dict(f)


@router.post("/{emp_id}/salida")
def marcar_salida(emp_id: int, body: PinIn, db: Session = Depends(get_db)):
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == emp_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    _check_pin(e, body.pin)
    abierto = db.query(Fichaje).filter(Fichaje.empleado_id == emp_id, Fichaje.salida == None).order_by(Fichaje.id.desc()).first()
    if not abierto:
        raise HTTPException(400, "No hay una entrada abierta.")
    abierto.salida = _utcnow()
    db.commit(); db.refresh(abierto)
    return _fichaje_dict(abierto)


# ── Resumen mensual (día por día) ─────────────────────────────────
@router.get("/resumen")
def resumen(month: str = "", db: Session = Depends(get_db)):
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

    # Último día a mostrar: fin de mes, o hoy si el mes es el actual
    last_day = (ini_next - timedelta(days=1)).date()
    hoy = now_ar.date()
    end_day = min(last_day, hoy) if (y == hoy.year and m == hoy.month) else last_day

    feriados = {f.fecha: (f.nombre or "") for f in db.query(FichajeFeriado).filter(
        FichajeFeriado.fecha >= date(y, m, 1), FichajeFeriado.fecha < ini_next.date()).all()}

    emps = db.query(FichajeEmpleado).order_by(FichajeEmpleado.orden, FichajeEmpleado.nombre).all()
    fichajes = db.query(Fichaje).filter(Fichaje.entrada >= ini_utc, Fichaje.entrada < fin_utc).order_by(Fichaje.entrada).all()

    # bucket: (empleado_id, 'YYYY-MM-DD') -> [fichajes]
    buckets: dict = {}
    for f in fichajes:
        key = (f.empleado_id, _ar(f.entrada).strftime("%Y-%m-%d"))
        buckets.setdefault(key, []).append(f)

    # lista de días del mes a considerar
    dias_mes = []
    d = date(y, m, 1)
    while d <= end_day:
        dias_mes.append(d)
        d += timedelta(days=1)

    filas = []
    total_general = 0
    for e in emps:
        regs_mes = [f for f in fichajes if f.empleado_id == e.id]
        if not e.activo and not regs_mes:
            continue
        dias = []
        trabajado_total = 0
        esperado_total = 0
        dias_trab = 0
        for dd in dias_mes:
            key = (e.id, dd.strftime("%Y-%m-%d"))
            regs = buckets.get(key, [])
            trab = sum(_dur_min(f.entrada, f.salida) for f in regs)
            wd = dd.weekday()  # 0=Lun ... 6=Dom
            if dd in feriados:
                tipo, esp, fnom = "feriado", 0, feriados[dd]
            elif wd == 6:
                tipo, esp, fnom = "domingo", 0, ""
            elif wd == 5:
                tipo, esp, fnom = "sabado", SAB_MIN, ""
            else:
                tipo, esp, fnom = "habil", _sched_min(e), ""
            trabajado_total += trab
            esperado_total += esp
            if trab > 0:
                dias_trab += 1
            # Solo incluir días con actividad o laborables (evita llenar de domingos vacíos)
            if trab > 0 or tipo in ("habil", "sabado") or tipo == "feriado":
                dias.append({
                    "fecha": dd.strftime("%Y-%m-%d"), "dow": DOW[wd], "tipo": tipo,
                    "feriado_nombre": fnom, "esperado_min": esp,
                    "trabajado_min": trab, "trabajado_hhmm": _hhmm(trab),
                    "fichajes": [_fichaje_dict(f) for f in sorted(regs, key=lambda x: x.entrada)],
                })
        total_general += trabajado_total
        filas.append({
            "empleado_id": e.id, "nombre": e.nombre,
            "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": bool(e.activo),
            "trabajado_min": trabajado_total, "trabajado_hhmm": _hhmm(trabajado_total),
            "esperado_min": esperado_total, "esperado_hhmm": _hhmm(esperado_total),
            "dias_trabajados": dias_trab, "dias": dias,
        })

    return {
        "month": month,
        "feriados": [{"fecha": k.strftime("%Y-%m-%d"), "nombre": v} for k, v in sorted(feriados.items())],
        "total_general_min": total_general, "total_general_hhmm": _hhmm(total_general),
        "empleados": filas,
    }


# ── Feriados ──────────────────────────────────────────────────────
@router.get("/feriados")
def list_feriados(month: str = "", db: Session = Depends(get_db)):
    q = db.query(FichajeFeriado)
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
            ini = date(y, m, 1)
            fin = date(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1)
            q = q.filter(FichajeFeriado.fecha >= ini, FichajeFeriado.fecha < fin)
        except Exception:
            pass
    return [{"id": f.id, "fecha": f.fecha.strftime("%Y-%m-%d"), "nombre": f.nombre or ""}
            for f in q.order_by(FichajeFeriado.fecha).all()]


class FeriadoIn(BaseModel):
    fecha: str
    nombre: Optional[str] = ""


@router.post("/feriados", status_code=201)
def crear_feriado(body: FeriadoIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    try:
        d = datetime.strptime(body.fecha[:10], "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(400, "Fecha inválida (YYYY-MM-DD)")
    ex = db.query(FichajeFeriado).filter(FichajeFeriado.fecha == d).first()
    if ex:
        ex.nombre = body.nombre or ex.nombre
        db.commit(); db.refresh(ex)
        return {"id": ex.id, "fecha": ex.fecha.strftime("%Y-%m-%d"), "nombre": ex.nombre or ""}
    f = FichajeFeriado(fecha=d, nombre=body.nombre or "")
    db.add(f); db.commit(); db.refresh(f)
    return {"id": f.id, "fecha": f.fecha.strftime("%Y-%m-%d"), "nombre": f.nombre or ""}


@router.delete("/feriados/{fid}", status_code=204)
def borrar_feriado(fid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    f = db.query(FichajeFeriado).filter(FichajeFeriado.id == fid).first()
    if f:
        db.delete(f); db.commit()


# ── Correcciones manuales de fichaje (admin) ──────────────────────
class ManualIn(BaseModel):
    empleado_id: int
    entrada: str
    salida: Optional[str] = None
    nota: Optional[str] = ""


@router.post("/manual", status_code=201)
def agregar_manual(body: ManualIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
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
def editar_fichaje(fid: int, body: EditIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
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
def borrar_fichaje(fid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    f = db.query(Fichaje).filter(Fichaje.id == fid).first()
    if f:
        db.delete(f); db.commit()


# ── Gestión de empleados + PIN (admin) ────────────────────────────
@router.get("/admin/empleados")
def admin_empleados(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    rows = db.query(FichajeEmpleado).order_by(FichajeEmpleado.orden, FichajeEmpleado.nombre).all()
    return [{"id": e.id, "nombre": e.nombre, "pin": e.pin or "",
             "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": bool(e.activo)} for e in rows]


class EmpIn(BaseModel):
    nombre: str
    pin: Optional[str] = None
    hora_entrada: Optional[str] = "08:00"
    hora_salida: Optional[str] = "17:00"
    activo: Optional[bool] = True


@router.post("/empleados", status_code=201)
def crear_empleado(body: EmpIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    if not body.nombre.strip():
        raise HTTPException(400, "El nombre es obligatorio.")
    if db.query(FichajeEmpleado).filter(FichajeEmpleado.nombre == body.nombre.strip()).first():
        raise HTTPException(409, "Ya existe un empleado con ese nombre.")
    e = FichajeEmpleado(nombre=body.nombre.strip(), pin=(body.pin or "").strip(),
                        hora_entrada=body.hora_entrada or "08:00", hora_salida=body.hora_salida or "17:00",
                        activo=bool(body.activo), orden=db.query(FichajeEmpleado).count())
    db.add(e); db.commit(); db.refresh(e)
    return {"id": e.id, "nombre": e.nombre, "pin": e.pin or "", "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": e.activo}


@router.put("/empleados/{emp_id}")
def editar_empleado(emp_id: int, body: EmpIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _admin(user, db)
    e = db.query(FichajeEmpleado).filter(FichajeEmpleado.id == emp_id).first()
    if not e:
        raise HTTPException(404, "Empleado no encontrado")
    e.nombre = body.nombre.strip() or e.nombre
    if body.pin is not None:
        e.pin = body.pin.strip()
    if body.hora_entrada is not None:
        e.hora_entrada = body.hora_entrada
    if body.hora_salida is not None:
        e.hora_salida = body.hora_salida
    if body.activo is not None:
        e.activo = bool(body.activo)
    db.commit(); db.refresh(e)
    return {"id": e.id, "nombre": e.nombre, "pin": e.pin or "", "hora_entrada": e.hora_entrada, "hora_salida": e.hora_salida, "activo": e.activo}
