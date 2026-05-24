from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class PayslipUpload(Base):
    __tablename__ = "payslip_uploads"

    id          = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year        = Column(Integer, nullable=False)
    month       = Column(String(20), nullable=False)
    filename    = Column(String(200), nullable=False)
    file_data   = Column(Text, nullable=False)       # base64-encoded PDF
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")
