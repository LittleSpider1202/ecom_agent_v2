from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Flow, FlowVersion, TaskInstance
from auth import require_current_user
from pydantic import BaseModel
from typing import Optional, Any

router = APIRouter(prefix="/api/flows", tags=["flows"])


class FlowSaveRequest(BaseModel):
    name: str
    nodes: list[Any] = []
    edges: list[Any] = []
    trigger_type: Optional[str] = None
    trigger_config: Optional[str] = None


class GenerateRequest(BaseModel):
    prompt: str


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
def list_flows(db: Session = Depends(get_db), user=Depends(require_current_user)):
    flows = db.query(Flow).order_by(Flow.id.desc()).all()
    return [
        {
            "id": f.id, "name": f.name, "version": f.version,
            "status": f.status, "trigger_type": f.trigger_type,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in flows
    ]


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


@router.post("/{flow_id}/trigger")
def trigger_flow(flow_id: int, db: Session = Depends(get_db), user=Depends(require_current_user)):
    flow = db.query(Flow).filter(Flow.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    task = TaskInstance(
        title=f"[手动触发] {flow.name}",
        flow_name=flow.name,
        status="pending",
        has_human_step=False,
        assigned_to=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "触发成功", "task_id": task.id}
