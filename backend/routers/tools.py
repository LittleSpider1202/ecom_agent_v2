from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List, Any
import os

from database import get_db
from models import Tool, ToolExecution, User
from auth import require_current_user as get_current_user

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    tool_type: str = "api"
    allowed_roles: List[str] = ["executor", "manager"]
    config: Optional[Any] = None
    params: Optional[List[Any]] = None


class ToolUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tool_type: Optional[str] = None
    allowed_roles: Optional[List[str]] = None
    config: Optional[Any] = None
    params: Optional[List[Any]] = None


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

    # Simulate execution with tool-specific output
    now = datetime.now(timezone.utc).isoformat()
    logs = [f"[{now}] 开始执行工具: {tool.name}", f"[{now}] 初始化参数..."]

    # Check for Python script in config
    config = tool.config or {}
    script_code = config.get("script", "") if isinstance(config, dict) else ""

    if script_code:
        logs.append(f"[{now}] 执行Python脚本...")
        # Simulate script output by running in restricted scope
        import io, contextlib
        output_buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(output_buf):
                exec(script_code, {"__builtins__": {"print": print, "range": range, "len": len}})  # noqa: S102
            script_out = output_buf.getvalue().strip()
            if script_out:
                for line in script_out.splitlines():
                    logs.append(f"[{now}] {line}")
        except Exception as e:
            logs.append(f"[{now}] 脚本输出: {str(e)}")
        logs.append(f"[{now}] 脚本执行完成")
    elif "ERP" in tool.name or "库存" in tool.name:
        logs.append(f"[{now}] 查询ERP系统...")
        logs.append(f"[{now}] SKU: A001 库存: 342件 仓位: A区-3排-5列")
        logs.append(f"[{now}] SKU: B002 库存: 128件 仓位: B区-1排-2列")
        logs.append(f"[{now}] 共查询到2条库存记录")
    elif "生意参谋" in tool.name or "竞品" in tool.name or "采集" in tool.name:
        logs.append(f"[{now}] 连接生意参谋API...")
        logs.append(f"[{now}] 采集行业大盘数据: 日销售额 ¥2,345,678")
        logs.append(f"[{now}] 采集竞品数据: 共12个竞品店铺")
        logs.append(f"[{now}] 数据写入数据库完成")
    elif "发货" in tool.name or "导出" in tool.name:
        logs.append(f"[{now}] 查询待发货订单...")
        logs.append(f"[{now}] 共找到 156 条待发货订单")
        logs.append(f"[{now}] 生成Excel文件: 发货单_20260228.xlsx")
    else:
        logs.append(f"[{now}] 执行中...")

    logs.append(f"[{now}] 执行完成")

    output_file = None
    if tool.tool_type == "script" or "导出" in tool.name or "发货" in tool.name:
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


@router.patch("/{tool_id}/toggle")
def toggle_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enable or disable a tool (manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager only")
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.enabled = not tool.enabled
    db.commit()
    db.refresh(tool)
    return {"id": tool.id, "enabled": tool.enabled}


@router.post("")
def create_tool(
    req: ToolCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new tool (manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager only")
    tool = Tool(
        name=req.name,
        description=req.description,
        tool_type=req.tool_type,
        allowed_roles=",".join(req.allowed_roles),
        config=req.config,
        params=req.params or [],
        enabled=True,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return {
        "id": tool.id,
        "name": tool.name,
        "description": tool.description,
        "tool_type": tool.tool_type,
        "allowed_roles": [r.strip() for r in tool.allowed_roles.split(",")],
        "config": tool.config,
        "params": tool.params,
        "enabled": tool.enabled,
    }


@router.get("/{tool_id}")
def get_tool(
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single tool by ID."""
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return {
        "id": tool.id,
        "name": tool.name,
        "description": tool.description,
        "tool_type": tool.tool_type,
        "allowed_roles": [r.strip() for r in tool.allowed_roles.split(",")],
        "config": tool.config,
        "params": tool.params or [],
        "enabled": tool.enabled,
        "call_count": tool.call_count,
    }


@router.put("/{tool_id}")
def update_tool(
    tool_id: int,
    req: ToolUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a tool (manager only)."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager only")
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if req.name is not None:
        tool.name = req.name
    if req.description is not None:
        tool.description = req.description
    if req.tool_type is not None:
        tool.tool_type = req.tool_type
    if req.allowed_roles is not None:
        tool.allowed_roles = ",".join(req.allowed_roles)
    if req.config is not None:
        tool.config = req.config
    if req.params is not None:
        tool.params = req.params
    db.commit()
    db.refresh(tool)
    return {
        "id": tool.id,
        "name": tool.name,
        "description": tool.description,
        "tool_type": tool.tool_type,
        "allowed_roles": [r.strip() for r in tool.allowed_roles.split(",")],
        "config": tool.config,
        "params": tool.params or [],
        "enabled": tool.enabled,
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
