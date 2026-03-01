from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone
from typing import Optional
from database import get_db
from auth import require_current_user
from models import User
import io, csv

router = APIRouter(prefix="/api/logs", tags=["logs"])

# In-memory system log store (for demo — no DB migration needed)
# In production this would be a DB table
_system_logs: list[dict] = []

LOG_TYPES = [
    "任务创建", "任务强制终止", "任务催办",
    "流程发布", "成员邀请", "角色变更",
    "建议采纳", "建议忽略", "平台配置",
]


def _ensure_seed_logs():
    if not _system_logs:
        import random
        from datetime import timedelta
        users = ["admin", "manager", "executor"]
        now = datetime.now(timezone.utc)
        for i in range(30):
            ts = now - timedelta(hours=i * 2 + random.randint(0, 3))
            _system_logs.append({
                "id": 30 - i,
                "user": users[i % 3],
                "action": LOG_TYPES[i % len(LOG_TYPES)],
                "detail": f"系统操作记录 #{30-i}：{LOG_TYPES[i % len(LOG_TYPES)]}",
                "timestamp": ts.isoformat(),
            })


def add_log(user: str, action: str, detail: str = ""):
    """Add a system log entry (called from other routers)"""
    _system_logs.insert(0, {
        "id": len(_system_logs) + 1,
        "user": user,
        "action": action,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@router.get("")
async def list_logs(
    user_filter: Optional[str] = Query(default=None, alias="user"),
    action_filter: Optional[str] = Query(default=None, alias="action"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(require_current_user),
):
    """返回系统操作日志（支持用户、类型、时间范围筛选）"""
    _ensure_seed_logs()
    logs = list(_system_logs)

    if user_filter:
        logs = [l for l in logs if l["user"] == user_filter]

    if action_filter:
        logs = [l for l in logs if l["action"] == action_filter]

    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            logs = [l for l in logs if datetime.fromisoformat(l["timestamp"]) >= sd]
        except ValueError:
            pass

    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            logs = [l for l in logs if datetime.fromisoformat(l["timestamp"]) <= ed]
        except ValueError:
            pass

    return {
        "total": len(logs),
        "logs": logs[:limit],
        "users": list(set(l["user"] for l in _system_logs)),
        "actions": LOG_TYPES,
    }


@router.get("/export")
async def export_logs(
    user_filter: Optional[str] = Query(default=None, alias="user"),
    action_filter: Optional[str] = Query(default=None, alias="action"),
    current_user: User = Depends(require_current_user),
):
    """导出日志为CSV"""
    _ensure_seed_logs()
    logs = list(_system_logs)

    if user_filter:
        logs = [l for l in logs if l["user"] == user_filter]
    if action_filter:
        logs = [l for l in logs if l["action"] == action_filter]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "user", "action", "detail", "timestamp"])
    writer.writeheader()
    writer.writerows(logs)

    content = output.getvalue()
    return StreamingResponse(
        iter([content.encode('utf-8-sig')]),  # BOM for Excel compatibility
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=system_logs.csv"},
    )
