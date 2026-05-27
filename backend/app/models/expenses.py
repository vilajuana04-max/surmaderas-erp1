from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class SharedExpenseItem(Base):
    __tablename__ = "shared_expense_items"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(150), unique=True, nullable=False)
    category    = Column(String(100))
    is_active   = Column(Boolean, default=True)

    expenses = relationship("SharedExpense", back_populates="item")


class SharedExpense(Base):
    __tablename__ = "shared_expenses"

    id              = Column(Integer, primary_key=True)
    item_id         = Column(Integer, ForeignKey("shared_expense_items.id"))
    month           = Column(String(20), nullable=False)
    year            = Column(Integer, nullable=False)
    total_amount    = Column(Numeric(15, 2))
    luro_amount     = Column(Numeric(15, 2))
    due_date        = Column(Date)
    detail          = Column(Text)
    paid_status     = Column(String(20), default="NO")

    item = relationship("SharedExpenseItem", back_populates="expenses")


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), unique=True, nullable=False)
    parent_id   = Column(Integer, ForeignKey("expense_categories.id"))

    parent      = relationship("ExpenseCategory", remote_side="ExpenseCategory.id")
    children    = relationship("ExpenseCategory", back_populates="parent")


class LuroExpense(Base):
    __tablename__ = "luro_expenses"

    id              = Column(Integer, primary_key=True)
    month           = Column(String(20))
    year            = Column(Integer)
    expense_date    = Column(Date)
    # Texto libre (sistema nuevo — sin FK)
    categoria       = Column(String(100))
    subcategoria    = Column(String(150))
    pagado          = Column(String(10), default='NO')
    # Legacy FK (se mantienen para no romper datos viejos)
    category_id     = Column(Integer, ForeignKey("expense_categories.id"), nullable=True)
    subcategory_id  = Column(Integer, ForeignKey("expense_categories.id"), nullable=True)
    detail          = Column(String(300))
    amount          = Column(Numeric(15, 2))
    payment_method  = Column(String(50))
    paid_status     = Column(Boolean, default=False)

    category    = relationship("ExpenseCategory", foreign_keys=[category_id])
    subcategory = relationship("ExpenseCategory", foreign_keys=[subcategory_id])


class GastoCompartido(Base):
    """
    Tabla simple para gastos compartidos entre sucursales.
    Keyed por (year, month, item_key). Sin catálogo externo.
    Items fijos: item_key coincide con slug definido en el frontend.
    Items custom: item_key = 'custom_XXXX', custom_name = nombre del item.
    """
    __tablename__ = "gastos_compartidos"
    __table_args__ = (UniqueConstraint("year", "month", "item_key", name="uq_gasto_compartido"),)

    id           = Column(Integer, primary_key=True)
    year         = Column(Integer,      nullable=False)
    month        = Column(String(20),   nullable=False)
    item_key     = Column(String(100),  nullable=False)
    total_amount = Column(Numeric(15, 2))
    indep_amount = Column(Numeric(15, 2))
    due_date     = Column(Date)
    detail       = Column(Text)
    paid_status  = Column(String(20), default="NO")
    custom_name  = Column(String(150))                    # solo para items custom
    split_type   = Column(String(10),  default="half")    # 'half' | 'full'
