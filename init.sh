#!/bin/bash
# init.sh — 一键启动开发环境
# 数据库（PostgreSQL + Redis）运行在小主机，无需本地启动
# 本脚本启动：后端 FastAPI + 前端 React dev server

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "========================================="
echo "  电商智能运营平台 v2 — 开发环境启动"
echo "========================================="

# 检查依赖
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "[ERROR] $1 未安装，请先安装后重试"
    exit 1
  fi
}

check_command python3
check_command node
check_command npm

# ---- 后端启动 ----
echo ""
echo "[后端] 检查 Python 虚拟环境..."
if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "[后端] 创建虚拟环境..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi

echo "[后端] 激活虚拟环境并安装依赖..."
source "$BACKEND_DIR/.venv/bin/activate" 2>/dev/null || source "$BACKEND_DIR/.venv/Scripts/activate"

pip install -q -r "$BACKEND_DIR/requirements.txt"

echo "[后端] 启动 FastAPI 开发服务器 (port 8000)..."
cd "$BACKEND_DIR"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# ---- 前端启动 ----
echo ""
echo "[前端] 检查 node_modules..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "[前端] 安装依赖..."
  cd "$FRONTEND_DIR"
  npm install
  cd "$ROOT_DIR"
fi

echo "[前端] 启动 React 开发服务器 (port 3000)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

# ---- 打印访问地址 ----
sleep 3
echo ""
echo "========================================="
echo "  服务已启动："
echo "  前端: http://localhost:3000"
echo "  后端 API: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo ""
echo "  数据库连接（小主机）："
echo "  PostgreSQL: 192.168.0.112:5432 (ecom_agent)"
echo "  Redis: 192.168.0.112:6379"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "========================================="

# 等待并在退出时清理
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
