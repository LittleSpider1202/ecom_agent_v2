from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import os

from database import get_db
from models import Tool, ToolExecution, User
from auth import require_current_user as get_current_user

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("")
def list_tools(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List tools the current user has access to."""
    tools = db.query(Tool).filter(Tool.enabled == True).all()
    result = []
    for t in tools:
        roles = [r.strip() for r in t.allowed_roles.split(",")]
        if current_user.role in roles:
            result.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "tool_type": t.tool_type,
                "call_count": t.call_count,
                "allowed_roles": roles,
            })
    return result


@router.get("/all")
def list_all_tools(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all tools regardless of permission (manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager only")
    tools = db.query(Tool).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "tool_type": t.tool_type,
            "enabled": t.enabled,
            "call_count": t.call_count,
            "allowed_roles": [r.strip() for r in t.allowed_roles.split(",")],
        }
        for t in tools
    ]


@router.post("/{tool_id}/execute")
def execute_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a tool execution."""
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    roles = [r.strip() for r in tool.allowed_roles.split(",")]
    if current_user.role not in roles:
        raise HTTPException(status_code=403, detail="No permission to execute this tool")

    if not tool.enabled:
        raise HTTPException(status_code=400, detail="Tool is disabled")

    # Simulate execution (instant mock)
    logs = [
        f"[{datetime.now(timezone.utc).isoformat()}] 开始执行工具: {tool.name}",
        f"[{datetime.now(timezone.utc).isoformat()}] 初始化参数...",
        f"[{datetime.now(timezone.utc).isoformat()}] 执行中...",
        f"[{datetime.now(timezone.utc).isoformat()}] 执行完成",
    ]

    output_file = None
    if tool.tool_type == "script":
        output_file = f"/tmp/tool_{tool_id}_output.xlsx"

    execution = ToolExecution(
        tool_id=tool_id,
        triggered_by=current_user.id,
        status="success",
        logs="\n".join(logs),
        output_file=output_file,
        finished_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    tool.call_count += 1
    db.commit()
    db.refresh(execution)

    return {
        "id": execution.id,
        "tool_id": tool_id,
        "tool_name": tool.name,
        "status": execution.status,
        "started_at": execution.started_at.isoformat(),
    }


@router.get("/executions/{execution_id}")
def get_execution(
    execution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get tool execution details."""
    execution = db.query(ToolExecution).filter(ToolExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    tool = db.query(Tool).filter(Tool.id == execution.tool_id).first()

    return {
        "id": execution.id,
        "tool_id": execution.tool_id,
        "tool_name": tool.name if tool else "未知工具",
        "status": execution.status,
        "logs": execution.logs or "",
        "output_file": execution.output_file,
        "has_output": bool(execution.output_file),
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "finished_at": execution.finished_at.isoformat() if execution.finished_at else None,
    }


@router.get("/executions/{execution_id}/download")
def download_output(
    execution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the output file of an execution."""
    execution = db.query(ToolExecution).filter(ToolExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if not execution.output_file:
        raise HTTPException(status_code=404, detail="No output file")

    # Create a mock Excel file for testing
    mock_path = f"/tmp/tool_output_{execution_id}.xlsx"
    if not os.path.exists(mock_path):
        with open(mock_path, "wb") as f:
            # Minimal XLSX-like content for test purposes
            f.write(b"PK\x03\x04" + b"\x00" * 26 + b"mock_xlsx_content")

    return FileResponse(
        path=mock_path,
        filename=f"output_{execution_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
