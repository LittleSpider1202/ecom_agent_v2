from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from database import get_db
from models import KnowledgeEntry, KnowledgeSubmission, User
from auth import require_current_user

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# ── List / Search ────────────────────────────────────────────────────────────

@router.get("")
def list_knowledge(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    q = db.query(KnowledgeEntry).filter(KnowledgeEntry.status == "active")
    if category:
        q = q.filter(KnowledgeEntry.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(
            KnowledgeEntry.title.ilike(like) | KnowledgeEntry.content.ilike(like)
        )
    entries = q.order_by(KnowledgeEntry.view_count.desc()).all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "category": e.category,
            "version": e.version,
            "view_count": e.view_count,
            "helpful_count": e.helpful_count,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entries
    ]


# ── AI Q&A (mock) ─────────────────────────────────────────────────────────────

@router.post("/ask")
def ask_knowledge(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    question = body.get("question", "")
    # Mock AI response: find related entries
    words = [w for w in question.replace("？", "").replace("?", "").split() if len(w) > 1]
    related = []
    for word in words:
        like = f"%{word}%"
        hits = (
            db.query(KnowledgeEntry)
            .filter(
                KnowledgeEntry.status == "active",
                KnowledgeEntry.title.ilike(like) | KnowledgeEntry.content.ilike(like),
            )
            .limit(3)
            .all()
        )
        for h in hits:
            if not any(r["id"] == h.id for r in related):
                related.append({"id": h.id, "title": h.title, "category": h.category})
    if not related:
        # Fallback: return first 2 entries
        entries = db.query(KnowledgeEntry).filter(KnowledgeEntry.status == "active").limit(2).all()
        related = [{"id": e.id, "title": e.title, "category": e.category} for e in entries]

    answer = (
        f"根据知识库相关内容，针对您的问题「{question}」，以下是AI整理的回答：\n\n"
        "请参阅相关词条获取详细操作规范。如需进一步了解，可点击下方引用词条查看完整内容。"
    )
    return {"answer": answer, "references": related[:3]}


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/my-submissions")
def my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    subs = (
        db.query(KnowledgeSubmission)
        .filter(KnowledgeSubmission.submitter_id == current_user.id)
        .order_by(KnowledgeSubmission.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "type": s.type,
            "title": s.title,
            "category": s.category,
            "status": s.status,
            "entry_id": s.entry_id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in subs
    ]


@router.get("/{entry_id}")
def get_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    entry = db.query(KnowledgeEntry).filter(KnowledgeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    # Increment view count
    entry.view_count = entry.view_count + 1
    db.commit()
    db.refresh(entry)
    return {
        "id": entry.id,
        "title": entry.title,
        "content": entry.content,
        "category": entry.category,
        "version": entry.version,
        "view_count": entry.view_count,
        "helpful_count": entry.helpful_count,
        "status": entry.status,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


@router.post("/{entry_id}/helpful")
def mark_helpful(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    entry = db.query(KnowledgeEntry).filter(KnowledgeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    entry.helpful_count = entry.helpful_count + 1
    db.commit()
    db.refresh(entry)
    return {"helpful_count": entry.helpful_count}


# ── Manager: List all pending submissions ─────────────────────────────────────

@router.get("/submissions/pending")
def list_pending_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    """管理员查看所有待审核的知识贡献"""
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="无权限")
    subs = (
        db.query(KnowledgeSubmission)
        .filter(KnowledgeSubmission.status == "pending")
        .order_by(KnowledgeSubmission.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "type": s.type,
            "title": s.title,
            "content": s.content,
            "category": s.category,
            "status": s.status,
            "submitter_id": s.submitter_id,
            "entry_id": s.entry_id,
            "correction_reason": s.correction_reason,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in subs
    ]


@router.post("/submissions/{sub_id}/approve")
def approve_submission(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    """管理员批准知识贡献，自动创建/更新知识词条"""
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="无权限")
    sub = db.query(KnowledgeSubmission).filter(KnowledgeSubmission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="投稿不存在")
    if sub.status != "pending":
        raise HTTPException(status_code=400, detail="该投稿已处理")

    if sub.type == "new":
        entry = KnowledgeEntry(
            title=sub.title or "未命名词条",
            content=sub.content,
            category=sub.category or "运营规则",
            status="active",
        )
        db.add(entry)
        db.flush()
        sub.entry_id = entry.id
    elif sub.type == "correction" and sub.entry_id:
        entry = db.query(KnowledgeEntry).filter(KnowledgeEntry.id == sub.entry_id).first()
        if entry:
            entry.content = sub.content
            entry.updated_at = datetime.utcnow()

    sub.status = "approved"
    db.commit()
    return {"message": "审核通过，词条已发布", "status": "approved", "entry_id": sub.entry_id}


@router.post("/submissions/{sub_id}/reject")
def reject_submission(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    """管理员驳回知识贡献"""
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="无权限")
    sub = db.query(KnowledgeSubmission).filter(KnowledgeSubmission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="投稿不存在")
    if sub.status != "pending":
        raise HTTPException(status_code=400, detail="该投稿已处理")
    sub.status = "rejected"
    db.commit()
    return {"message": "已驳回", "status": "rejected"}


# ── Submissions ───────────────────────────────────────────────────────────────

@router.post("/submissions")
def submit_knowledge(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    sub = KnowledgeSubmission(
        submitter_id=current_user.id,
        type=body.get("type", "new"),
        entry_id=body.get("entry_id"),
        title=body.get("title"),
        content=body.get("content", ""),
        category=body.get("category"),
        correction_reason=body.get("correction_reason"),
        status="pending",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {
        "id": sub.id,
        "status": sub.status,
        "message": "提交成功，等待管理员审核",
    }
