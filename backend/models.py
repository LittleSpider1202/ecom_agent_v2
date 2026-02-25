from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
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
