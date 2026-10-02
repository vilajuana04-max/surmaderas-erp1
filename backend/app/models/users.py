from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    role          = Column(String(30), default='caja')   # plantilla: Administrador | Caja | Ventas | Personalizado (+ legacy)
    active        = Column(Boolean, default=True)
    name          = Column(String(120), default='')       # nombre visible
    branch        = Column(String(20), nullable=True)      # sucursal: luro | independencia | NULL (todas)
    is_primary_admin = Column(Boolean, default=False)      # Gustavo — protegido
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id       = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    module   = Column(String(40), nullable=False)
    level    = Column(String(10), default='none')   # none | view | edit | admin


class UserAudit(Base):
    __tablename__ = "user_audit"

    id         = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    actor      = Column(String(120), default='')    # quién hizo la acción
    action     = Column(String(80), default='')     # creó | editó permisos | pausó | reactivó | cambió contraseña | …
    target     = Column(String(120), default='')    # usuario afectado
    detail     = Column(Text, default='')
