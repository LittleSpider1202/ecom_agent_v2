from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import authenticate_user, create_access_token, require_current_user, get_password_hash
from models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserInfo(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        },
    }


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(require_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name or current_user.username,
        "role": current_user.role,
    }


@router.post("/logout")
async def logout():
    # JWT is stateless; client clears token
    return {"message": "已退出登录"}
