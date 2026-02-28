from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Department
from auth import require_current_user as get_current_user

router = APIRouter(prefix="/api/departments", tags=["departments"])


class DeptCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class DeptUpdate(BaseModel):
    name: str


def dept_to_dict(d: Department):
    return {
        "id": d.id,
        "name": d.name,
        "parent_id": d.parent_id,
        "member_count": d.member_count,
    }


def build_tree(depts: list, parent_id=None):
    nodes = []
    for d in depts:
        if d["parent_id"] == parent_id:
            children = build_tree(depts, d["id"])
            node = {**d, "children": children}
            nodes.append(node)
    return nodes


@router.get("")
def list_departments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    depts = db.query(Department).order_by(Department.id).all()
    flat = [dept_to_dict(d) for d in depts]
    tree = build_tree(flat)
    return {"tree": tree, "flat": flat}


@router.post("")
def create_department(body: DeptCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    if body.parent_id:
        parent = db.query(Department).filter(Department.id == body.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent not found")
    dept = Department(name=body.name, parent_id=body.parent_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept_to_dict(dept)


@router.put("/{dept_id}")
def update_department(dept_id: int, body: DeptUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = body.name
    db.commit()
    db.refresh(dept)
    return dept_to_dict(dept)


@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Permission denied")
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if dept.member_count > 0:
        raise HTTPException(status_code=400, detail="该部门有成员，无法删除")
    # Check children
    children = db.query(Department).filter(Department.parent_id == dept_id).count()
    if children > 0:
        raise HTTPException(status_code=400, detail="该部门下有子部门，无法删除")
    db.delete(dept)
    db.commit()
    return {"ok": True}
