from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from database import get_db
from auth import require_current_user
from models import TaskInstance, User

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def task_to_dict(t: TaskInstance) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "flow_name": t.flow_name,
        "status": t.status,
        "current_step": t.current_step,
        "has_human_step": t.has_human_step,
        "assigned_to": t.assigned_to,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/my")
async def get_my_tasks(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """看板：当前用户的待办和进行中任务"""
    pending = (
        db.query(TaskInstance)
        .filter(TaskInstance.assigned_to == current_user.id, TaskInstance.status == "pending")
        .order_by(TaskInstance.due_date.asc().nullslast())
        .all()
    )
    running = (
        db.query(TaskInstance)
        .filter(TaskInstance.assigned_to == current_user.id, TaskInstance.status == "running")
        .order_by(TaskInstance.updated_at.desc())
        .all()
    )
    return {
        "pending": [task_to_dict(t) for t in pending],
        "running": [task_to_dict(t) for t in running],
        "pending_count": len(pending),
        "running_count": len(running),
    }


@router.get("")
async def list_tasks(
    status: Optional[str] = Query(None, description="pending|running|completed|failed"),
    search: Optional[str] = Query(None, description="按标题搜索"),
    sort: Optional[str] = Query("created_at_desc", description="created_at_asc|created_at_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """任务列表：分页+筛选+搜索+排序"""
    query = db.query(TaskInstance).filter(TaskInstance.assigned_to == current_user.id)

    if status:
        query = query.filter(TaskInstance.status == status)

    if search:
        query = query.filter(
            or_(
                TaskInstance.title.ilike(f"%{search}%"),
                TaskInstance.flow_name.ilike(f"%{search}%"),
            )
        )

    if sort == "created_at_asc":
        query = query.order_by(TaskInstance.created_at.asc())
    else:
        query = query.order_by(TaskInstance.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [task_to_dict(t) for t in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{task_id}")
async def get_task(
    task_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(TaskInstance).filter(TaskInstance.id == task_id).first()
    if not task:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return task_to_dict(task)
