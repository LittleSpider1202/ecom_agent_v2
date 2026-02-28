# 环境笔记 — 踩坑记录与环境事实

> **写入规则**：按主题组织，不按时间追加。
> 写入前先搜索已有主题，有则原地补充，无则新增章节。
> 每个主题只有一份，避免重复。

---

## Python / 命令行环境

- `python` / `python3` 命令在 Windows MINGW64 下指向 Microsoft Store 空壳，**不可用**
- 完整可用路径：`C:/Users/huzhe/AppData/Local/Python/bin/python.exe`（Python 3.14.2）
- venv 创建：`C:/Users/huzhe/AppData/Local/Python/bin/python.exe -m venv .venv`
- 激活后 pip/uvicorn 在 `.venv/Scripts/` 下
- **JSON 处理等脚本任务改用 `node -e "..."`**，不依赖 Python

---

## 代理 / NO_PROXY（必读）

- 本机全局 HTTP 代理 `http_proxy=http://127.0.0.1:7897`（Clash）会拦截 localhost 请求
- 影响：`curl http://localhost:8001` 返回 502；Vite proxy 转发 `/api` 失败；Playwright 请求超时
- **所有涉及 localhost 的命令必须加 `NO_PROXY`**：
  ```bash
  # 后端
  NO_PROXY="localhost,127.0.0.1" .venv/Scripts/uvicorn.exe main:app --port 8001
  # 前端
  NO_PROXY="localhost,127.0.0.1" npm run dev -- --port 3000
  # 测试
  NO_PROXY="localhost,127.0.0.1" npx playwright test
  # curl
  curl --noproxy '*' http://localhost:8001/health
  ```

---

## uvicorn 进程管理

- **不要加 `--reload`**：reload 模式下存在多个子进程互相复活，`kill` / `taskkill` 无法彻底释放端口
- `$pid` 是 PowerShell 保留变量，脚本里用 `$proc` 代替
- 正确做法：使用 `kill_8001.ps1` 脚本（Get-NetTCPConnection + Stop-Process），启动时不加 `--reload`
- 本地开发固定用 **8001** 端口（8000 被小主机 v1 应用占用，8002 是小主机 v2 端口）

---

## Vite / 前端进程

- 旧 Vite 进程残留时，新实例自动切换到 3001/3002，导致测试打到错误端口
- 启动前检查：`netstat -ano | grep ":3000"`，用 `Stop-Process -Id PID -Force` 杀掉旧进程
- 修改 `vite.config.ts` 后必须**手动重启** Vite（不会热重载 config 文件）

---

## SQLAlchemy / 数据库

- `Base.metadata.create_all` 只**创建缺失的表**，不会 ALTER 已有表，开发阶段无需 alembic
- 新增 Model class 并 import 进 `main.py` 后，下次启动自动建表
- 种子数据防重复：每类用 `if db.query(Model).count() == 0:` 独立判断
- 针对特定任务的种子：用 `if db.query(Model).filter(Model.task_id == task.id).count() == 0:` 判断
- 重置 TaskStep 状态时**必须同时重置 TaskInstance.status**：
  - `submit_step` 会把 task.status 改为 "completed"，不重置则任务从"进行中"列表消失
  - startup 重置：`TaskStep → pending`、`TaskInstance.status → pending`、`has_human_step → True`

---

## 小主机环境

- SSH：`ssh hz@192.168.0.112`（DHCP，连不上先 `ping` 确认 IP）
- 小主机**无法访问 GitHub**，代码更新必须从本地 SCP 传输
- 端口占用（勿动）：80=nginx, 8000=v1应用, 3000=metabase, 8080=nocodb, 9000=portainer, 5432=pg, 6379=redis
- v2 用：8002（后端）+ 80（复用 nginx 前端）
- ufw 不自动开放新端口：`sudo ufw allow 8002/tcp`
- nginx 容器更新前端：`docker cp dist/. nginx:/usr/share/nginx/html/`
- SSH 长连接易断，长任务用 `nohup bash -c '...' &disown`
- 每次新增 router 文件，**必须同步更新 `deploy.sh` 的 scp 命令**，否则小主机 ImportError

---

## 后端 / FastAPI

- 密码哈希：`passlib[bcrypt]` 与 `bcrypt 5.x` 不兼容（AttributeError + 72字节限制 bug）→ 直接 `import bcrypt`
- FastAPI 路由参数若需同时接受字符串和数字（如 step_id="current" 或整数），用 `str` 类型接收，函数体内分支处理
- 本地不在局域网时后端无法启动（PostgreSQL/Redis 连接超时），出门只能开发前端

---

## 前端 / React

- 前端路由鉴权：所有页面已有 `ProtectedLayout` 包裹，新增页面直接用即可，无需重新实现
  - 管理工作台：`<ProtectedLayout requiredRole="manager">`
- localStorage token key：**`auth_token`**（不是 `token`），user key：**`auth_user`**
- 前端构建需要 `src/vite-env.d.ts`，内容：`/// <reference types="vite/client" />`

---

## ReactFlow v12 (@xyflow/react)

- CSS 引入：`import '@xyflow/react/dist/style.css'`
- Handle 属性：v12 用 `data-handlepos="bottom"/"top"`，v11 的 `data-handletype` 已移除
- 必须用 `ReactFlowProvider` 包裹才能使用 `useReactFlow()` hook
- **Playwright 测试节点点击**：ReactFlow pane（`react-flow__pane draggable`）覆盖画布，会拦截 Playwright 鼠标事件，`.click()` 和 `.click({ force: true })` 均无效
  - 解决：`page.evaluate(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))`
- **Playwright 验证 edge 存在**：`.react-flow__edge` 是 SVG `<g>`，`toBeVisible()` 报 hidden
  - 解决：`await page.locator('[data-testid^="rf__edge-"]').count()` 用 count 验证

---

## Playwright 测试

- **workers 必须设为 1**：并发 3 worker 时 DB 连接池冷启动导致登录超时（flaky）
- **登录用 API programmatic 方式**，不用 UI 表单（retry 时 browser context 残留状态易超时）：
  ```typescript
  await page.goto('/login', { waitUntil: 'domcontentloaded' })  // 建立 origin context
  const res = await page.request.post('http://localhost:8001/api/auth/login', {
    form: { username: 'executor', password: 'executor123' },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: access_token, user })
  ```
- **`localStorage` 只在浏览器上下文可用**：`page.request.get/post()` 在 Node.js 上下文运行，无法访问 localStorage
  - 需要带认证调用 API 时，用 `page.request.post()` 重新登录取 token，或用 `page.evaluate()` 在浏览器端 fetch
- **selector 要限定容器**：`page.locator('span.rounded-full')` 会匹配全页，应限定到目标容器内
- `global.setup.ts` 已配置统一预热登录，各 spec 可复用 storageState

---

## 种子数据 / 测试数据

- 默认用户（startup 自动创建）：`admin/admin123`、`manager/manager123`、`executor/executor123`
- `/api/tasks/my` 返回 `{ pending: [...], running: [...], pending_count, running_count }`，**不是平铺数组**
- MW-01 健康分值颜色用 `style={{ color: '#22c55e' }}` inline，不是 Tailwind class → 测试用 `getAttribute('style')` 检查
- 任务行点击根据 `has_human_step` 分流：`true` → HumanStep，`false` → TaskDetail（`/executor/tasks/:id`）
- Flow 种子数据判断：用 `if not db.query(Flow).filter(Flow.name == "采购审核流程").first():`，不能用 `count() == 0`（测试运行后 Flow 表已有数据）
- ReactFlow 测试：`.react-flow` / `[class*="react-flow"]` 会命中 19 个子元素（strict mode violation）→ 改用 `getByTestId('rf__wrapper')` 定位根节点
- **`getByText()` strict mode violation**：侧边栏导航中也有相同文字（如"知识贡献"出现在 nav 和 h1 中）→ 改用 `getByRole('heading', { name: '...' })` 定位页面标题
- **`getByText()` 多元素**：列表中多个 item 都有相同文字（如多条"待审核"状态 badge）→ 加 `.first()` 或用 `.nth(i)` 取特定元素
- **`data-testid` 前缀冲突**：`[data-testid^="entry-"]` 会匹配 `data-testid="entry-list"` 容器 → 容器用不同前缀（如 `knowledge-list`），或只给 item 加 `data-testid`
- **filter locator 在 toggle 后失效**：`row.filter({has: locator('已启用')})` 在 toggle 后该 filter 不再匹配，导致子元素 "element(s) not found" → 改用 page 级别 `page.locator('[data-testid="xxx"]')` 直接查

## CSS group-hover + Playwright

- Tailwind `hidden group-hover:flex` → display:none; even `force: true` click fails
- Solution: change to always-visible `flex` for admin pages; OR use `page.evaluate()` to dispatch click
- `[data-testid^="dept-node-"]`.filter({hasText: 'X'}) matches PARENT nodes too (nested text) → use `[data-testid^="dept-name-"]`.filter({hasText: /^X$/}) to get exact match, then extract id from testid attribute

## 数据库 Schema 迁移

- `Base.metadata.create_all()` 只建表，**不添加新列**到已有表
  - 结论：新增列须手动运行 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
  - 示例：`conn.execute(text('ALTER TABLE tools ADD COLUMN IF NOT EXISTS config JSONB'))`
- uvicorn 启动时若表中缺列会立即报 `sqlalchemy.exc.ProgrammingError: column xxx does not exist` → 查 log 排查

## 工具执行测试 — ERP工具被禁用问题

- 之前的 ToolManagement 测试会调用 `/api/tools/{id}/toggle` 禁用工具
- 导致 ERP库存查询、竞品数据采集 等工具 `enabled=False`，executor无法查到
- **解决**：测试中先用 manager 获取 `/api/tools/all`（含disabled），若 enabled=False 先 PATCH toggle，再用 executor 执行
- 种子数据 `enabled=True` 不保证运行时仍为True（会被其他测试改变）

## Playwright 全局 Toast 测试模式

- 在 AppLayout.tsx 用 `window.__showToast` 暴露全局 toast 方法（useEffect注册/清理）
- 子页面通过 `(window as unknown as Record<...>).__showToast?.(msg, 'success')` 触发
- Playwright 测试等待 `[data-testid="global-toast"]` toBeVisible（timeout 3000ms 内消失）

## Playwright intercept + 加载状态测试

- `page.route('**/api/tasks/my', async route => { await delay(800); await route.continue() })`
- 在 goto 之前注册 route，page 加载期间 API 被延迟
- 用 `page.locator('body').innerText()` 获取渲染后文本（不用 `page.content()` 返回静态HTML）

## 工作流引擎 — should_fail 节点模拟

- 在 flow 节点 data 中加 `should_fail: true`，trigger_flow 会将该节点状态设为 "failed"，任务整体 = "failed"
- bot告警：type="alert"，target_user="manager"
- condition节点同时有 should_fail 不处理（skip优先）

## FlowEditor 节点点击行为

- `onNodeClick` → 仅设置 `selectedNode`，不打开配置面板
- `onNodeDoubleClick` → 设置 `selectedNode` + `setConfigOpen(true)`
- Playwright 触发双击：`page.evaluate(() => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))`
- 节点选择器：`[data-testid="node-{type}"]`（type: auto/human/condition/feishu_notify）

## FlowEditor 节点类型扩展

- 添加新节点类型需要：1) 新建 `XxxNode` 组件，2) 加入 `nodeTypes` 映射，3) 加入 `PANEL_NODES`，4) 加入 `DEFAULT_LABELS`，5) 在 ConfigPanel 中加 `{data.nodeType === 'xxx' && (...)}`
- 节点面板颜色 `color: 'green'` 需要同时更新面板卡片的 className 条件（blue/orange/green/purple）

## global.setup.ts 预热登录

- 旧版用 UI form 登录（`page.fill`），在新 session 中偶发 timeout（proxy 未bypass）
- **正确做法**：在 `globalSetup` 中用 programmatic API 登录（`page.request.post` + `page.evaluate`），与测试中一致
- chromium launch 需传 `args: ['--proxy-bypass-list=localhost,127.0.0.1']`

## React state 变量名冲突

- 在组件中既有 `const [now, setNow] = useState(Date.now())` 又有 `const now = Date.now()`（原有代码），编译报 `Identifier 'now' has already been declared`
- 结论：添加 state 前先搜索文件中是否已有同名 `const`，如有则删除原有的 const（使用 state 值代替）

## 知识贡献审核（KnowledgeReview）

- 后端 `knowledge.py` 已有 `KnowledgeSubmission` model，status=pending/approved/rejected
- 新增3个端点：GET `/api/knowledge/submissions/pending`，POST `/{id}/approve`，POST `/{id}/reject`
- approve 时自动创建 KnowledgeEntry（type=new）或更新现有词条（type=correction）
- 前端页面：`/manage/knowledge-review`，需要在 App.tsx 中注册路由

## Vite proxy 切换历史

- Session 14 开始：vite.config.ts proxy target 改为 `http://192.168.0.112:8002`（本地后端无法稳定启动）
- 测试直接用 API_URL = 'http://192.168.0.112:8002'（不走proxy）
- 如需本地开发，改回 `http://localhost:8001` + 确保DB连接不超时
- **陷阱**：新建前端页面如用硬编码 `http://localhost:8001` 会绕过 Vite proxy → 导致邀请等 API 失败
  - 结论：前端组件的 fetch 必须用相对路径 `''`（空字符串），让 `/api/...` 经过 Vite proxy

## FlowVersions 回滚对话框 data-testid 注意

- 点击列表项"回滚"按钮后，同时出现：列表内联确认按钮 + 全屏遮罩对话框
- 列表内联确认按钮被遮罩拦截，Playwright 无法点击
- 解决：只给遮罩对话框内的确认按钮设 `data-testid="confirm-rollback-v{n}"`；列表内联按钮不设 testid

## Playwright #206 搜索按钮 disabled 陷阱

- `/executor/knowledge` 页面有多个 `button[type="submit"]`，其中知识库搜索按钮可能为 disabled
- 用宽泛的 `button[type="submit"]` 选择器会命中错误按钮，导致 click 超时
- 结论：知识库搜索直接用 `keyboard.press('Enter')` 代替点击按钮

## Bot 通知 API 路由

- 路由前缀是 `/api/bot`（单数），**不是** `/api/bots`（复数）
- `GET /api/bot/notifications` 返回 `{"notifications": [...], "total": ...}`（对象），不是平铺数组
- 用 `(botsRes.notifications || [])` 取数组
- 此接口需要认证；在测试中用 `page.evaluate` + `fetch` 在浏览器上下文调用（附带 localStorage token）

## Login.tsx React anti-pattern 修复

- 原代码在 render 期间直接调用 `navigate()` → React Warning: "Cannot update a component while rendering a different component"
- Playwright 的 console error 监听会捕获 React Warning（console.error level）
- 修复：把 `navigate` 调用移入 `useEffect(() => { if (user) navigate(...) }, [user, ...])`
- 保留 `if (user) return null` 作为渲染优化（不调用 navigate，只避免渲染表单）

## Playwright route interception + networkidle 时序

- `page.route()` 拦截后，若用 `waitUntil: 'networkidle'`，Playwright 会等所有网络请求静止
- 如果测试需要先看到「进行中」状态再等「成功」：
  - 注册 route 返回「running」（前几次）+ 「success」（之后）
  - 用 `waitUntil: 'load'` 代替 `networkidle`，避免等到轮询完成才继续
  - 然后 `await expect(status).toHaveText('进行中')` 快速捕获第一状态
  - 再等 `await expect(status).toHaveText('成功', { timeout: 10000 })`

