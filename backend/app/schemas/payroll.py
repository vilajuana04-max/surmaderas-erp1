from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class PayrollItemCreate(BaseModel):
    """Campos que el usuario edita (equivalen a las celdas del Excel)."""
    employee_id:        int
    inasistencias_desc: Optional[str]     = None    # col B — texto libre
    adelanto:           Decimal           = Decimal("0")    # col C
    deposito_banco:     Decimal           = Decimal("0")    # col D
    horas:              Optional[Decimal] = None    # col E
    precio_hora:        Optional[Decimal] = None    # col F
    plus_factor:        Optional[Decimal] = None    # col G (1.3, 1.2, 1.1)
    bruto_manual:       Optional[Decimal] = None    # override manual Total bruto


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
