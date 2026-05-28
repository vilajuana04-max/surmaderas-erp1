import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app import models  # noqa: registers all ORM models
from app.routers import (
    auth_router,
    sales_router, purchases_router, payroll_router,
    vacations_router, expenses_router, dashboard_router, employees_router,
    receipts_router, cashflow_router, vencimientos_router, gastos_personales_router,
    caja_diaria_router,
)

Base.metadata.create_all(bind=engine)

# ── CORS ────────────────────────────────────────────────────────
# En producción, solo el frontend de Vercel/Render puede conectarse.
# En desarrollo, se permiten localhost.
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]

if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# Permite cualquier subdominio de vercel.app y onrender.com para previews
ALLOWED_ORIGIN_REGEX = (
    r"https://(.*\.vercel\.app|.*\.onrender\.com|surmaderas.*\.vercel\.app)"
)

app = FastAPI(
    title       = "Sur Maderas ERP API",
    description = "Sistema ERP para Sur Maderas — Mar del Plata",
    version     = "1.0.0",
    docs_url    = "/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url   = None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins       = ALLOWED_ORIGINS,
    allow_origin_regex  = ALLOWED_ORIGIN_REGEX,
    allow_credentials   = True,
    allow_methods       = ["*"],
    allow_headers       = ["*"],
)

app.include_router(auth_router)
app.include_router(sales_router)
app.include_router(purchases_router)
app.include_router(payroll_router)
app.include_router(vacations_router)
app.include_router(expenses_router)
app.include_router(dashboard_router)
app.include_router(employees_router)
app.include_router(receipts_router)
app.include_router(cashflow_router)
app.include_router(vencimientos_router)
app.include_router(gastos_personales_router)
app.include_router(caja_diaria_router)


@app.get("/")
def root():
    return {
        "status":  "ok",
        "app":     "Sur Maderas ERP",
        "version": "1.0.0",
        "env":     os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
