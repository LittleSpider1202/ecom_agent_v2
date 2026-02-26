# 开发环境说明

> 引入新中间件或环境发生变更时，更新本文件。

---

## 本地开发机

- OS：Windows 11 + MINGW64（Git Bash）
- Node：可用（`node -e "..."` 正常）
- Python：不在 PATH，用完整路径 `C:/Users/huzhe/AppData/Local/Python/bin/python.exe`（3.14.2）
- 全局 HTTP 代理：Clash，`http_proxy=http://127.0.0.1:7897`
  - **影响**：所有 localhost 请求必须加 `NO_PROXY="localhost,127.0.0.1"`
  - 启动前端：`NO_PROXY="localhost,127.0.0.1" npm run dev`
  - 运行测试：`NO_PROXY="localhost,127.0.0.1" npx playwright test`
  - curl 测试：`curl --noproxy '*' http://localhost:8001`

---

## 服务端口

| 服务 | 端口 | 备注 |
|------|------|------|
| 前端 Vite dev server | 3000 | `frontend/` |
| 后端 FastAPI | 8001 | `backend/`，8000 容易被残留进程占用 |
| PostgreSQL | 5432 | 小主机 Docker |
| Redis | 6379 | 小主机 Docker |

---

## 小主机

- IP：192.168.0.112（DHCP，不在同一局域网时不可达）
- SSH：`ssh hz@192.168.0.112`
- Docker 服务：pg / redis / nginx / n8n（见 CLAUDE.md）

**出门时替代方案**：本地起 Docker 数据库

```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=ecom_agent -e POSTGRES_USER=ecom -e POSTGRES_PASSWORD=ecom2026 \
  postgres:17
docker run -d -p 6379:6379 redis
```

然后将 `backend/.env` 中数据库地址改为 `localhost`。

---

## 后端启动

```bash
cd backend
.venv/Scripts/uvicorn.exe main:app --reload --host 0.0.0.0 --port 8001
```

- 虚拟环境：`backend/.venv`（Python 3.14.2）
- 依赖安装：`.venv/Scripts/pip install -r requirements.txt`
- 端口冲突处理：运行 `kill_8000.ps1`（项目根目录），或手动 `Get-NetTCPConnection -LocalPort 8001 | Stop-Process`

---

## 前端启动

```bash
cd frontend
NO_PROXY="localhost,127.0.0.1" npm run dev -- --port 3000
```

- proxy 配置：`vite.config.ts` → `/api` 转发到 `http://localhost:8001`
- 改 `vite.config.ts` 后需手动重启，热重载不覆盖配置文件

---

## 测试环境（Playwright）

```bash
cd tests
NO_PROXY="localhost,127.0.0.1" npx playwright test --reporter=list
```

- 配置文件：`tests/playwright.config.ts`
- 全局登录预热：`tests/global.setup.ts`（统一做登录，各 spec 复用 storageState）
- `workers: 1`（顺序运行，避免 DB 冷启动 flaky）
- 截图存档：`verification/`

---

## 依赖版本（关键）

| 依赖 | 版本 | 注意 |
|------|------|------|
| bcrypt | 直接用，不经 passlib | passlib 与 bcrypt 5.x 不兼容 |
| uvicorn | `[standard]` | 带 websocket 支持 |
| playwright | 1.49.1 | Chromium 已下载到本机 |
