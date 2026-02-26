from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import TaskInstance, AISuggestion, User
from auth import require_current_user

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(TaskInstance).count()
    completed = db.query(TaskInstance).filter(TaskInstance.status == "completed").count()
    failed = db.query(TaskInstance).filter(TaskInstance.status == "failed").count()

    if total > 0:
        health_score = max(0, min(100, 75 + completed * 5 - failed * 5))
    else:
        health_score = 75

    suggestions = (
        db.query(AISuggestion)
        .order_by(AISuggestion.created_at.desc())
        .limit(5)
        .all()
    )

    active_tasks = (
        db.query(TaskInstance)
        .filter(TaskInstance.status.in_(["pending", "running"]))
        .order_by(TaskInstance.created_at.desc())
        .all()
    )

    return {
        "health_score": health_score,
        "ai_suggestions": [
            {
                "id": s.id,
                "title": s.title,
                "summary": s.summary,
                "category": s.category,
                "status": s.status,
            }
            for s in suggestions
        ],
        "active_tasks": {
            "total": len(active_tasks),
            "running": sum(1 for t in active_tasks if t.status == "running"),
            "pending": sum(1 for t in active_tasks if t.status == "pending"),
            "items": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "current_step": t.current_step,
                    "flow_name": t.flow_name,
                }
                for t in active_tasks[:5]
            ],
        },
    }


@router.get("/api/suggestions/{suggestion_id}")
def get_suggestion(
    suggestion_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(AISuggestion).filter(AISuggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="建议不存在")
    return {
        "id": s.id,
        "title": s.title,
        "summary": s.summary,
        "content": s.content,
        "category": s.category,
        "status": s.status,
    }
