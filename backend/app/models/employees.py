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

    branch          = relationship("Branch")
    payroll_items   = relationship("PayrollItem", back_populates="employee")
    vacation_records = relationship("VacationRecord", back_populates="employee")
    vacation_logs   = relationship("VacationLog", back_populates="employee")
