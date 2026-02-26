from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
from database import engine, get_db
from models import Base, User, TaskInstance, TaskStep
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
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],
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
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "电商智能运营平台 v2 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
