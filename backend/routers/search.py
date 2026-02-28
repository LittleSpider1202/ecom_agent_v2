from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import TaskInstance, Flow, KnowledgeEntry
from auth import require_current_user

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def global_search(
    q: str = Query(..., min_length=1),
    current_user=Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """全局搜索：搜索任务、流程、知识词条"""
    pattern = f"%{q}%"
    results = []

    tasks = (
        db.query(TaskInstance)
        .filter(TaskInstance.title.ilike(pattern))
        .limit(5)
        .all()
    )
    for t in tasks:
        results.append({
            "type": "task",
            "id": t.id,
            "title": t.title,
            "subtitle": t.flow_name or "",
            "url": f"/executor/tasks/{t.id}",
        })

    flows = (
        db.query(Flow)
        .filter(Flow.name.ilike(pattern))
        .limit(5)
        .all()
    )
    for f in flows:
        results.append({
            "type": "flow",
            "id": f.id,
            "title": f.name,
            "subtitle": f.description or "",
            "url": f"/manage/flows/{f.id}",
        })

    knowledge = (
        db.query(KnowledgeEntry)
        .filter(KnowledgeEntry.title.ilike(pattern))
        .limit(5)
        .all()
    )
    for k in knowledge:
        results.append({
            "type": "knowledge",
            "id": k.id,
            "title": k.title,
            "subtitle": k.category or "",
            "url": f"/executor/knowledge/{k.id}",
        })

    return {"results": results, "total": len(results), "query": q}
