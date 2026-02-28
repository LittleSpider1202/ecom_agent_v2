from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Flow, FlowVersion, TaskInstance, TaskStep, TaskDagNode
from auth import require_current_user
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, timezone
from routers.bot import add_bot_notification

router = APIRouter(prefix="/api/flows", tags=["flows"])


class FlowSaveRequest(BaseModel):
    name: str
    nodes: list[Any] = []
    edges: list[Any] = []
    trigger_type: Optional[str] = None
    trigger_config: Optional[str] = None


class GenerateRequest(BaseModel):
    prompt: str


def _compute_health(db: Session, flow_name: str) -> dict:
    """Compute success_rate (0-100) and avg_duration (minutes) for a flow."""
    tasks = db.query(TaskInstance).filter(TaskInstance.flow_name == flow_name).all()
    total = len(tasks)
    if total == 0:
        return {"success_rate": None, "avg_duration": None}
    completed = [t for t in tasks if t.status == "completed"]
    success_rate = round(len(completed) / total * 100)
    durations = [
        (t.completed_at - t.created_at).total_seconds() / 60
        for t in completed
        if t.completed_at and t.created_at
    ]
    avg_duration = round(sum(durations) / len(durations)) if durations else None
    return {"success_rate": success_rate, "avg_duration": avg_duration}


@router.post("/generate")
def generate_flow(req: GenerateRequest, user=Depends(require_current_user)):
    """Mock AI: natural language → DAG nodes + edges."""
    nodes = [
        {
            "id": "gen-1",
            "type": "auto",
            "position": {"x": 200, "y": 80},
            "data": {"label": "采集竞品数据", "nodeType": "auto", "config": {"url": "", "method": "GET", "params": ""}},
        },
        {
            "id": "gen-2",
            "type": "condition",
            "position": {"x": 200, "y": 220},
            "data": {"label": "检测异常", "nodeType": "condition", "config": {"expression": ""}},
        },
        {
            "id": "gen-3",
            "type": "human",
            "position": {"x": 200, "y": 360},
            "data": {"label": "通知老板确认", "nodeType": "human", "config": {"role": "manager", "instructions": "", "timeout": 24}},
        },
    ]
    edges = [
        {"id": "e1-2", "source": "gen-1", "target": "gen-2", "type": "smoothstep", "markerEnd": {"type": "arrowclosed"}},
        {"id": "e2-3", "source": "gen-2", "target": "gen-3", "type": "smoothstep", "markerEnd": {"type": "arrowclosed"}},
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("")
def list_flows(search: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_current_user)):
    query = db.query(Flow)
    if search:
        query = query.filter(Flow.name.ilike(f"%{search}%"))
    flows = query.order_by(Flow.id.desc()).all()
    result = []
    for f in flows:
        health = _compute_health(db, f.name)
        result.append({
            "id": f.id, "name": f.name, "version": f.version,
            "status": f.status, "trigger_type": f.trigger_type,
            "is_enabled": f.status != "inactive",
            "success_rate": health["success_rate"],
            "avg_duration": health["avg_duration"],
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return result


@router.post("")
def create_flow(req: FlowSaveRequest, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = Flow(
        name=req.name,
        nodes=req.nodes,
        edges=req.edges,
        trigger_type=req.trigger_type,
        trigger_config=req.trigger_config,
        version=1,
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    # Save initial version
    fv = FlowVersion(flow_id=flow.id, version=1, nodes=req.nodes, edges=req.edges)
    db.add(fv)
    db.commit()
    return {
        "id": flow.id, "name": flow.name, "nodes": flow.nodes, "edges": flow.edges,
        "version": flow.version, "trigger_type": flow.trigger_type, "trigger_config": flow.trigger_config,
    }


@router.get("/{flow_id}")
def get_flow(flow_id: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return {
        "id": flow.id, "name": flow.name, "nodes": flow.nodes, "edges": flow.edges,
        "version": flow.version, "trigger_type": flow.trigger_type, "trigger_config": flow.trigger_config,
    }


@router.put("/{flow_id}")
def update_flow(flow_id: int, req: FlowSaveRequest, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    flow.nodes = req.nodes
    flow.edges = req.edges
    flow.name = req.name
    flow.trigger_type = req.trigger_type
    flow.trigger_config = req.trigger_config
    flow.version = flow.version + 1
    db.commit()
    fv = FlowVersion(flow_id=flow.id, version=flow.version, nodes=req.nodes, edges=req.edges)
    db.add(fv)
    db.commit()
    db.refresh(flow)
    return {
        "id": flow.id, "name": flow.name, "nodes": flow.nodes, "edges": flow.edges,
        "version": flow.version, "trigger_type": flow.trigger_type, "trigger_config": flow.trigger_config,
    }


@router.get("/{flow_id}/versions")
def get_versions(flow_id: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    versions = (
        db.query(FlowVersion)
        .filter(FlowVersion.flow_id == flow_id)
        .order_by(FlowVersion.version)
        .all()
    )
    return [
        {"id": v.id, "version": v.version, "created_at": v.created_at.isoformat() if v.created_at else None}
        for v in versions
    ]


@router.get("/{flow_id}/versions/{version_num}")
def get_version_detail(flow_id: int, version_num: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    v = db.query(FlowVersion).filter(FlowVersion.flow_id == flow_id, FlowVersion.version == version_num).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return {
        "id": v.id,
        "version": v.version,
        "nodes": v.nodes,
        "edges": v.edges,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


@router.post("/{flow_id}/versions/{version_num}/rollback")
def rollback_version(flow_id: int, version_num: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    target = db.query(FlowVersion).filter(FlowVersion.flow_id == flow_id, FlowVersion.version == version_num).first()
    if not target:
        raise HTTPException(status_code=404, detail="Version not found")

    # Create new version as rollback copy
    new_version_num = flow.version + 1
    fv = FlowVersion(flow_id=flow_id, version=new_version_num, nodes=target.nodes, edges=target.edges)
    db.add(fv)
    flow.version = new_version_num
    db.commit()
    db.refresh(flow)
    return {
        "new_version": new_version_num,
        "rolled_back_from": version_num,
        "flow_id": flow_id,
    }


@router.patch("/{flow_id}/toggle")
def toggle_flow(flow_id: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    flow.status = "inactive" if flow.status != "inactive" else "active"
    db.commit()
    db.refresh(flow)
    return {"id": flow.id, "status": flow.status, "is_enabled": flow.status != "inactive"}


class TriggerFlowRequest(BaseModel):
    input: dict = {}


@router.post("/{flow_id}/trigger")
def trigger_flow(
    flow_id: int,
    body: TriggerFlowRequest = None,
    db: Session = Depends(get_db),
    user=Depends(require_current_user),
):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    input_data = (body.input if body else {}) or {}
    nodes = flow.nodes or []
    edges = flow.edges or []

    def get_node_type(n: dict) -> str:
        return n.get("type") or n.get("data", {}).get("nodeType", "auto")

    has_human = any(get_node_type(n) == "human" for n in nodes)

    task = TaskInstance(
        title=f"[手动触发] {flow.name}",
        flow_name=flow.name,
        status="running",
        has_human_step=has_human,
        assigned_to=user.id,
    )
    db.add(task)
    db.flush()  # get task.id

    # Build a map of node_id → node for condition resolution
    node_map = {n.get("id", ""): n for n in nodes}

    # Evaluate condition nodes to decide which branch nodes are active
    skipped_ids: set = set()
    for n in nodes:
        if get_node_type(n) != "condition":
            continue
        condition_expr = n.get("data", {}).get("condition", "") or "True"
        try:
            # Safe substitution: replace input.key with value
            expr = condition_expr
            for k, v in input_data.items():
                expr = expr.replace(f"input.{k}", str(v))
            result = bool(eval(expr, {"__builtins__": {}}, {}))  # noqa: S307
        except Exception:
            result = True

        nid = n.get("id", "")
        true_targets = [e["target"] for e in edges if e.get("source") == nid and e.get("sourceHandle") == "true"]
        false_targets = [e["target"] for e in edges if e.get("source") == nid and e.get("sourceHandle") == "false"]
        # Mark inactive branch as skipped
        skip_targets = false_targets if result else true_targets
        skipped_ids.update(skip_targets)

    # Create TaskDagNode for each node
    for n in nodes:
        nid = n.get("id", "")
        node_type = get_node_type(n)
        label = n.get("data", {}).get("label", "节点")
        pos = n.get("position", {})
        src_keys = [e["source"] for e in edges if e.get("target") == nid]

        if nid in skipped_ids:
            status = "skipped"
        elif node_type == "human":
            status = "pending"
        else:
            status = "completed"

        dag_node = TaskDagNode(
            task_id=task.id,
            node_key=nid,
            label=label,
            node_type=node_type,
            status=status,
            pos_x=int(pos.get("x", 0)),
            pos_y=int(pos.get("y", 0)),
            source_keys=src_keys,
            started_at=datetime.now(timezone.utc) if status == "completed" else None,
            finished_at=datetime.now(timezone.utc) if status == "completed" else None,
        )
        db.add(dag_node)

        # Create TaskStep for human nodes
        if node_type == "human" and nid not in skipped_ids:
            step_name = label or "人工确认"
            ai_suggestion = n.get("data", {}).get("config", {}).get("ai_suggestion", "")
            db.add(TaskStep(
                task_id=task.id,
                step_name=step_name,
                instructions=n.get("data", {}).get("config", {}).get("instructions", ""),
                ai_suggestion=ai_suggestion,
                status="pending",
            ))

    if not has_human:
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(task)

    # Bot notifications
    add_bot_notification(
        type="task_start",
        title="任务启动通知",
        content=f"流程「{flow.name}」已手动触发，任务已创建",
        task_id=task.id,
        target_user="manager",
    )
    if has_human:
        add_bot_notification(
            type="human_step",
            title="人工确认请求",
            content=f"任务「{flow.name}」到达人工节点，请相关负责人确认",
            task_id=task.id,
            target_user="executor",
        )

    return {"message": "触发成功", "task_id": task.id}
