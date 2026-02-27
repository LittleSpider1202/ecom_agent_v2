from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from database import get_db
from auth import require_current_user
from models import TaskInstance, TaskStep, User

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


@router.get("/monitor")
async def monitor_tasks(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """全局任务监控：返回所有任务实例（不过滤用户）"""
    tasks = (
        db.query(TaskInstance)
        .order_by(TaskInstance.created_at.desc())
        .limit(200)
        .all()
    )
    return [task_to_dict(t) for t in tasks]


@router.get("/{task_id}")
async def get_task(
    task_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(TaskInstance).filter(TaskInstance.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return task_to_dict(task)


# ── Step endpoints ────────────────────────────────────────────────────────────

class SubmitStepRequest(BaseModel):
    content: str
    mode: str  # "accept" | "modify"


class RejectStepRequest(BaseModel):
    reason: str


def step_to_dict(s: TaskStep) -> dict:
    return {
        "id": s.id,
        "task_id": s.task_id,
        "step_name": s.step_name,
        "background_info": s.background_info,
        "instructions": s.instructions,
        "ai_suggestion": s.ai_suggestion,
        "status": s.status,
        "final_content": s.final_content,
        "reject_reason": s.reject_reason,
        "completed_by": s.completed_by,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/{task_id}/steps/{step_id}")
async def get_step(
    task_id: int,
    step_id: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(TaskInstance).filter(TaskInstance.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if step_id == "current":
        step = (
            db.query(TaskStep)
            .filter(TaskStep.task_id == task_id, TaskStep.status == "pending")
            .first()
        )
    else:
        try:
            sid = int(step_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的步骤ID")
        step = db.query(TaskStep).filter(TaskStep.id == sid, TaskStep.task_id == task_id).first()

    if not step:
        raise HTTPException(status_code=404, detail="步骤不存在")
    return step_to_dict(step)


@router.post("/{task_id}/steps/{step_id}/submit")
async def submit_step(
    task_id: int,
    step_id: int,
    body: SubmitStepRequest,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    step = db.query(TaskStep).filter(TaskStep.id == step_id, TaskStep.task_id == task_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="步骤不存在")
    if step.status != "pending":
        raise HTTPException(status_code=400, detail="步骤已处理，不可重复提交")

    step.status = "completed"
    step.final_content = body.content
    step.completed_by = current_user.id
    step.completed_at = datetime.now(timezone.utc)

    # Check remaining pending steps
    remaining = (
        db.query(TaskStep)
        .filter(TaskStep.task_id == task_id, TaskStep.status == "pending", TaskStep.id != step_id)
        .count()
    )
    task = db.query(TaskInstance).filter(TaskInstance.id == task_id).first()
    if task and remaining == 0:
        task.has_human_step = False
        task.status = "completed"

    db.commit()
    return {"success": True, "message": "提交成功"}


@router.post("/{task_id}/steps/{step_id}/reject")
async def reject_step(
    task_id: int,
    step_id: int,
    body: RejectStepRequest,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    step = db.query(TaskStep).filter(TaskStep.id == step_id, TaskStep.task_id == task_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="步骤不存在")
    if step.status != "pending":
        raise HTTPException(status_code=400, detail="步骤已处理，不可重复驳回")

    step.status = "rejected"
    step.reject_reason = body.reason
    step.completed_by = current_user.id
    step.completed_at = datetime.now(timezone.utc)

    task = db.query(TaskInstance).filter(TaskInstance.id == task_id).first()
    if task:
        task.status = "rejected"
        task.has_human_step = False

    db.commit()
    return {"success": True, "message": "已驳回"}
