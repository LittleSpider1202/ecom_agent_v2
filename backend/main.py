from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from datetime import datetime, timezone, timedelta
import time
import uuid
import logging
from database import engine, get_db
from models import Base, User, TaskInstance, TaskStep, TaskDagNode, AISuggestion, Flow, FlowVersion, KnowledgeEntry, KnowledgeSubmission, Tool, ToolExecution, Department, Role
from auth import get_password_hash
from routers import auth as auth_router
from routers import tasks as tasks_router
from routers import dashboard as dashboard_router
from routers import flows as flows_router
from routers import knowledge as knowledge_router
from routers import tools as tools_router
from routers import departments as departments_router
from routers import roles as roles_router
from routers import members as members_router
from routers import analytics as analytics_router
from routers import suggestions as suggestions_router
from routers import integrations as integrations_router
from routers import logs as logs_router

Base.metadata.create_all(bind=engine)

# 补充新增字段（create_all 不会 ALTER 已有表）
with engine.connect() as _conn:
    _conn.execute(text(
        "ALTER TABLE task_instances ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE"
    ))
    _conn.execute(text(
        "ALTER TABLE tools ADD COLUMN IF NOT EXISTS config JSONB"
    ))
    _conn.execute(text(
        "ALTER TABLE tools ADD COLUMN IF NOT EXISTS params JSONB"
    ))
    _conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL"
    ))
    _conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS feishu_id VARCHAR(100)"
    ))
    _conn.execute(text(
        "ALTER TABLE task_dag_nodes ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE"
    ))
    _conn.execute(text(
        "ALTER TABLE task_dag_nodes ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE"
    ))
    _conn.execute(text(
        "ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE"
    ))
    _conn.execute(text(
        "ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS decided_by INTEGER REFERENCES users(id)"
    ))
    _conn.commit()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("app")


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        logger.info(
            "%s %s %d %.1fms",
            request.method, request.url.path, response.status_code, duration_ms,
            extra={"request_id": request_id},
        )
        return response


app = FastAPI(
    title="电商智能运营平台 v2 API",
    version="0.1.0",
    description="人机混合执行流程平台后端服务",
)

app.add_middleware(TimingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(tasks_router.router)
app.include_router(dashboard_router.router)
app.include_router(flows_router.router)
app.include_router(knowledge_router.router)
app.include_router(tools_router.router)
app.include_router(departments_router.router)
app.include_router(roles_router.router)
app.include_router(members_router.router)
app.include_router(analytics_router.router)
app.include_router(suggestions_router.router)
app.include_router(integrations_router.router)
app.include_router(logs_router.router)


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
                             created_at=now - timedelta(days=3),
                             completed_at=now - timedelta(days=2, hours=20)),
                TaskInstance(title="Q3季度供应商绩效评估", flow_name="供应商管理流程", status="completed",
                             current_step=None, assigned_to=executor.id,
                             created_at=now - timedelta(days=5),
                             completed_at=now - timedelta(days=4, hours=18)),
                TaskInstance(title="新仓库入驻申请材料提交", flow_name="仓储管理流程", status="completed",
                             current_step=None, assigned_to=executor.id,
                             created_at=now - timedelta(days=7),
                             completed_at=now - timedelta(days=6, hours=14)),
                # 失败（failed）
                TaskInstance(title="跨境物流对接配置", flow_name="物流配置流程", status="failed",
                             current_step="API对接失败", assigned_to=executor.id,
                             created_at=now - timedelta(days=2),
                             completed_at=now - timedelta(days=1, hours=22)),
            ]
            for t in seed_tasks:
                db.add(t)
            db.commit()

        # ---- 为历史任务补充 completed_at（首次迁移兼容）----
        completed_tasks = db.query(TaskInstance).filter(
            TaskInstance.status.in_(["completed", "failed", "rejected"]),
            TaskInstance.completed_at == None,
        ).all()
        for t in completed_tasks:
            t.completed_at = t.created_at + timedelta(hours=6)
        if completed_tasks:
            db.commit()

        # ---- 重置 TaskStep 状态（dev 模式，确保每次重启测试数据新鲜） ----
        db.query(TaskStep).update({
            TaskStep.status: "pending",
            TaskStep.final_content: None,
            TaskStep.reject_reason: None,
            TaskStep.completed_by: None,
            TaskStep.completed_at: None,
        }, synchronize_session=False)
        # 重置关联任务的状态和 has_human_step（业务逻辑可能将其改为 completed/False）
        step_task_ids = [row[0] for row in db.query(TaskStep.task_id).distinct().all()]
        if step_task_ids:
            db.query(TaskInstance).filter(TaskInstance.id.in_(step_task_ids)).update(
                {TaskInstance.has_human_step: True, TaskInstance.status: "pending"},
                synchronize_session=False,
            )
        db.commit()

        # ---- TaskStep 种子数据（每个 has_human_step 任务一条） ----
        if db.query(TaskStep).count() == 0:
            step_templates = {
                "双十一备货采购清单审核": {
                    "step_name": "审核采购清单",
                    "background_info": (
                        "AI已完成竞品价格分析，识别出15款热销商品需要补货。"
                        "当前库存预警商品：手机壳（剩余32件）、充电宝（剩余18件）、蓝牙耳机（剩余5件）。"
                        "AI根据历史销售数据预测双十一备货需求量，已生成采购建议清单，总金额约¥156,000。"
                    ),
                    "instructions": (
                        "请审核AI生成的采购清单，确认备货数量是否合理。重点关注：\n"
                        "1) 高利润商品是否足量备货；\n"
                        "2) 供应商交期是否满足双十一时间节点；\n"
                        "3) 总采购金额是否在预算范围内。"
                    ),
                    "ai_suggestion": (
                        "建议采购以下商品：\n"
                        "• 手机壳 A款：500件（预计售出450件，利润率38%）\n"
                        "• 充电宝 20000mAh：300件（预计售出280件，利润率25%）\n"
                        "• 蓝牙耳机 Pro版：200件（预计售出185件，利润率42%）\n"
                        "总采购金额约¥156,000，在Q4预算范围内。\n"
                        "建议优先锁定蓝牙耳机库存，供应商产能有限。"
                    ),
                },
                "爆款商品定价策略调整": {
                    "step_name": "确认定价方案",
                    "background_info": (
                        "AI已抓取近48小时竞品价格变动，发现3个主要竞争对手均在双十一前夕降价。"
                        "竞品A降价15%，竞品B推出满减活动，竞品C推出买一赠一。"
                        "当前我方商品市场占有率为23%，较上月下降2个百分点。"
                    ),
                    "instructions": (
                        "请确认新的定价方案并决定是否执行。需要判断：\n"
                        "1) 是否需要跟进降价以维持竞争力；\n"
                        "2) 降价幅度是否会影响整体利润率目标；\n"
                        "3) 是否采用满减或赠品等促销形式替代直接降价。"
                    ),
                    "ai_suggestion": (
                        "建议采用阶梯定价策略：\n"
                        "• 原价¥299商品调整为：满¥199减¥30（等效8.5折）\n"
                        "• 搭配满¥500包邮活动\n"
                        "• 预计可提升转化率约18%，GMV增长约12%\n"
                        "相比竞品直接降价，此方案可减少品牌价值损伤。"
                    ),
                },
                "新品上架信息填写": {
                    "step_name": "填写商品信息",
                    "background_info": (
                        "新品「智能温控马克杯」已完成供应商对接，产品图片和规格说明已收到。"
                        "产品SKU：MUG-TC-001，成本价¥45，建议零售价¥129-¥159。"
                        "已获得3C认证，预计首批到货500件，竞品均价¥139，好评率85%。"
                    ),
                    "instructions": (
                        "请填写商品上架所需信息：\n"
                        "1) 商品标题（建议含关键词：智能/保温/马克杯）；\n"
                        "2) 商品详情页卖点描述（3-5个核心卖点）；\n"
                        "3) 定价（建议¥129-¥159区间）；\n"
                        "4) 库存预警值设置。"
                    ),
                    "ai_suggestion": (
                        "建议商品标题：「智能温控保温马克杯 316不锈钢 LED显温 办公室咖啡杯 500ml」\n\n"
                        "核心卖点：\n"
                        "1. 实时LED温度显示，精准到0.1°C\n"
                        "2. 316食品级不锈钢内胆，安全无异味\n"
                        "3. 12小时超长保温，满足全天使用\n"
                        "4. 无线充电底座可选购，使用更便捷\n"
                        "5. 简约北欧设计，职场送礼首选\n\n"
                        "建议定价：¥139（首发价），库存预警值：50件"
                    ),
                },
                "竞品价格监控报告确认": {
                    "step_name": "确认监控报告",
                    "background_info": (
                        "本周竞品价格监控系统已抓取82个竞品SKU的价格数据，较上周新增监控对象7个。"
                        "主要发现：竞品X的爆款产品连续3天降价，降幅累计18%；"
                        "竞品Y上线了新的限时秒杀专区；竞品Z开始主打社交媒体种草策略。"
                    ),
                    "instructions": (
                        "请确认本周竞品监控报告内容，并决定是否需要触发应对策略：\n"
                        "1) 竞品X的持续降价是否需要我方跟进；\n"
                        "2) 是否需要对重点竞品增加监控频次；\n"
                        "3) 报告是否可以归档并发送给管理层。"
                    ),
                    "ai_suggestion": (
                        "本周竞品分析摘要：\n\n"
                        "【需关注】竞品X「手机支架」从¥39降至¥32，建议我方同类产品调整至¥35以内。\n"
                        "【暂时观望】竞品Y秒杀活动通常持续1-3天，建议下周再评估影响。\n"
                        "【无需应对】竞品Z社媒策略效果需1-2个月才能体现，短期无影响。\n\n"
                        "建议：批准本报告归档，授权价格策略团队进行小幅价格测试。"
                    ),
                },
                "供应商资质审核批量处理": {
                    "step_name": "审核供应商资质",
                    "background_info": (
                        "本批次共8家供应商提交了资质审核申请。"
                        "AI已完成初审：6家资料完整，2家存在问题"
                        "（供应商E证照过期，供应商H缺少质检报告）。"
                        "6家初审通过的供应商均有3年以上合作历史，近期无违规记录。"
                    ),
                    "instructions": (
                        "请人工复核AI初审结果，并对6家初审通过的供应商做出最终审核决定。\n"
                        "重点关注：\n"
                        "1) 合同条款是否有异常；\n"
                        "2) 供货价格是否在合理区间；\n"
                        "3) 是否需要实地考察。"
                    ),
                    "ai_suggestion": (
                        "建议批准以下6家供应商通过本期资质审核：\n"
                        "• 苏州优品科技：续签三年框架协议\n"
                        "• 深圳极速供应链：提升采购份额至30%\n"
                        "• 东莞创新制造：维持现有合作条款\n"
                        "• 广州时尚工厂：扩展合作品类（新增家居用品）\n"
                        "• 杭州精品源头：引入新品试采\n"
                        "• 北京智慧物流：续签配送合同\n\n"
                        "供应商E和H需补充材料后重新提交。"
                    ),
                },
            }
            human_tasks = (
                db.query(TaskInstance)
                .filter(TaskInstance.has_human_step == True)
                .all()
            )
            for task in human_tasks:
                tmpl = step_templates.get(task.title)
                if tmpl:
                    db.add(TaskStep(
                        task_id=task.id,
                        step_name=tmpl["step_name"],
                        background_info=tmpl["background_info"],
                        instructions=tmpl["instructions"],
                        ai_suggestion=tmpl["ai_suggestion"],
                        status="pending",
                    ))
            db.commit()

        # ---- TaskDagNode 种子数据 ----
        # 为"618大促活动方案执行"（自动任务，running）创建 DAG 节点
        auto_task = db.query(TaskInstance).filter(
            TaskInstance.title == "618大促活动方案执行"
        ).first()
        if auto_task and db.query(TaskDagNode).filter(TaskDagNode.task_id == auto_task.id).count() == 0:
            dag_nodes = [
                TaskDagNode(
                    task_id=auto_task.id, node_key="n1", label="采集活动数据",
                    node_type="auto", status="completed", pos_x=200, pos_y=60,
                    source_keys=[],
                    log="[INFO] 开始采集竞品活动数据...\n[INFO] 采集完成：共获取 1,284 条数据\n[INFO] 数据已写入分析队列",
                ),
                TaskDagNode(
                    task_id=auto_task.id, node_key="n2", label="竞品价格分析",
                    node_type="auto", status="completed", pos_x=200, pos_y=200,
                    source_keys=["n1"],
                    log="[INFO] 开始价格比对分析...\n[INFO] 检测到3家竞品均已降价\n[INFO] 竞品A降价15%，竞品B满减活动，竞品C组合优惠\n[INFO] 分析报告已生成",
                ),
                TaskDagNode(
                    task_id=auto_task.id, node_key="n3", label="AI生成活动方案",
                    node_type="auto", status="running", pos_x=200, pos_y=340,
                    source_keys=["n2"],
                    log="[INFO] 调用 AI 方案生成服务...\n[INFO] 模型推理中，已完成 60%...",
                ),
                TaskDagNode(
                    task_id=auto_task.id, node_key="n4", label="推送通知测试",
                    node_type="auto", status="failed", pos_x=460, pos_y=340,
                    source_keys=["n2"],
                    log="[INFO] 开始推送渠道连通性测试...\n[ERROR] API 连接超时 (timeout: 30s)\n[ERROR] 重试第1次...失败\n[ERROR] 重试第2次...失败\n[ERROR] 重试第3次...失败\n[FATAL] 推送服务不可用，任务终止",
                    error_msg="推送接口连接超时，已重试 3 次均失败",
                ),
                TaskDagNode(
                    task_id=auto_task.id, node_key="n5", label="发布活动页面",
                    node_type="auto", status="pending", pos_x=200, pos_y=480,
                    source_keys=["n3"],
                    log="",
                ),
            ]
            for node in dag_nodes:
                db.add(node)
            db.commit()

        # ---- Flow 种子数据（与 TaskInstance.flow_name 对应，用于健康指标计算）----
        if not db.query(Flow).filter(Flow.name == "采购审核流程").first():
            seed_flows = [
                Flow(name="采购审核流程", status="active", trigger_type="manual", version=3,
                     description="自动采集竞品数据，AI生成采购建议，人工审核确认"),
                Flow(name="动态定价流程", status="active", trigger_type="cron", trigger_config="0 6 * * *", version=2,
                     description="每日自动监控竞品价格，触发定价策略调整建议"),
                Flow(name="新品上架流程", status="active", trigger_type="manual", version=1,
                     description="新品信息录入、审核、上架一体化流程"),
                Flow(name="竞品分析流程", status="active", trigger_type="cron", trigger_config="0 8 * * 1", version=2,
                     description="每周采集竞品动态，生成监控报告"),
                Flow(name="库存管理流程", status="inactive", trigger_type="cron", trigger_config="0 0 * * *", version=1,
                     description="每日库存盘点与预警流程"),
                Flow(name="促销活动流程", status="active", trigger_type="manual", version=4,
                     description="大促活动策划、执行、复盘全流程"),
                Flow(name="供应商管理流程", status="active", trigger_type="manual", version=2,
                     description="供应商资质审核与绩效评估流程"),
                Flow(name="数据分析流程", status="active", trigger_type="cron", trigger_config="0 9 1 * *", version=1,
                     description="月度数据报表自动生成与分析"),
                Flow(name="仓储管理流程", status="inactive", trigger_type="manual", version=1,
                     description="仓库入驻申请与容量规划流程"),
                Flow(name="物流配置流程", status="active", trigger_type="manual", version=1,
                     description="物流渠道对接与配置流程"),
            ]
            for f in seed_flows:
                db.add(f)
            db.commit()

        # ---- KnowledgeEntry 种子数据 ----
        if db.query(KnowledgeEntry).count() == 0:
            seed_knowledge = [
                KnowledgeEntry(
                    title="退货处理SOP",
                    category="客服规范",
                    version="v2.3",
                    view_count=128,
                    helpful_count=45,
                    content=(
                        "# 退货处理标准操作流程（SOP）\n\n"
                        "## 适用范围\n\n"
                        "本SOP适用于所有电商平台（淘宝、天猫、拼多多）的退货处理操作。\n\n"
                        "## 处理步骤\n\n"
                        "### 第一步：接收退货申请\n\n"
                        "1. 在平台后台查看退货申请\n"
                        "2. 核对退货原因（质量问题/不喜欢/尺寸不合适等）\n"
                        "3. 判断是否符合退货条件（7天无理由/质量问题30天）\n\n"
                        "### 第二步：审核与确认\n\n"
                        "1. 质量问题：截图存档，联系供应商\n"
                        "2. 非质量问题：检查是否超过退货期限\n"
                        "3. 特殊情况上报主管处理\n\n"
                        "### 第三步：退款操作\n\n"
                        "1. 同意退货后，在系统操作退款\n"
                        "2. 退款到账时间：支付宝1-3个工作日，银行卡3-7个工作日\n"
                        "3. 记录退货原因和处理结果\n\n"
                        "## 注意事项\n\n"
                        "- 质量问题优先处理，不得拖延超过24小时\n"
                        "- 所有退货记录需存档备查"
                    ),
                ),
                KnowledgeEntry(
                    title="发货规范操作指南",
                    category="仓库操作",
                    version="v1.5",
                    view_count=89,
                    helpful_count=32,
                    content=(
                        "# 发货规范操作指南\n\n"
                        "## 发货前准备\n\n"
                        "1. 核对订单信息（收货地址、商品数量、SKU）\n"
                        "2. 检查库存是否充足\n"
                        "3. 准备打包材料（纸箱、气泡膜、胶带）\n\n"
                        "## 打包规范\n\n"
                        "### 易碎品\n"
                        "- 使用气泡膜包裹2层\n"
                        "- 箱内填充泡沫颗粒，防止晃动\n"
                        "- 外箱标注「易碎」\n\n"
                        "### 普通商品\n"
                        "- 产品放入内袋后装箱\n"
                        "- 避免单件重量超过5kg\n\n"
                        "## 发货流程\n\n"
                        "1. 打印快递单并粘贴\n"
                        "2. 系统录入快递单号\n"
                        "3. 交给快递员并索取回单\n"
                        "4. 更新系统发货状态"
                    ),
                ),
                KnowledgeEntry(
                    title="客服话术框架",
                    category="客服规范",
                    version="v3.1",
                    view_count=210,
                    helpful_count=78,
                    content=(
                        "# 客服话术框架\n\n"
                        "## 基本原则\n\n"
                        "- 热情、专业、解决问题为导向\n"
                        "- 响应时间：工作时间内3分钟以内\n"
                        "- 首次回复必须包含称呼（亲/您好）\n\n"
                        "## 常见场景话术\n\n"
                        "### 售前咨询\n"
                        "**用户问：这个产品质量怎么样？**\n"
                        "推荐回复：亲，我们的产品均经过严格质检，已获得XX认证。\n"
                        "您可以放心购买，如有任何质量问题，我们承诺7天无理由退换货。\n\n"
                        "### 物流查询\n"
                        "**用户问：我的快递到哪了？**\n"
                        "推荐回复：亲，您的订单已于[日期]发出，快递单号为[单号]，\n"
                        "您可在[快递官网]查询实时物流信息。\n\n"
                        "### 投诉处理\n"
                        "1. 首先道歉并表示理解\n"
                        "2. 了解具体问题\n"
                        "3. 给出解决方案\n"
                        "4. 确认用户满意后结束对话"
                    ),
                ),
                KnowledgeEntry(
                    title="采购流程操作规范",
                    category="采购流程",
                    version="v2.0",
                    view_count=67,
                    helpful_count=23,
                    content=(
                        "# 采购流程操作规范\n\n"
                        "## 采购申请\n\n"
                        "1. 填写采购申请单（商品名称、数量、预算、用途）\n"
                        "2. 主管审批（5000元以下当日审批）\n"
                        "3. 财务确认预算\n\n"
                        "## 供应商选择\n\n"
                        "### 优先级排序\n"
                        "1. 战略合作供应商（价格优惠10%以上）\n"
                        "2. 合格供应商名录内供应商\n"
                        "3. 新供应商（需提前30天资质审核）\n\n"
                        "## 下单流程\n\n"
                        "1. 与供应商确认价格和交期\n"
                        "2. 发送正式采购订单\n"
                        "3. 供应商回签确认\n"
                        "4. 安排付款（预付50%，到货验收后付尾款）\n\n"
                        "## 到货验收\n\n"
                        "- 核对数量和型号\n"
                        "- 抽样质检（抽检率5%）\n"
                        "- 不合格品拒收并通知供应商"
                    ),
                ),
                KnowledgeEntry(
                    title="淘宝天猫违规规则速查",
                    category="平台规则",
                    version="v4.2",
                    view_count=156,
                    helpful_count=61,
                    content=(
                        "# 淘宝天猫违规规则速查\n\n"
                        "## 商品发布规范\n\n"
                        "### 标题规范\n"
                        "- 禁止使用\"第一\"、\"最\"、\"全网最低\"等极限用词\n"
                        "- 禁止虚假宣传（功效未经证实）\n"
                        "- 标题长度：30个字以内\n\n"
                        "### 图片规范\n"
                        "- 主图不得含有文字（天猫规定）\n"
                        "- 禁止添加水印或边框\n"
                        "- 图片分辨率不低于800×800像素\n\n"
                        "## 常见违规及处罚\n\n"
                        "| 违规类型 | 处罚力度 |\n"
                        "|---------|--------|\n"
                        "| 虚假发货 | 扣48分 |\n"
                        "| 拒绝退款 | 扣12分 |\n"
                        "| 虚假描述 | 扣12分 |\n\n"
                        "## 申诉流程\n\n"
                        "1. 登录卖家中心 → 违规申诉\n"
                        "2. 上传证据（物流截图/聊天记录等）\n"
                        "3. 等待平台审核（1-3个工作日）"
                    ),
                ),
                KnowledgeEntry(
                    title="库存盘点操作规程",
                    category="仓库操作",
                    version="v1.2",
                    view_count=44,
                    helpful_count=18,
                    content=(
                        "# 库存盘点操作规程\n\n"
                        "## 盘点频率\n\n"
                        "- 月度盘点：每月最后一个工作日\n"
                        "- 季度全盘：每季度末进行全仓盘点\n"
                        "- 日常动态盘点：高频商品每周盘点\n\n"
                        "## 盘点步骤\n\n"
                        "1. 导出系统库存清单\n"
                        "2. 停止当日入库/出库操作\n"
                        "3. 按区域逐一清点实物\n"
                        "4. 与系统数据比对\n"
                        "5. 差异超过1%需复盘\n\n"
                        "## 盘点差异处理\n\n"
                        "- 盈余：检查是否有未录入入库单\n"
                        "- 亏损：检查是否有未录入出库单，排查丢失\n"
                        "- 重大差异（超过5%）：上报仓库主管处理"
                    ),
                ),
                KnowledgeEntry(
                    title="运营活动策划指南",
                    category="运营规则",
                    version="v1.8",
                    view_count=93,
                    helpful_count=37,
                    content=(
                        "# 运营活动策划指南\n\n"
                        "## 活动类型\n\n"
                        "1. **节日大促**：双十一、618、双十二\n"
                        "2. **日常促销**：周末特卖、爆款秒杀\n"
                        "3. **新品推广**：新品上市活动\n\n"
                        "## 策划流程\n\n"
                        "### 活动前30天\n"
                        "- 确定活动主题和时间\n"
                        "- 选品和定价\n"
                        "- 库存备货计划\n\n"
                        "### 活动前7天\n"
                        "- 上架活动商品\n"
                        "- 配置优惠规则\n"
                        "- 测试下单流程\n\n"
                        "### 活动当天\n"
                        "- 开启实时监控\n"
                        "- 备用客服上线\n"
                        "- 库存预警提醒\n\n"
                        "## 活动效果评估\n\n"
                        "关键指标：GMV、转化率、客单价、复购率"
                    ),
                ),
                KnowledgeEntry(
                    title="新品选品标准",
                    category="产品信息",
                    version="v1.3",
                    view_count=72,
                    helpful_count=29,
                    content=(
                        "# 新品选品标准\n\n"
                        "## 市场分析维度\n\n"
                        "1. **市场规模**：类目年销售额 > 1000万\n"
                        "2. **增长趋势**：近3个月搜索量环比增长 > 10%\n"
                        "3. **竞争程度**：竞品数量 < 500个（蓝海市场）\n\n"
                        "## 产品评估维度\n\n"
                        "- 利润率 > 20%\n"
                        "- 退货率 < 5%\n"
                        "- 供应商交期 < 15天\n\n"
                        "## 选品禁区\n\n"
                        "- 高仿/侵权商品\n"
                        "- 需要特殊资质的商品（食品、化妆品等需提前确认）\n"
                        "- 易碎/超重（单件超10kg）商品慎选\n\n"
                        "## 试销流程\n\n"
                        "1. 小批量采购（50-100件）\n"
                        "2. 上架测试（2-4周）\n"
                        "3. 数据达标后追加采购"
                    ),
                ),
                KnowledgeEntry(
                    title="拼多多规则手册",
                    category="平台规则",
                    version="v2.1",
                    view_count=83,
                    helpful_count=35,
                    content=(
                        "# 拼多多规则手册\n\n"
                        "## 店铺规范\n\n"
                        "- 店铺名称不得含有竞品名称\n"
                        "- 客服响应时间要求：30分钟内\n"
                        "- DSR评分（服务/物流/描述）需维持 > 4.7\n\n"
                        "## 商品规范\n\n"
                        "### 主图要求\n"
                        "- 纯白背景（活动期间可用节日背景）\n"
                        "- 不超过3个促销标签\n\n"
                        "### 价格规范\n"
                        "- 活动价不得高于历史最低价\n"
                        "- 不得设置虚高原价\n\n"
                        "## 违规处罚\n\n"
                        "| 违规等级 | 处罚 |\n"
                        "|---------|-----|\n"
                        "| 轻微 | 商品下架整改 |\n"
                        "| 严重 | 店铺降权 |\n"
                        "| 恶意 | 永久封号 |\n\n"
                        "## 申诉入口\n\n"
                        "商家后台 → 违规申诉 → 填写申诉理由 → 上传证据"
                    ),
                ),
                KnowledgeEntry(
                    title="供应商评估标准",
                    category="采购流程",
                    version="v1.6",
                    view_count=51,
                    helpful_count=22,
                    content=(
                        "# 供应商评估标准\n\n"
                        "## 评估维度\n\n"
                        "### 1. 准时交货率（权重40%）\n"
                        "- 优秀：≥ 95%\n"
                        "- 合格：85%-94%\n"
                        "- 不合格：< 85%\n\n"
                        "### 2. 产品合格率（权重35%）\n"
                        "- 优秀：≥ 98%\n"
                        "- 合格：93%-97%\n"
                        "- 不合格：< 93%\n\n"
                        "### 3. 价格竞争力（权重25%）\n"
                        "- 与同类供应商对比，低于平均价5%以上为优秀\n\n"
                        "## 评估结果处理\n\n"
                        "- 综合评分 ≥ 90：战略合作供应商，增加采购份额\n"
                        "- 综合评分 75-89：合格供应商，维持合作\n"
                        "- 综合评分 60-74：需整改，给予3个月改进期\n"
                        "- 综合评分 < 60：终止合作"
                    ),
                ),
            ]
            for k in seed_knowledge:
                db.add(k)
            db.commit()

        # ---- AISuggestion 种子数据 ----
        if db.query(AISuggestion).count() == 0:
            seed_suggestions = [
                AISuggestion(
                    title="双十一备货策略优化建议",
                    summary="基于历史销售数据，建议提前2周增加爆款商品备货量15-20%，重点关注手机配件和家居品类。",
                    content=(
                        "## 分析背景\n\n"
                        "AI系统对过去3年双十一销售数据进行分析，结合当前库存水位与供应商交期，生成本次备货策略建议。\n\n"
                        "## 核心建议\n\n"
                        "1. **手机配件品类**：预测销量较日均增长320%，建议备货量 = 历史峰值 × 1.15\n"
                        "2. **家居用品品类**：预测销量较日均增长180%，建议备货量 = 历史峰值 × 1.20\n"
                        "3. **服装品类**：季节性需求稳定，建议维持常规备货量\n\n"
                        "## 风险提示\n\n"
                        "- 主要供应商苏州优品科技产能存在瓶颈，建议提前14天下单\n"
                        "- 物流旺季预计从11月5日开始，建议在11月3日前完成入库\n\n"
                        "## 预期收益\n\n"
                        "执行本建议预计可额外增加GMV约¥280万，缺货损失减少约¥45万。"
                    ),
                    category="库存管理",
                    status="pending",
                ),
                AISuggestion(
                    title="竞品价格战应对策略",
                    summary="竞品A近7天持续降价累计18%，建议启动精准促销而非全面跟进降价。",
                    content=(
                        "## 竞品动态\n\n"
                        "过去7天监控数据显示：\n"
                        "- 竞品A（市场份额28%）：主力SKU降价累计18%\n"
                        "- 竞品B（市场份额21%）：推出买一赠一活动\n"
                        "- 竞品C（市场份额15%）：维持原价，侧重内容营销\n\n"
                        "## 建议策略\n\n"
                        "**方案A（推荐）：精准促销**\n"
                        "- 针对价格敏感型用户推送定向优惠券（面值¥20-50）\n"
                        "- 重点商品搭配赠品，提升感知价值\n"
                        "- 预计效果：转化率提升12%，利润率损失控制在3%以内\n\n"
                        "**方案B：全面跟进降价**\n"
                        "- 主力SKU统一降价10%\n"
                        "- 预计效果：转化率提升18%，但利润率损失约8%\n\n"
                        "## 建议决策\n\n"
                        "建议采用方案A，在维持品牌价值的同时有效应对竞争压力。"
                    ),
                    category="定价策略",
                    status="pending",
                ),
                AISuggestion(
                    title="供应商绩效评估结果与调整建议",
                    summary="Q3评估显示2家供应商延期率超标，建议调整采购份额并启动备选供应商考察。",
                    content=(
                        "## 评估概况\n\n"
                        "本季度共对12家主要供应商进行绩效评估，综合考量准时交货率、产品合格率、价格竞争力三项指标。\n\n"
                        "## 问题供应商\n\n"
                        "**供应商E（深圳某科技）**\n"
                        "- 准时交货率：61%（要求≥85%）\n"
                        "- 原因：产能扩张期设备故障频繁\n"
                        "- 建议：将采购份额从25%降至10%，待其完成产线升级后重新评估\n\n"
                        "**供应商H（广州某工厂）**\n"
                        "- 产品合格率：88%（要求≥95%）\n"
                        "- 原因：原材料供应商变更导致品质波动\n"
                        "- 建议：暂停新订单，要求提交质量整改方案\n\n"
                        "## 优秀供应商奖励建议\n\n"
                        "苏州优品科技、杭州精品源头连续3季度表现优异，建议提升采购份额并签订长期框架协议。\n\n"
                        "## 下步行动\n\n"
                        "建议在2周内完成备选供应商考察，确保供应链稳定性。"
                    ),
                    category="供应商管理",
                    status="pending",
                ),
            ]
            for s in seed_suggestions:
                db.add(s)
            db.commit()

        # ---- Tool 种子数据 ----
        if db.query(Tool).count() == 0:
            seed_tools = [
                Tool(
                    name="发货单导出",
                    description="从系统中导出待发货订单清单，生成Excel文件供仓库打印使用。",
                    tool_type="script",
                    enabled=True,
                    allowed_roles="executor,manager",
                    call_count=12,
                ),
                Tool(
                    name="ERP库存查询",
                    description="实时查询ERP系统中指定SKU的库存数量和仓位信息。",
                    tool_type="api",
                    enabled=True,
                    allowed_roles="executor,manager",
                    call_count=45,
                ),
                Tool(
                    name="退货快递单打印",
                    description="批量生成退货快递单，对接顺丰/菜鸟API，自动下单并打印。",
                    tool_type="api",
                    enabled=True,
                    allowed_roles="executor,manager",
                    call_count=8,
                ),
                Tool(
                    name="竞品数据采集",
                    description="采集竞品店铺商品价格、销量、评价数据，写入数据库。",
                    tool_type="script",
                    enabled=True,
                    allowed_roles="manager",
                    call_count=3,
                ),
                Tool(
                    name="飞书消息推送",
                    description="向指定飞书群或个人发送通知消息。",
                    tool_type="webhook",
                    enabled=False,
                    allowed_roles="executor,manager",
                    call_count=0,
                ),
            ]
            for t in seed_tools:
                db.add(t)
            db.commit()

        # Seed roles
        if db.query(Role).count() == 0:
            default_perms = {
                "tasks": {"view": True, "create": True, "edit": True, "delete": False},
                "flows": {"view": True, "create": False, "edit": False, "delete": False},
                "tools": {"view": True, "use": True, "manage": False},
                "knowledge": {"view": True, "contribute": True, "manage": False},
            }
            manager_perms = {
                "tasks": {"view": True, "create": True, "edit": True, "delete": True},
                "flows": {"view": True, "create": True, "edit": True, "delete": True},
                "tools": {"view": True, "use": True, "manage": True},
                "knowledge": {"view": True, "contribute": True, "manage": True},
            }
            readonly_perms = {
                "tasks": {"view": True, "create": False, "edit": False, "delete": False},
                "flows": {"view": True, "create": False, "edit": False, "delete": False},
                "tools": {"view": True, "use": False, "manage": False},
                "knowledge": {"view": True, "contribute": False, "manage": False},
            }
            seed_roles = [
                Role(name="管理员", description="拥有所有权限", permissions=manager_perms,
                     node_types=["data_confirm", "review_judge", "approval"]),
                Role(name="执行者", description="执行日常任务", permissions=default_perms,
                     node_types=["data_confirm"]),
                Role(name="只读", description="仅查看权限", permissions=readonly_perms,
                     node_types=[]),
            ]
            for r in seed_roles:
                db.add(r)
            db.commit()

        # Seed departments
        if db.query(Department).count() == 0:
            root = Department(name="总公司", parent_id=None, member_count=0)
            db.add(root)
            db.flush()
            dept1 = Department(name="运营部", parent_id=root.id, member_count=3)
            dept2 = Department(name="采购部", parent_id=root.id, member_count=2)
            dept3 = Department(name="客服部", parent_id=root.id, member_count=4)
            db.add_all([dept1, dept2, dept3])
            db.flush()
            dept4 = Department(name="直播运营组", parent_id=dept1.id, member_count=0)
            db.add(dept4)
            db.commit()
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "电商智能运营平台 v2 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
