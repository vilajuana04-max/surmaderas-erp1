"""
Proxy seguro hacia el servidor de encuestas de Sur Maderas.
Maneja autenticación con token cacheado en memoria para evitar
re-login en cada llamada.

Env vars requeridas en Render:
  ENCUESTAS_USERNAME  — usuario admin del sistema de encuestas
  ENCUESTAS_PASSWORD  — contraseña admin del sistema de encuestas
"""

import os
import time
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/cupones", tags=["cupones"])

ENCUESTAS_BASE = "https://surmaderas-gestion-server.vercel.app"

# ── Token cache en memoria ────────────────────────────────────────
_cached_token: str | None = None
_token_expires: float = 0          # unix timestamp
TOKEN_TTL = 50 * 60               # 50 minutos (JWTs suelen durar 1h)


async def _get_token() -> str:
    """Devuelve token válido; re-login automático si expiró."""
    global _cached_token, _token_expires

    if _cached_token and time.time() < _token_expires:
        return _cached_token

    username = os.getenv("ENCUESTAS_USERNAME")
    password = os.getenv("ENCUESTAS_PASSWORD")

    if not username or not password:
        raise HTTPException(
            status_code=503,
            detail="Credenciales del sistema de encuestas no configuradas. "
                   "Agrega ENCUESTAS_USERNAME y ENCUESTAS_PASSWORD en Render.",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            f"{ENCUESTAS_BASE}/auth/login",
            json={"username": username, "password": password},
        )

    if not res.is_success:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo autenticar con el servidor de encuestas: {res.text[:200]}",
        )

    data = res.json()
    # La respuesta puede ser { token: "..." } o { sm_auth: { token: "..." } }
    token = data.get("token") or (data.get("sm_auth") or {}).get("token")
    if not token:
        raise HTTPException(status_code=502, detail="Respuesta de login sin token")

    _cached_token = token
    _token_expires = time.time() + TOKEN_TTL
    return token


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _encuestas_post(path: str, body: dict) -> dict:
    """Llama al servidor de encuestas; reintenta 1 vez si el token expiró."""
    for attempt in range(2):
        token = await _get_token()
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{ENCUESTAS_BASE}{path}",
                json=body,
                headers=_auth_headers(token),
            )

        if res.status_code == 401 and attempt == 0:
            # Token inválido → forzar re-login en el próximo intento
            global _cached_token, _token_expires
            _cached_token = None
            _token_expires = 0
            continue

        data = res.json() if res.content else {}
        if not res.is_success:
            raise HTTPException(
                status_code=res.status_code,
                detail=data.get("message") or f"Error {res.status_code}",
            )
        return data

    raise HTTPException(status_code=502, detail="No se pudo autenticar con el servidor de encuestas")


# ── Schemas ───────────────────────────────────────────────────────
class CuponRequest(BaseModel):
    couponCode: str


# ── Endpoints ─────────────────────────────────────────────────────
@router.post("/consultar")
async def consultar_cupon(body: CuponRequest):
    """Busca el estado de un cupón sin marcarlo como usado."""
    return await _encuestas_post(
        "/api/encuestas/cupones/consultar",
        {"couponCode": body.couponCode.strip().upper()},
    )


@router.post("/validar")
async def validar_cupon(body: CuponRequest):
    """Marca el cupón como usado (dar de baja)."""
    return await _encuestas_post(
        "/api/encuestas/cupones/validar",
        {"couponCode": body.couponCode.strip().upper()},
    )


@router.get("/lista")
async def lista_cupones():
    """Devuelve todas las encuestas con su info de cupón y el resumen estadístico."""
    token = await _get_token()
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{ENCUESTAS_BASE}/api/encuestas",
            headers=_auth_headers(token),
        )
    if res.status_code == 401:
        global _cached_token, _token_expires
        _cached_token = None
        _token_expires = 0
        token = await _get_token()
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(
                f"{ENCUESTAS_BASE}/api/encuestas",
                headers=_auth_headers(token),
            )
    if not res.is_success:
        raise HTTPException(status_code=res.status_code, detail=f"Error {res.status_code}")
    return res.json()


@router.get("/export/csv")
async def export_csv():
    """Descarga el CSV de encuestas desde el servidor de encuestas."""
    from fastapi.responses import StreamingResponse
    token = await _get_token()
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{ENCUESTAS_BASE}/api/encuestas/export",
            headers=_auth_headers(token),
        )
    if not res.is_success:
        raise HTTPException(status_code=res.status_code, detail="No se pudo descargar el CSV")
    return StreamingResponse(
        iter([res.content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=encuestas-sur-maderas.csv"},
    )


@router.get("/export/excel")
async def export_excel():
    """Descarga el Excel de encuestas desde el servidor de encuestas."""
    from fastapi.responses import StreamingResponse
    token = await _get_token()
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{ENCUESTAS_BASE}/api/encuestas/export/excel",
            headers=_auth_headers(token),
        )
    if not res.is_success:
        raise HTTPException(status_code=res.status_code, detail="No se pudo descargar el Excel")
    return StreamingResponse(
        iter([res.content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=encuestas-sur-maderas.xlsx"},
    )
