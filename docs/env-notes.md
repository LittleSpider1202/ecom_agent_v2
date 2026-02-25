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

<!-- 后续 session 在此追加 -->
