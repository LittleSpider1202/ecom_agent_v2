from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import require_current_user
from models import User

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# In-memory config store (demo — no DB table needed for config settings)
_config: dict = {
    "feishu": {"app_id": "", "app_secret": "", "webhook_url": "", "connected": False},
    "erp": {"api_url": "", "api_key": "", "connected": False},
    "taobao": {"app_key": "", "app_secret": "", "platform": "taobao", "connected": False},
}


class FeishuConfig(BaseModel):
    app_id: str
    app_secret: str
    webhook_url: Optional[str] = None


class ErpConfig(BaseModel):
    api_url: str
    api_key: str


class TaobaoConfig(BaseModel):
    platform: str
    app_key: str
    app_secret: str


@router.get("")
async def get_integrations(
    current_user: User = Depends(require_current_user),
):
    """返回所有平台集成状态"""
    return [
        {
            "id": "feishu",
            "name": "飞书",
            "description": "飞书机器人通知和审批集成",
            "connected": _config["feishu"]["connected"],
            "config": {"app_id": _config["feishu"]["app_id"]},
        },
        {
            "id": "erp",
            "name": "ERP系统",
            "description": "企业资源计划系统API对接",
            "connected": _config["erp"]["connected"],
            "config": {"api_url": _config["erp"]["api_url"]},
        },
        {
            "id": "taobao",
            "name": "电商平台",
            "description": "淘宝/天猫商品和订单数据同步",
            "connected": _config["taobao"]["connected"],
            "config": {"platform": _config["taobao"]["platform"], "app_key": _config["taobao"]["app_key"]},
        },
    ]


@router.post("/feishu/test")
async def test_feishu(
    body: FeishuConfig,
    current_user: User = Depends(require_current_user),
):
    """保存飞书配置并测试连接"""
    _config["feishu"]["app_id"] = body.app_id
    _config["feishu"]["app_secret"] = body.app_secret
    # Simulate connection test
    if body.app_id and body.app_secret:
        _config["feishu"]["connected"] = True
        return {"success": True, "message": "飞书连接测试成功"}
    else:
        _config["feishu"]["connected"] = False
        return {"success": False, "message": "连接失败：App ID 和 App Secret 不能为空"}


@router.post("/feishu/save")
async def save_feishu(
    body: FeishuConfig,
    current_user: User = Depends(require_current_user),
):
    """保存飞书配置（含 Webhook）"""
    _config["feishu"]["app_id"] = body.app_id
    _config["feishu"]["app_secret"] = body.app_secret
    if body.webhook_url is not None:
        _config["feishu"]["webhook_url"] = body.webhook_url
    _config["feishu"]["connected"] = bool(body.app_id and body.app_secret)
    return {"success": True, "message": "飞书配置已保存", "webhook_url": _config["feishu"]["webhook_url"]}


@router.post("/erp/save")
async def save_erp(
    body: ErpConfig,
    current_user: User = Depends(require_current_user),
):
    """保存ERP配置"""
    _config["erp"]["api_url"] = body.api_url
    _config["erp"]["api_key"] = body.api_key
    _config["erp"]["connected"] = bool(body.api_url and body.api_key)
    return {"success": True, "message": "ERP配置保存成功"}


@router.post("/taobao/save")
async def save_taobao(
    body: TaobaoConfig,
    current_user: User = Depends(require_current_user),
):
    """保存电商平台配置"""
    _config["taobao"]["platform"] = body.platform
    _config["taobao"]["app_key"] = body.app_key
    _config["taobao"]["app_secret"] = body.app_secret
    _config["taobao"]["connected"] = bool(body.app_key and body.app_secret)
    return {"success": True, "message": f"{body.platform}配置保存成功"}
