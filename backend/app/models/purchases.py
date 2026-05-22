from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id      = Column(Integer, primary_key=True)
    name    = Column(String(100), unique=True, nullable=False)

    purchases = relationship("Purchase", back_populates="provider")


class Purchase(Base):
    __tablename__ = "purchases"

    id              = Column(Integer, primary_key=True)
    purchase_date   = Column(Date)
    invoice_number  = Column(String(50))
    provider_id     = Column(Integer, ForeignKey("providers.id"))
    total_amount    = Column(Numeric(15, 2), nullable=False)
    flag            = Column(String(20))
    month_label     = Column(String(20))
    year            = Column(Integer)
    closed          = Column(Boolean, default=False)

    provider = relationship("Provider", back_populates="purchases")
