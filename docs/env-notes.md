# 环境笔记 — 踩坑记录与环境事实

> 每次 session 结束前追加新发现。启动时快速浏览，避免重复试错。

---

## [2026-02-25] Initializer Session

- **发现**：本地开发机（Windows/MINGW64）`python` 命令不可用
  - 背景：Windows App Execution Aliases 导致 `python`/`python3` 都指向 Microsoft Store 提示
  - 结论：**用 `node` 做 JSON 处理等脚本任务**；如需 Python，确认虚拟环境激活后用 `.venv/Scripts/python`

- **发现**：`node` 可用（前端工具链正常）
  - 结论：JSON 合并、格式验证等用 `node -e "..."` 代替 Python 脚本

- **发现**：小主机数据库连接信息
  - PostgreSQL: `postgresql://ecom:ecom2026@192.168.0.112:5432/ecom_agent`
  - Redis: `redis://192.168.0.112:6379/0`
  - 小主机 IP 为 DHCP，如连不上先 `ping 192.168.0.112` 确认

- **发现**：后端默认种子用户（`main.py` startup 事件自动创建）
  - `admin` / `admin123`（role: admin）
  - `manager` / `manager123`（role: manager）
  - `executor` / `executor123`（role: executor）
  - 结论：Playwright 测试直接用这三个账号，无需手动创建

- **发现**：前端路由已集成 AuthContext + PrivateRoute + AppLayout
  - App.tsx 已有 `ProtectedLayout` 包裹所有路由，`/manage/*` 需要 manager 角色
  - 结论：新增页面直接用 `<ProtectedLayout>` 包裹即可，无需重新实现鉴权逻辑

- **发现**：`init.sh` 假定 Linux/Mac 环境（`source .venv/bin/activate`）
  - Windows MINGW64 下需要 `.venv/Scripts/activate`，`init.sh` 已做兼容处理
  - 结论：在 MINGW64 终端运行 `bash init.sh` 即可

---

## [2026-02-25] Session 2 — 认证模块实现

- **发现**：Python 可用，但路径不在 PATH 中
  - 背景：`python`/`python3` 指向 Windows Store 空壳，均无法直接使用
  - 结论：完整路径 `C:/Users/huzhe/AppData/Local/Python/bin/python.exe`（Python 3.14.2）可用
  - venv 创建：`C:/Users/huzhe/AppData/Local/Python/bin/python.exe -m venv .venv`
  - 激活后 pip/uvicorn 在 `.venv/Scripts/` 下

- **发现**：`passlib[bcrypt]` 与新版 `bcrypt 5.x` 不兼容
  - 背景：passlib 调用 bcrypt 时抛 `AttributeError: module 'bcrypt' has no attribute '__about__'`，以及 `ValueError: password cannot be longer than 72 bytes`
  - 结论：**不用 passlib**，直接 `import bcrypt`；用 `bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()` 和 `bcrypt.checkpw(pwd.encode(), hash.encode())`

- **发现**：本机全局 HTTP 代理 `http_proxy=http://127.0.0.1:7897`（Clash 等）会拦截 localhost 请求
  - 背景：`curl http://localhost:8000` 返回 502；Vite dev server 的 Node.js proxy 也会继承此代理，导致 `/api` 转发到后端失败，浏览器端登录请求卡住
  - 结论：
    - curl 测试加 `--noproxy '*'`
    - 启动 Vite 时必须设 `NO_PROXY="localhost,127.0.0.1"`：
      ```bash
      NO_PROXY="localhost,127.0.0.1" npm run dev -- --port 3000
      ```
    - 运行 Playwright 测试同理：
      ```bash
      NO_PROXY="localhost,127.0.0.1" npx playwright test feature-161.spec.ts
      ```

- **发现**：端口冲突 — 旧 Vite 进程未被 kill 时，新实例自动切换到 3001
  - 背景：多次 `run_in_background` 启动 Vite，旧进程残留占用 3000
  - 结论：启动前用 `netstat -ano | grep ":3000"` 检查；用 `Stop-Process -Id PID -Force` 杀进程（Windows `kill` 命令无效）

- **发现**：小主机不在同一局域网时后端无法启动（DB 连接超时）
  - 背景：PostgreSQL 和 Redis 在小主机上，出门后 192.168.0.112 不可达
  - 结论：出门时只能开发前端代码，不能运行后端和测试

## [2026-02-26] Session 3 — EW-01/02 测试验证

- **发现**：uvicorn `--reload` 模式下，`TaskStop` 只杀 reloader 进程，server 子进程残留
  - 背景：多次启动后端后，老的 server 进程仍占用 8000 端口，无法用 `kill`/`Stop-Process` 杀掉
  - 结论：
    - 使用 `kill_8000.ps1` 脚本（Get-NetTCPConnection + Stop-Process）
    - 或改用不同端口（本次换为 8001），同步更新 `vite.config.ts` proxy target
    - `stop-process` 命令里 `$pid` 是保留变量，要换成 `$proc`

- **发现**：Playwright `workers:3` 并发 3 个登录请求，会导致部分请求超过 10s timeout（DB 连接池冷启动）
  - 背景：测试结果 "flaky" — 第一次超时，retry 成功
  - 结论：**设 `workers: 1`** 顺序运行，20 条测试仍只需 20 秒，彻底消除 flaky
  - 额外：`globalSetup` 预热只有 1 个 browser，效果有限；workers:1 才是根本解法

- **发现**：Playwright 中用全局 `page.locator('span.rounded-full')` 会匹配整个页面的所有圆形标签
  - 背景：feature-007 Badge 检查匹配到 header 等其他区域的元素
  - 结论：badge 检查要限定在目标容器内，例如 `rows.first().locator('span.rounded-full')`

- **发现**：vite.config.ts proxy 中 target 改为 8001 后，前端必须重启才生效（vite 不会热重载 config 更改）
  - 结论：改 vite.config.ts 后需手动重启 vite 进程

## [2026-02-26] Session 3 补充

- **发现**：Playwright 测试加了 `global.setup.ts`，统一做登录预热
  - 背景：每个 spec 文件单独登录浪费时间，且冷启动容易超时
  - 结论：`playwright.config.ts` 已配置 `globalSetup: './global.setup.ts'`，测试直接用 storageState，不需要在每个 spec 里重复登录

## [2026-02-26] Session 4 — 小主机部署

- **发现**：小主机无法访问 GitHub（网络不通）
  - 背景：`git pull origin dev` 在服务器上超时（443 连不上）
  - 结论：代码更新必须从本地 SCP 传输；新文件可直接 SSH echo 写入

- **发现**：小主机 v1 应用占用 8000 端口（`/opt/ecom_agent`，user=ecom，systemd 服务）
  - 结论：v2 后端改用 **8002** 端口，不要动 8000

- **发现**：ufw 防火墙不自动开放新端口，Docker 容器内无法访问宿主机新端口
  - 背景：nginx 容器内 `curl 172.17.0.1:8002` 超时 → 504
  - 结论：`sudo ufw allow 8002/tcp` 后立即生效

- **发现**：小主机现有 nginx 容器已配好 SPA + `/api` 反代
  - 结论：更新前端只需 `docker cp dist/. nginx:/usr/share/nginx/html/`，更新 proxy 端口改 default.conf 后 `nginx -s reload`

- **发现**：SSH 长连接容易断（Connection reset by peer），长任务必须用 nohup
  - 结论：`nohup bash -c '...' &disown` 后用 `cat /tmp/xxx.log` 查进度

- **发现**：前端构建需要 `src/vite-env.d.ts`，否则 TypeScript 报 `Cannot find module './index.css'`
  - 结论：文件内容 `/// <reference types="vite/client" />`，已加入 git

- **发现**：小主机端口占用情况（2026-02-26）
  - 80: nginx容器, 8000: v1应用, 3000: metabase, 8080: nocodb, 9000: portainer
  - 5432: pg容器（ecom库）, 6379: redis容器
  - v2 用 8002（后端）+ 80（复用 nginx 前端）

<!-- 后续 session 在此追加 -->
