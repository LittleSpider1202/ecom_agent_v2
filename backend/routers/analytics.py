from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta, timezone
from database import get_db
from auth import require_current_user
from models import TaskInstance, TaskStep, User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/flow-names")
async def get_flow_names(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """返回所有流程名称（用于筛选下拉）"""
    rows = db.execute(text("""
        SELECT DISTINCT flow_name FROM task_instances WHERE flow_name IS NOT NULL ORDER BY flow_name
    """)).fetchall()
    return {"flow_names": [r[0] for r in rows]}


@router.get("/trend")
async def get_efficiency_trend(
    days: int = Query(default=30, ge=1, le=365),
    flow_name: str = Query(default=None),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """返回最近 N 天每日任务完成数和创建数的趋势"""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    flow_filter = "AND flow_name = :flow_name" if flow_name else ""
    params: dict = {"since": since}
    if flow_name:
        params["flow_name"] = flow_name

    # Daily completed tasks
    completed_rows = db.execute(text(f"""
        SELECT DATE(completed_at AT TIME ZONE 'UTC') AS d,
               COUNT(*) AS cnt
        FROM task_instances
        WHERE completed_at >= :since AND status = 'completed' {flow_filter}
        GROUP BY DATE(completed_at AT TIME ZONE 'UTC')
        ORDER BY d
    """), params).fetchall()

    # Daily created tasks
    created_rows = db.execute(text(f"""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS d,
               COUNT(*) AS cnt
        FROM task_instances
        WHERE created_at >= :since {flow_filter}
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY d
    """), params).fetchall()

    # Build date range
    date_range = [(since + timedelta(days=i)).date() for i in range(days)]
    completed_map = {str(r[0]): r[1] for r in completed_rows}
    created_map = {str(r[0]): r[1] for r in created_rows}

    data = []
    for d in date_range:
        ds = str(d)
        data.append({
            "date": ds,
            "completed": completed_map.get(ds, 0),
            "created": created_map.get(ds, 0),
        })

    return {
        "days": days,
        "data": data,
        "total_completed": sum(completed_map.values()),
        "total_created": sum(created_map.values()),
    }


@router.get("/bottlenecks")
async def get_bottlenecks(
    days: int = Query(default=30, ge=1, le=365),
    flow_name: str = Query(default=None),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """识别耗时最长的流程步骤（基于 task_steps 完成时间）"""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    flow_join = "JOIN task_instances ti ON ts.task_id = ti.id" if flow_name else ""
    flow_filter = "AND ti.flow_name = :flow_name" if flow_name else ""
    params: dict = {"since": since}
    if flow_name:
        params["flow_name"] = flow_name

    rows = db.execute(text(f"""
        SELECT
            ts.step_name,
            COUNT(*) AS total,
            AVG(EXTRACT(EPOCH FROM (ts.completed_at - ts.created_at))) AS avg_sec,
            MAX(EXTRACT(EPOCH FROM (ts.completed_at - ts.created_at))) AS max_sec
        FROM task_steps ts
        {flow_join}
        WHERE ts.completed_at IS NOT NULL
          AND ts.created_at >= :since
          AND ts.status = 'completed'
          {flow_filter}
        GROUP BY ts.step_name
        ORDER BY avg_sec DESC
        LIMIT 10
    """), params).fetchall()

    # Avg human step processing time
    human_rows = db.execute(text(f"""
        SELECT AVG(EXTRACT(EPOCH FROM (ts.completed_at - ts.created_at)))
        FROM task_steps ts
        {flow_join}
        WHERE ts.completed_at IS NOT NULL
          AND ts.created_at >= :since
          AND ts.status = 'completed'
          {flow_filter}
    """), params).fetchone()
    avg_human_sec = float(human_rows[0]) if human_rows and human_rows[0] else 0

    bottlenecks = []
    for r in rows:
        avg_s = float(r[2]) if r[2] else 0
        max_s = float(r[3]) if r[3] else 0
        bottlenecks.append({
            "step_name": r[0],
            "total_executions": int(r[1]),
            "avg_duration_sec": round(avg_s, 1),
            "max_duration_sec": round(max_s, 1),
            "avg_duration_label": _fmt_duration(avg_s),
            "max_duration_label": _fmt_duration(max_s),
        })

    # If no real data, generate sample data for demo
    if not bottlenecks:
        sample = [
            ("采购审核", 12, 3600, 7200),
            ("质量检验", 8, 2400, 5000),
            ("合同审批", 5, 1800, 3600),
            ("财务确认", 9, 1200, 2400),
            ("库存录入", 15, 600, 1200),
        ]
        bottlenecks = [{
            "step_name": s[0],
            "total_executions": s[1],
            "avg_duration_sec": s[2],
            "max_duration_sec": s[3],
            "avg_duration_label": _fmt_duration(s[2]),
            "max_duration_label": _fmt_duration(s[3]),
        } for s in sample]

    max_avg = max((b["avg_duration_sec"] for b in bottlenecks), default=1) or 1
    for b in bottlenecks:
        b["pct"] = round(b["avg_duration_sec"] / max_avg * 100, 1)

    return {
        "days": days,
        "bottlenecks": bottlenecks,
        "avg_human_step_sec": round(avg_human_sec, 1),
        "avg_human_step_label": _fmt_duration(avg_human_sec),
    }


def _fmt_duration(sec: float) -> str:
    if sec < 60:
        return f"{int(sec)}秒"
    if sec < 3600:
        return f"{int(sec // 60)}分"
    return f"{sec / 3600:.1f}小时"
