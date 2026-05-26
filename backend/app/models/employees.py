from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    branch_id   = Column(Integer, ForeignKey("branches.id"))
    hire_date   = Column(Date, nullable=False)
    is_active   = Column(Boolean, default=True)

    # Extended fields for AjustesTab
    cuil             = Column(String(20),  nullable=True)
    position         = Column(String(100), nullable=True)
    phone            = Column(String(50),  nullable=True)
    email_address    = Column(String(200), nullable=True)
    payroll_type     = Column(String(20),  nullable=True, default='standard')  # standard|manual|hourly
    default_plus_pct = Column(Integer,     nullable=True)
    notes            = Column(String(500), nullable=True)

    branch          = relationship("Branch")
    payroll_items   = relationship("PayrollItem", back_populates="employee")
    vacation_records = relationship("VacationRecord", back_populates="employee")
    vacation_logs   = relationship("VacationLog", back_populates="employee")
