from fastapi import APIRouter, Depends, Query
from auth import require_current_user
from models import User
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/api/bot", tags=["bot"])

# In-memory notification log (simulates Feishu Bot push)
_notifications: list[dict] = []
_next_id = 1


def add_bot_notification(
    type: str,
    title: str,
    content: str,
    task_id: Optional[int] = None,
    step_id: Optional[int] = None,
    target_user: str = "manager",
    background_info: Optional[str] = None,
    ai_suggestion: Optional[str] = None,
):
    """Add a simulated bot notification (called from other routers)"""
    global _next_id
    _notifications.insert(0, {
        "id": _next_id,
        "type": type,
        "title": title,
        "content": content,
        "task_id": task_id,
        "step_id": step_id,
        "target_user": target_user,
        "background_info": background_info,
        "ai_suggestion": ai_suggestion,
        "card_processed": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False,
    })
    _next_id += 1
    # Keep only last 100 notifications
    if len(_notifications) > 100:
        _notifications.pop()


def _ensure_seed_notifications():
    """Seed sample notifications if empty"""
    if not _notifications:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        samples = [
            {
                "id": 1,
                "type": "task_start",
                "title": "任务启动通知",
                "content": "任务「双十一商品上架流程」已启动，负责人：李执行，开始时间：" + now.strftime("%Y-%m-%d %H:%M"),
                "task_id": 1,
                "step_id": None,
                "target_user": "executor",
                "timestamp": (now - timedelta(hours=2)).isoformat(),
                "read": False,
            },
            {
                "id": 2,
                "type": "human_step",
                "title": "人工确认请求",
                "content": "任务「双十一备货采购清单审核」需要您的人工确认，请查看AI建议后决策。",
                "task_id": 1,
                "step_id": 1,
                "target_user": "executor",
                "background_info": "AI已完成竞品价格分析，识别出15款热销商品需要补货。当前库存预警：手机壳（剩余32件）、充电宝（剩余18件）、蓝牙耳机（剩余5件）。",
                "ai_suggestion": "建议采购：手机壳A款500件、充电宝20000mAh 300件、蓝牙耳机Pro版200件。总金额约¥156,000，在Q4预算范围内。",
                "card_processed": False,
                "timestamp": (now - timedelta(hours=1)).isoformat(),
                "read": False,
            },
            {
                "id": 3,
                "type": "task_alert",
                "title": "任务异常告警",
                "content": "任务「库存盘点报告生成」执行超时，请及时处理。任务ID: 3",
                "task_id": 3,
                "step_id": None,
                "target_user": "manager",
                "timestamp": (now - timedelta(minutes=30)).isoformat(),
                "read": False,
            },
            {
                "id": 4,
                "type": "ai_suggestion",
                "title": "AI决策建议",
                "content": "AI系统生成了新的决策建议：「建议优化采购周期，减少库存积压」，请查看并决策。",
                "task_id": None,
                "step_id": None,
                "target_user": "manager",
                "timestamp": (now - timedelta(minutes=15)).isoformat(),
                "read": False,
            },
            {
                "id": 5,
                "type": "daily_report",
                "title": "日报摘要",
                "content": f"今日（{now.strftime('%Y-%m-%d')}）运营日报：完成任务5个，进行中3个，健康度85%。",
                "task_id": None,
                "step_id": None,
                "target_user": "manager",
                "timestamp": (now - timedelta(minutes=5)).isoformat(),
                "read": False,
            },
        ]
        _notifications.extend(samples)
        global _next_id
        _next_id = 6


@router.get("/notifications")
async def list_notifications(
    type: Optional[str] = Query(default=None),
    current_user: User = Depends(require_current_user),
):
    """List simulated bot notifications"""
    _ensure_seed_notifications()
    result = list(_notifications)
    if type:
        result = [n for n in result if n["type"] == type]
    return {
        "total": len(result),
        "notifications": result[:50],
    }


@router.post("/trigger-daily-report")
async def trigger_daily_report(
    current_user: User = Depends(require_current_user),
):
    """Manually trigger a daily report notification"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    add_bot_notification(
        type="daily_report",
        title="日报摘要",
        content=f"今日（{now.strftime('%Y-%m-%d')}）运营日报：完成任务5个，进行中3个，告警1个，整体健康度82%。",
        target_user=current_user.username,
    )
    return {"message": "日报已推送", "type": "daily_report"}


@router.post("/trigger-ai-suggestion")
async def trigger_ai_suggestion(
    current_user: User = Depends(require_current_user),
):
    """Manually trigger an AI suggestion notification"""
    add_bot_notification(
        type="ai_suggestion",
        title="AI决策建议",
        content="AI系统发现新机会：旺季来临，建议调整动态定价策略，预期提升毛利率3-5%。",
        target_user=current_user.username,
    )
    return {"message": "AI建议已推送", "type": "ai_suggestion"}


def mark_notification_processed(task_id: int, step_id: int):
    """Mark human_step notifications for a given task/step as card_processed=True"""
    for n in _notifications:
        if n.get("type") == "human_step" and n.get("task_id") == task_id and n.get("step_id") == step_id:
            n["card_processed"] = True


@router.post("/notifications/{notification_id}/process")
async def process_notification(
    notification_id: int,
    current_user: User = Depends(require_current_user),
):
    """Mark a notification's card as processed"""
    for n in _notifications:
        if n["id"] == notification_id:
            n["card_processed"] = True
            return {"success": True}
    return {"success": False, "detail": "not found"}
