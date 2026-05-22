from sqlalchemy import Column, Integer, String
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(50), unique=True, nullable=False)
    address     = Column(String(200))
    union_type  = Column(String(50))


class AppConfig(Base):
    __tablename__ = "app_config"

    key     = Column(String(50), primary_key=True)
    value   = Column(String(100), nullable=False)
