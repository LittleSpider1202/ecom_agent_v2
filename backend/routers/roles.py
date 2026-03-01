from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from database import get_db
from models import Role
from auth import require_current_user as get_current_user

router = APIRouter(prefix="/api/roles", tags=["roles"])


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = {}
    node_types: Optional[List[str]] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    node_types: Optional[List[str]] = None


def role_to_dict(r: Role):
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "permissions": r.permissions or {},
        "node_types": r.node_types or [],
    }


@router.get("")
def list_roles(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    roles = db.query(Role).order_by(Role.id).all()
    return [role_to_dict(r) for r in roles]


@router.post("")
def create_role(body: RoleCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    role = Role(name=body.name, description=body.description,
                permissions=body.permissions, node_types=body.node_types)
    db.add(role)
    db.commit()
    db.refresh(role)
    from routers.logs import add_log
    add_log(current_user.username, "角色变更", f"创建角色：{body.name}")
    return role_to_dict(role)


@router.get("/{role_id}")
def get_role(role_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role_to_dict(role)


@router.put("/{role_id}")
def update_role(role_id: int, body: RoleUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description
    if body.permissions is not None:
        role.permissions = body.permissions
    if body.node_types is not None:
        role.node_types = body.node_types
    db.commit()
    db.refresh(role)
    return role_to_dict(role)
