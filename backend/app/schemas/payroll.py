from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class PayrollItemCreate(BaseModel):
    """Campos que el usuario edita (equivalen a las celdas del Excel)."""
    employee_id:        int
    inasistencias_desc: Optional[str]     = None
    adelanto:           Decimal           = Decimal("0")
    deposito_banco:     Decimal           = Decimal("0")
    horas:              Optional[Decimal] = None
    precio_hora:        Optional[Decimal] = None
    plus_factor:        Optional[Decimal] = None
    bruto_manual:       Optional[Decimal] = None
    comision:           Optional[Decimal] = None    # incentivo / comisión / hora extra
    comision_desc:      Optional[str]     = None    # etiqueta para el recibo
    es_base:            bool              = False   # True = bruto = dep×1 (sin ×2)
    sin_dep:            bool              = False   # True = percibido = bruto − adelanto


class PayrollItemOut(BaseModel):
    """Output con campos calculados incluidos."""
    id:                 int
    employee_id:        int
    employee_name:      Optional[str]     = None
    inasistencias_desc: Optional[str]     = None
    adelanto:           Decimal
    deposito_banco:     Decimal
    horas:              Optional[Decimal] = None
    precio_hora:        Optional[Decimal] = None
    plus_factor:        Optional[Decimal] = None
    bruto_manual:       Optional[Decimal] = None
    comision:           Optional[Decimal] = None
    comision_desc:      Optional[str]     = None
    es_base:            bool              = False
    sin_dep:            bool              = False
    # Calculados
    total_bruto:        float
    plus_pesos:         float
    total_percibido:    float

    model_config = {"from_attributes": True}


class PayrollPeriodOut(BaseModel):
    id:          int
    month:       str
    year:        int
    branch_id:   int
    branch_name: Optional[str] = None
    status:      str
    items:       list[PayrollItemOut] = []

    model_config = {"from_attributes": True}
