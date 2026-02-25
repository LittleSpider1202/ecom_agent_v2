from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
from database import engine, get_db
from models import Base, User, TaskInstance
from auth import get_password_hash
from routers import auth as auth_router
from routers import tasks as tasks_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="电商智能运营平台 v2 API",
    version="0.1.0",
    description="人机混合执行流程平台后端服务",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(tasks_router.router)


@app.on_event("startup")
async def seed_data():
    db = next(get_db())
    try:
        # ---- 默认用户 ----
        default_users = [
            {"username": "admin",    "display_name": "管理员", "password": "admin123",    "role": "admin"},
            {"username": "manager",  "display_name": "张经理", "password": "manager123",  "role": "manager"},
            {"username": "executor", "display_name": "李执行", "password": "executor123", "role": "executor"},
        ]
        for u in default_users:
            if not db.query(User).filter(User.username == u["username"]).first():
                db.add(User(
                    username=u["username"],
                    display_name=u["display_name"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                ))
        db.commit()

        # ---- 种子任务数据 ----
        executor = db.query(User).filter(User.username == "executor").first()
        if executor and db.query(TaskInstance).count() == 0:
            now = datetime.now(timezone.utc)
            seed_tasks = [
                # 待办（pending）
                TaskInstance(title="双十一备货采购清单审核", flow_name="采购审核流程", status="pending",
                             current_step="人工审核", has_human_step=True, assigned_to=executor.id,
                             due_date=now + timedelta(hours=2)),
                TaskInstance(title="爆款商品定价策略调整", flow_name="动态定价流程", status="pending",
                             current_step="等待执行", has_human_step=True, assigned_to=executor.id,
                             due_date=now + timedelta(hours=5)),
                TaskInstance(title="新品上架信息填写", flow_name="新品上架流程", status="pending",
                             current_step="人工填写", has_human_step=True, assigned_to=executor.id,
                             due_date=now + timedelta(days=1)),
                TaskInstance(title="竞品价格监控报告确认", flow_name="竞品分析流程", status="pending",
                             current_step="人工确认", has_human_step=True, assigned_to=executor.id,
                             due_date=now + timedelta(days=1, hours=3)),
                TaskInstance(title="月度库存盘点核实", flow_name="库存管理流程", status="pending",
                             current_step="等待执行", has_human_step=False, assigned_to=executor.id,
                             due_date=now + timedelta(days=2)),
                # 进行中（running）
                TaskInstance(title="618大促活动方案执行", flow_name="促销活动流程", status="running",
                             current_step="发布活动页面", has_human_step=False, assigned_to=executor.id),
                TaskInstance(title="供应商资质审核批量处理", flow_name="供应商管理流程", status="running",
                             current_step="证照核验", has_human_step=True, assigned_to=executor.id),
                # 已完成（completed）
                TaskInstance(title="上月退货率分析报告", flow_name="数据分析流程", status="completed",
                             current_step=None, assigned_to=executor.id,
                             created_at=now - timedelta(days=3)),
                TaskInstance(title="Q3季度供应商绩效评估", flow_name="供应商管理流程", status="completed",
                             current_step=None, assigned_to=executor.id,
                             created_at=now - timedelta(days=5)),
                TaskInstance(title="新仓库入驻申请材料提交", flow_name="仓储管理流程", status="completed",
                             current_step=None, assigned_to=executor.id,
                             created_at=now - timedelta(days=7)),
                # 失败（failed）
                TaskInstance(title="跨境物流对接配置", flow_name="物流配置流程", status="failed",
                             current_step="API对接失败", assigned_to=executor.id,
                             created_at=now - timedelta(days=2)),
            ]
            for t in seed_tasks:
                db.add(t)
            db.commit()
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "电商智能运营平台 v2 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
