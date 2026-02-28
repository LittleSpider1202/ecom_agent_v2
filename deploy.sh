#!/usr/bin/env bash
# deploy.sh — 一键部署到小主机（192.168.0.112）
# 用法：bash deploy.sh
# 前提：已 ssh-keygen 配置免密登录，或有 SSH 密钥

set -e

SERVER="hz@192.168.0.112"
REMOTE_DIR="~/ecom_agent_v2"
BACKEND_PORT=8002

echo "==== [1/4] 构建前端 ===="
cd frontend
npm run build
cd ..

echo "==== [2/4] 同步后端代码 ===="
scp backend/main.py \
    backend/models.py \
    backend/auth.py \
    backend/database.py \
    backend/requirements.txt \
    backend/requirements-prod.txt \
    "$SERVER:$REMOTE_DIR/backend/"

scp backend/routers/__init__.py \
    backend/routers/auth.py \
    backend/routers/tasks.py \
    backend/routers/dashboard.py \
    backend/routers/flows.py \
    backend/routers/knowledge.py \
    backend/routers/tools.py \
    backend/routers/departments.py \
    backend/routers/roles.py \
    backend/routers/members.py \
    backend/routers/analytics.py \
    backend/routers/suggestions.py \
    backend/routers/integrations.py \
    backend/routers/logs.py \
    backend/routers/bot.py \
    backend/routers/search.py \
    "$SERVER:$REMOTE_DIR/backend/routers/"

echo "==== [3/4] 同步前端构建产物 ===="
# 先传到小主机临时目录，再 docker cp 进 nginx 容器
ssh "$SERVER" "rm -rf /tmp/ecom_dist && mkdir -p /tmp/ecom_dist"
scp -r frontend/dist/. "$SERVER:/tmp/ecom_dist/"
ssh "$SERVER" "docker cp /tmp/ecom_dist/. nginx:/usr/share/nginx/html/ && rm -rf /tmp/ecom_dist"

echo "==== [4/4] 重启后端 ===="
ssh "$SERVER" bash << EOF
  cd $REMOTE_DIR/backend

  # 杀掉旧的 uvicorn（v2，端口 8002）
  OLD_PID=\$(ss -tlnp | grep :$BACKEND_PORT | grep -oP '(?<=pid=)\d+' | head -1)
  if [ -n "\$OLD_PID" ]; then
    echo "杀掉旧进程 PID=\$OLD_PID"
    kill \$OLD_PID
    sleep 1
  fi

  # 启动新进程
  nohup .venv/bin/uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/uvicorn_v2.log 2>&1 &
  NEW_PID=\$!
  echo "后端已启动，PID=\$NEW_PID，端口=$BACKEND_PORT"
  sleep 2

  # 健康检查
  if curl -sf http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo "健康检查通过 ✓"
  else
    echo "健康检查失败，查看日志：cat /tmp/uvicorn_v2.log"
    exit 1
  fi
EOF

echo ""
echo "==== 部署完成 ===="
echo "访问地址：http://192.168.0.112"
