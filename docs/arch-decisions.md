# 架构决策记录

> 记录关键技术选型和架构决策，以及选择的原因。后续 agent 修改相关模块前先看这里。

---

## [2026-02-25] 认证方案

- **决策**：JWT 存入 `localStorage`，不用 httpOnly cookie
  - 原因：前端 SPA 跨域场景简单，避免 CSRF 配置复杂度
  - 位置：`frontend/src/contexts/AuthContext.tsx`

- **决策**：密码哈希直接用 `bcrypt`，不用 `passlib`
  - 原因：`passlib` 与 `bcrypt 5.x` 不兼容（AttributeError + 72字节限制 bug）
  - 用法：`bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()`
  - 位置：`backend/auth.py`

- **决策**：前端路由鉴权用 `PrivateRoute` + `AppLayout` 统一包裹
  - 原因：所有页面都需要登录，管理工作台额外需要 manager 角色
  - 用法：新增页面直接用 `<ProtectedLayout>` 或 `<ProtectedLayout requiredRole="manager">`
  - 位置：`frontend/src/App.tsx`

---

## [2026-02-25] 后端结构

- **决策**：SQLAlchemy + psycopg2，不用异步 ORM（asyncpg/SQLModel）
  - 原因：项目初期复杂度可控，同步 ORM 调试更简单
  - 位置：`backend/database.py`

- **决策**：启动时自动 seed 默认用户（admin/manager/executor）
  - 原因：多 agent 协作，避免每次手动建测试账号
  - 位置：`backend/main.py` startup 事件

---

## [2026-02-26] 测试方案

- **决策**：Playwright `workers: 1`，顺序运行
  - 原因：并发 3 worker 时 DB 连接池冷启动导致登录超时，测试 flaky
  - 效果：20 条测试约 20 秒，速度可接受，彻底消除随机失败
  - 位置：`tests/playwright.config.ts`

- **决策**：`global.setup.ts` 统一预热登录，各 spec 复用 storageState
  - 原因：避免每个 spec 重复登录逻辑，减少冗余代码
  - 位置：`tests/global.setup.ts`、`tests/playwright.config.ts`

- **决策**：后端端口改为 8001
  - 原因：8000 端口因 uvicorn `--reload` 子进程残留难以释放，换端口规避冲突
  - 影响：`vite.config.ts` proxy target 同步改为 `http://localhost:8001`

---

<!-- 后续 session 在此追加 -->
