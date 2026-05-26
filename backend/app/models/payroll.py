from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
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
    inasistencias_desc = Column(String,        nullable=True)        # col B — texto libre
    adelanto           = Column(Numeric(15, 2), default=0)           # col C
    deposito_banco     = Column(Numeric(15, 2), default=0)           # col D
    horas              = Column(Numeric(8,  2), nullable=True)       # col E (Q)
    precio_hora        = Column(Numeric(15, 2), nullable=True)       # col F ($ x hora)
    plus_factor        = Column(Numeric(5,  3), nullable=True)       # col G (1.3, 1.2, 1.1)
    bruto_manual       = Column(Numeric(15, 2), nullable=True)       # override manual Total bruto

    period   = relationship("PayrollPeriod", back_populates="items")
    employee = relationship("Employee", back_populates="payroll_items")

    # ── Propiedades calculadas (equivalentes a las fórmulas Excel) ────

    @property
    def total_bruto(self) -> float:
        """
        Col I — Total bruto.
        Prioridad:
          1. horas × precio_hora  (empleados por hora, ej: Viejo Ariel)
          2. bruto_manual         (entrada directa del usuario)
          3. deposito_banco × 2   (fórmula automática Excel =D×2 cuando hay Plus)
          4. deposito_banco       (fallback sin plus)
        """
        if self.horas and self.precio_hora:
            return round(float(self.horas) * float(self.precio_hora), 2)
        if self.bruto_manual and float(self.bruto_manual) != 0:
            return float(self.bruto_manual)
        dep = float(self.deposito_banco or 0)
        if dep > 0 and self.plus_factor and float(self.plus_factor) > 1:
            return round(dep * 2, 2)
        return dep

    @property
    def plus_pesos(self) -> float:
        """Col H — Plus en $: total_bruto × (plus_factor − 1), solo si Plus > 1."""
        if not self.plus_factor or float(self.plus_factor) <= 1:
            return 0.0
        return round(self.total_bruto * (float(self.plus_factor) - 1), 2)

    @property
    def total_percibido(self) -> float:
        """
        Col J — Total percibido.
        Fórmula Excel: =(I × G) − C − D   [cuando hay Plus]
        Sin Plus:        = I − C − D
        Solo deposito:   = D − C           (Avila / Guillermo)
        Unificado: total_bruto × factor − adelanto − deposito
        donde factor = plus_factor (>=1) ó 1.0 si no hay plus
        """
        bruto   = self.total_bruto
        factor  = float(self.plus_factor) if self.plus_factor and float(self.plus_factor) > 1 else 1.0
        adelanto = float(self.adelanto or 0)
        deposito = float(self.deposito_banco or 0)
        return round(bruto * factor - adelanto - deposito, 2)
