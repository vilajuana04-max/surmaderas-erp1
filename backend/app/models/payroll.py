from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"

    id          = Column(Integer, primary_key=True)
    month       = Column(String(20), nullable=False)
    year        = Column(Integer, nullable=False)
    branch_id   = Column(Integer, ForeignKey("branches.id"))
    status      = Column(String(20), default="OPEN")

    branch  = relationship("Branch")
    items   = relationship("PayrollItem", back_populates="period", cascade="all, delete-orphan")


class PayrollItem(Base):
    __tablename__ = "payroll_items"

    id              = Column(Integer, primary_key=True)
    period_id       = Column(Integer, ForeignKey("payroll_periods.id"))
    employee_id     = Column(Integer, ForeignKey("employees.id"))
    absences        = Column(Integer, default=0)
    base_salary     = Column(Numeric(15, 2))
    bank_deposit    = Column(Numeric(15, 2), default=0)
    advance         = Column(Numeric(15, 2), default=0)
    plus_pct        = Column(Numeric(5, 4), default=0)
    incentive       = Column(Numeric(15, 2), default=0)

    period      = relationship("PayrollPeriod", back_populates="items")
    employee    = relationship("Employee", back_populates="payroll_items")

    @property
    def plus_amount(self):
        if self.base_salary and self.plus_pct:
            return round(float(self.base_salary) * float(self.plus_pct), 2)
        return 0.0

    @property
    def gross_total(self):
        base = float(self.base_salary or 0)
        plus = self.plus_amount
        inc  = float(self.incentive or 0)
        return round(base + plus + inc, 2)

    @property
    def net_total(self):
        gross   = self.gross_total
        deposit = float(self.bank_deposit or 0)
        adv     = float(self.advance or 0)
        return round(gross - deposit - adv, 2)
