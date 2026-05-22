from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class DailySales(Base):
    __tablename__ = "daily_sales"

    id              = Column(Integer, primary_key=True)
    sale_date       = Column(Date, nullable=False)
    branch_id       = Column(Integer, ForeignKey("branches.id"))
    total_amount    = Column(Numeric(15, 2))
    card_payments   = Column(Numeric(15, 2))
    ticket_count    = Column(Integer)
    month_label     = Column(String(20))
    year            = Column(Integer)
    closed          = Column(Boolean, default=False)

    branch = relationship("Branch")

    @property
    def avg_ticket(self):
        if self.ticket_count and self.ticket_count > 0 and self.total_amount:
            return round(float(self.total_amount) / self.ticket_count, 2)
        return None
