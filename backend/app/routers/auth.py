from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.users import User
from app.auth import verify_password, create_access_token, get_current_user, hash_password
from app.permissions import effective_permissions

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class SelfPassword(BaseModel):
    current_password: str
    new_password: str


def _user_payload(user: User, db: Session) -> dict:
    return {
        "id":               user.id,
        "username":         user.username,
        "name":             user.name or user.username,
        "role":             user.role,
        "branch":           user.branch or None,
        "is_primary_admin": bool(user.is_primary_admin),
        "permissions":      effective_permissions(user, db),
    }


# ── POST /auth/login ─────────────────────────────────────────────
@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == req.username,
        User.active == True,
    ).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.username, "role": user.role})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user":         _user_payload(user, db),
    }


# ── GET /auth/me ─────────────────────────────────────────────────
@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_payload(current_user, db)


# ── PUT /auth/me/password — cambiar mi propia contraseña ─────────
@router.put("/me/password")
def change_my_password(data: SelfPassword, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(400, "La contraseña actual es incorrecta.")
    if not data.new_password or len(data.new_password) < 4:
        raise HTTPException(400, "La nueva contraseña es demasiado corta.")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}
