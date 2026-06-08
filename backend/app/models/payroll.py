from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"

    id        = Column(Integer, primary_key=True)
    month     = Column(String(20), nullable=False)
    year      = Column(Integer, nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    status    = Column(String(20), default="OPEN")

    branch = relationship("Branch")
    items  = relationship("PayrollItem", back_populates="period", cascade="all, delete-orphan")


class PayrollItem(Base):
    """
    Replica exacta de las columnas del Excel Luro/Independencia:
      B: inasistencias_desc  — texto libre (ej: "1 semana", "Del 03/02 al 16/02")
      C: adelanto            — adelantos pagados en el mes
      D: deposito_banco      — depósito bancario
      E: horas               — cantidad de horas (empleados por hora)
      F: precio_hora         — $ por hora
      G: plus_factor         — factor salarial (1.3, 1.2, 1.1 — 0 ó None = sin plus)
      Calculados:
      H: plus_pesos          = total_bruto × (plus_factor − 1)
      I: total_bruto         = horas × precio_hora  |  bruto_manual  |  deposito × 2
      J: total_percibido     = (total_bruto × plus_factor) − adelanto − deposito
    """
    __tablename__ = "payroll_items"

    id          = Column(Integer, primary_key=True)
    period_id   = Column(Integer, ForeignKey("payroll_periods.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))

    # ── Inputs manuales (idénticos a las celdas editables del Excel) ──
    inasistencias_desc = Column(String,         nullable=True)        # col B — texto libre
    adelanto           = Column(Numeric(15, 2), default=0)            # col C
    deposito_banco     = Column(Numeric(15, 2), default=0)            # col D
    horas              = Column(Numeric(8,  2), nullable=True)        # col E (Q)
    precio_hora        = Column(Numeric(15, 2), nullable=True)        # col F ($ x hora)
    plus_factor        = Column(Numeric(5,  3), nullable=True)        # col G (1.3, 1.2, 1.1)
    bruto_manual       = Column(Numeric(15, 2), nullable=True)        # sueldo base manual (Patricia)
    comision           = Column(Numeric(15, 2), nullable=True)        # incentivo / comisión / hora extra
    comision_desc      = Column(String,         nullable=True)        # etiqueta para el recibo
    es_base            = Column(Boolean,        default=False)        # True = bruto = dep×1 (no ×2)
    sin_dep            = Column(Boolean,        default=False)        # True = percibido = bruto − adelanto (sin descontar dep)

    period   = relationship("PayrollPeriod", back_populates="items")
    employee = relationship("Employee", back_populates="payroll_items")

    # ── Propiedades calculadas (equivalentes a las fórmulas Excel) ────

    @property
    def total_bruto(self) -> float:
        """
        Total bruto — siempre incluye la comisión/incentivo.
          Por horas:     horas × precio_hora + comision
          Sueldo base:   bruto_manual × plus_factor + comision
          Estándar:      dep × 2 × plus_factor + comision
        """
        pf       = float(self.plus_factor) if self.plus_factor and float(self.plus_factor) > 1 else 1.0
        comision = float(self.comision or 0)
        if self.horas and self.precio_hora:
            return round(float(self.horas) * float(self.precio_hora) + comision, 2)
        if self.bruto_manual and float(self.bruto_manual) != 0:
            return round(float(self.bruto_manual) * pf + comision, 2)
        dep        = float(self.deposito_banco or 0)
        multiplier = 1 if self.es_base else 2   # es_base=True → bruto = dep×1
        return round(dep * multiplier * pf + comision, 2)

    @property
    def plus_pesos(self) -> float:
        """
        Plus en $ — se calcula sobre la base ANTES de sumar comisión.
          Por horas:   0  (sin plus)
          Sueldo base: bruto_manual × (plus_factor − 1)
          Estándar:    dep × 2 × (plus_factor − 1)
        """
        if not self.plus_factor or float(self.plus_factor) <= 1:
            return 0.0
        pf = float(self.plus_factor)
        if self.horas and self.precio_hora:
            return 0.0
        if self.bruto_manual and float(self.bruto_manual) != 0:
            return round(float(self.bruto_manual) * (pf - 1), 2)
        dep        = float(self.deposito_banco or 0)
        multiplier = 1 if self.es_base else 2
        return round(dep * multiplier * (pf - 1), 2)

    @property
    def total_percibido(self) -> float:
        """
        Total percibido.
          Por horas / sueldo base: total_bruto − adelantos
          Estándar:                total_bruto − deposito_banco − adelantos
        """
        bruto    = self.total_bruto
        adelanto = float(self.adelanto or 0)
        # sin_dep (Alejandro): percibido = bruto − adelanto (NO descuenta deposito)
        if self.sin_dep:
            return round(bruto - adelanto, 2)
        # Por horas o sueldo base manual (Patricia): percibido = bruto − adelanto
        # es_base (Cecilia) y estándar: percibido = bruto − deposito − adelanto
        if not self.es_base and ((self.horas and self.precio_hora) or (self.bruto_manual and float(self.bruto_manual) != 0)):
            return round(bruto - adelanto, 2)
        deposito = float(self.deposito_banco or 0)
        return round(bruto - deposito - adelanto, 2)
