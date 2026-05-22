from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class VacationRecord(Base):
    __tablename__ = "vacation_records"

    id                  = Column(Integer, primary_key=True)
    year                = Column(Integer, nullable=False)
    employee_id         = Column(Integer, ForeignKey("employees.id"))
    days_entitled       = Column(Integer)
    days_taken          = Column(Integer, default=0)
    pending_prev_year   = Column(Integer, default=0)
    description         = Column(Text)

    employee = relationship("Employee", back_populates="vacation_records")

    @property
    def total_available(self):
        return (self.days_entitled or 0) + (self.pending_prev_year or 0)

    @property
    def pending_current(self):
        return self.total_available - (self.days_taken or 0)


class VacationLog(Base):
    __tablename__ = "vacation_log"

    id              = Column(Integer, primary_key=True)
    registered_date = Column(Date)
    year            = Column(Integer)
    employee_id     = Column(Integer, ForeignKey("employees.id"))
    date_from       = Column(Date)
    date_to         = Column(Date)
    days            = Column(Integer)
    status          = Column(String(30), default="Pendiente")
    approved_by     = Column(String(100))
    notes           = Column(Text)

    employee = relationship("Employee", back_populates="vacation_logs")
