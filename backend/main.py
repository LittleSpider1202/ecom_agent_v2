from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from datetime import datetime, timezone, timedelta
import time
import uuid
import logging
from database import engine, get_db
from models import Base, User, TaskInstance, TaskStep, TaskDagNode, AISuggestion, Flow, FlowVersion
from auth import get_password_hash
from routers import auth as auth_router
from routers import tasks as tasks_router
from routers import dashboard as dashboard_router
from routers import flows as flows_router

Base.metadata.create_all(bind=engine)

# 补充新增字段（create_all 不会 ALTER 已有表）
with engine.connect() as _conn:
    _conn.execute(text(
        "ALTER TABLE task_instances ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE"
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
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "电商智能运营平台 v2 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
