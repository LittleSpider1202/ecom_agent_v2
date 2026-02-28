from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
from auth import require_current_user
from models import AISuggestion, TaskInstance, Flow, User

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


def suggestion_to_dict(s: AISuggestion) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "summary": s.summary,
        "content": s.content,
        "category": s.category,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("")
async def list_suggestions(
    status: str = Query(default="pending"),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """列出所有 AI 决策建议（按状态筛选）"""
    # Seed sample suggestions if empty
    if db.query(AISuggestion).count() == 0:
        samples = [
            AISuggestion(
                title="建议优化采购周期，减少库存积压",
                summary="过去30天，库存周转率下降了15%，建议将采购频次从月度改为双周，减少一次性采购量，降低库存风险。",
                content="## 分析背景\n\n根据近期销售数据分析，库存周转率从历史均值4.2降至3.6，库存占用成本增加。\n\n## 建议措施\n\n1. 将采购周期从30天缩短为15天\n2. 减少单次采购量约30%\n3. 建立安全库存预警机制\n\n## 预期效果\n\n预计可将库存成本降低20%，同时保持服务水平不变。",
                category="库存管理",
                status="pending",
            ),
            AISuggestion(
                title="旺季来临，建议调整动态定价策略",
                summary="预测下月销售量将增加25%，建议对热销品类适当上调价格3-8%，提升毛利率。",
                content="## 市场预测\n\n基于历史季节性数据和当前搜索趋势，预测下月销售量将增长25%。\n\n## 定价建议\n\n| 品类 | 当前价格指数 | 建议调整 |\n|------|-------------|----------|\n| 3C产品 | 100 | +5% |\n| 家居用品 | 100 | +3% |\n| 服装 | 100 | +8% |\n\n## 注意事项\n\n调价前需评估竞争对手动态，避免价格敏感品类涨幅过大。",
                category="定价策略",
                status="pending",
            ),
            AISuggestion(
                title="供应商A连续3次延期，建议启动备选方案",
                summary="供应商A在过去60天有3次交货延期，影响了2个重点流程，建议启动备选供应商评估流程。",
                content="风险评估：供应商A近期延期3次（60天内），平均延期5.2天，影响采购审核和入库验收流程。建议：1.与供应商A沟通延期原因 2.启动备选供应商评估 3.调整采购计划增加提前量。采纳后将自动触发供应商评估标准流程。",
                category="供应商管理",
                status="pending",
            ),
        ]
        db.add_all(samples)
        db.commit()

    if status == "all":
        items = db.query(AISuggestion).order_by(AISuggestion.created_at.desc()).all()
    elif status == "history":
        items = (
            db.query(AISuggestion)
            .filter(AISuggestion.status.in_(["accepted", "ignored"]))
            .order_by(AISuggestion.created_at.desc())
            .all()
        )
    else:
        items = (
            db.query(AISuggestion)
            .filter(AISuggestion.status == status)
            .order_by(AISuggestion.created_at.desc())
            .all()
        )

    return [suggestion_to_dict(s) for s in items]


@router.get("/{suggestion_id}")
async def get_suggestion(
    suggestion_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(AISuggestion).filter(AISuggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="建议不存在")
    return suggestion_to_dict(s)


@router.post("/{suggestion_id}/accept")
async def accept_suggestion(
    suggestion_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """采纳建议：标记为已采纳，并触发对应流程实例"""
    s = db.query(AISuggestion).filter(AISuggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="建议不存在")
    if s.status != "pending":
        raise HTTPException(status_code=400, detail="该建议已处理")

    s.status = "accepted"

    # Trigger a task instance for this suggestion
    # Try to find a matching flow, otherwise create a generic task
    flow = db.query(Flow).filter(Flow.status == "active").first()
    task = TaskInstance(
        title=f"[AI建议] {s.title}",
        flow_name=flow.name if flow else "AI建议触发流程",
        status="running",
        has_human_step=True,
        assigned_to=current_user.id,
        current_step="等待人工审核",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "message": f"建议已采纳，流程已触发",
        "suggestion_id": suggestion_id,
        "task_id": task.id,
        "task_title": task.title,
    }


@router.post("/{suggestion_id}/ignore")
async def ignore_suggestion(
    suggestion_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """忽略建议：从活跃列表移除"""
    s = db.query(AISuggestion).filter(AISuggestion.id == suggestion_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="建议不存在")
    if s.status != "pending":
        raise HTTPException(status_code=400, detail="该建议已处理")

    s.status = "ignored"
    db.commit()

    return {"message": "建议已忽略", "suggestion_id": suggestion_id}
