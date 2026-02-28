from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import User, Department
from auth import require_current_user as get_current_user, get_password_hash

router = APIRouter(prefix="/api/members", tags=["members"])


class InviteRequest(BaseModel):
    display_name: str
    email: Optional[str] = None
    feishu_id: Optional[str] = None
    role: str = "executor"
    department_id: Optional[int] = None


class UpdateMemberRequest(BaseModel):
    role: Optional[str] = None
    department_id: Optional[int] = None
    display_name: Optional[str] = None


def user_to_dict(u: User, departments: dict):
    dept = departments.get(u.department_id)
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "email": u.email,
        "feishu_id": u.feishu_id,
        "role": u.role,
        "is_active": u.is_active,
        "department_id": u.department_id,
        "department_name": dept.name if dept else None,
    }


@router.get("")
def list_members(
    q: Optional[str] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(User).filter(User.is_active == True)
    if q:
        query = query.filter(
            (User.display_name.ilike(f"%{q}%")) |
            (User.username.ilike(f"%{q}%")) |
            (User.feishu_id.ilike(f"%{q}%"))
        )
    if department_id is not None:
        query = query.filter(User.department_id == department_id)
    users = query.order_by(User.id).all()
    depts = {d.id: d for d in db.query(Department).all()}
    return [user_to_dict(u, depts) for u in users]


@router.post("/invite")
def invite_member(
    body: InviteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    # Generate username from feishu_id or email
    username = body.feishu_id or (body.email.split("@")[0] if body.email else None)
    if not username:
        raise HTTPException(status_code=400, detail="需要提供飞书ID或邮箱")
    # Check duplicate
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="该用户已存在")
    user = User(
        username=username,
        display_name=body.display_name,
        email=body.email,
        feishu_id=body.feishu_id,
        role=body.role,
        hashed_password=get_password_hash("changeme123"),
        is_active=True,
        department_id=body.department_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    depts = {d.id: d for d in db.query(Department).all()}
    return {"ok": True, "user": user_to_dict(user, depts)}


@router.put("/{user_id}")
def update_member(
    user_id: int,
    body: UpdateMemberRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        user.role = body.role
    if body.department_id is not None:
        user.department_id = body.department_id
    if body.display_name is not None:
        user.display_name = body.display_name
    db.commit()
    db.refresh(user)
    depts = {d.id: d for d in db.query(Department).all()}
    return user_to_dict(user, depts)


@router.delete("/{user_id}")
def remove_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能移除自己")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"ok": True}
