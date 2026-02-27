from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="executor")  # executor | manager | admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TaskInstance(Base):
    __tablename__ = "task_instances"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    flow_name = Column(String(100), nullable=False)
    # pending | running | completed | failed | rejected
    status = Column(String(20), nullable=False, default="pending")
    current_step = Column(String(100), nullable=True)   # 当前执行步骤名
    has_human_step = Column(Boolean, default=False)     # 是否有待处理人工步骤
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)


class TaskStep(Base):
    __tablename__ = "task_steps"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("task_instances.id"), nullable=False, index=True)
    step_name = Column(String(100), nullable=False)
    background_info = Column(Text, nullable=True)   # 机器已完成的背景信息
    instructions = Column(Text, nullable=True)       # 需要人做什么
    ai_suggestion = Column(Text, nullable=True)      # AI建议（可修改）
    # pending | completed | rejected
    status = Column(String(20), nullable=False, default="pending")
    final_content = Column(Text, nullable=True)      # 最终提交内容
    reject_reason = Column(Text, nullable=True)      # 驳回原因
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Flow(Base):
    __tablename__ = "flows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    nodes = Column(JSON, nullable=False, default=list)
    edges = Column(JSON, nullable=False, default=list)
    version = Column(Integer, nullable=False, default=1)
    trigger_type = Column(String(20), nullable=True)   # manual | cron
    trigger_config = Column(String(200), nullable=True) # cron expression
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FlowVersion(Base):
    __tablename__ = "flow_versions"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("flows.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    nodes = Column(JSON, nullable=False)
    edges = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    # pending | accepted | ignored
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
