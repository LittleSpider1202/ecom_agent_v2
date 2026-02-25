# CLAUDE.md — 电商智能运营平台 v2

每个 session 启动时自动加载本文件。严格遵守以下所有约束。

---

## 项目简介

电商智能运营平台 v2。详细产品规格见 `app_spec.md`。

- **后端**：Python + FastAPI
- **前端**：React + TypeScript + Tailwind CSS
- **数据库**：PostgreSQL + Redis（小主机）
- **测试**：Playwright（E2E）

---

## 开发模式：Autonomous Coding

本项目采用 autonomous-coding 模式，多 session 持续推进。

### Session 启动（强制执行，不可跳过）

每个新 session 必须按顺序执行以下步骤：

```
1. 读 app_spec.md（了解产品全貌）
2. 读 feature_list.json（了解进度，找下一个任务）
3. 读 claude-progress.txt（了解上一个 session 做了什么）
4. 读 docs/env-notes.md（了解已知环境事实和踩坑记录，避免重复试错）
5. 运行 git log --oneline -10（了解最近提交）
6. 确认当前分支，检查是否有未提交的变更
7. 运行 init.sh 确保服务已启动
```

完成以上步骤后，再开始工作。

### 回归验证（每次 session 必做）

启动后，先跑 1-2 个 `passes: true` 的核心测试，确认上个 session 没有引入回归：

- 如发现任何问题（功能或视觉），立即将对应条目改回 `passes: false`
- **先修复回归，再开始新 feature**
- 常见回归问题：白色文字在白色背景、布局溢出、按钮间距过小、console 报错、时间戳显示异常

### 每次 Session 只做一件事

- 从 `feature_list.json` 找最高优先级的 `"passes": false` 任务
- 专注实现该 feature，不要同时开多个
- 宁可本次 session 只完成一个 feature，也不要留下半成品

### Session 结束前（强制执行）

```
1. 确保所有代码已 commit
2. 更新 claude-progress.txt（本次做了什么，下次从哪继续）
3. 确保应用处于可运行状态（不留破损代码）
4. 将本次踩过的坑、发现的环境事实写入 docs/env-notes.md（见下方规则）
```

### 经验沉淀（每次 session 必做）

**目标：让后续 agent 不重复踩坑，不重复试错。**

每次 session 结束前，回顾本次遇到的问题，凡属于以下类型的发现，**必须写入 `docs/env-notes.md`**：

- 小主机环境事实（Python/Node 版本、已装的包、路径、命令别名）
- 某个命令在本机不可用但有替代方案（如 `python` → `python3`，或直接用 `node`）
- 数据库 schema 细节、字段约定、已存在的表结构
- 某个库的版本兼容问题或已知 bug 及 workaround
- 前端构建/测试的特殊配置或踩坑
- Playwright 测试的注意事项（selector 写法、等待时机等）
- 任何"我以为 X，结果是 Y"的认知纠正

**写入格式（追加到 `docs/env-notes.md`，不覆盖已有内容）**：

```markdown
## [日期] [发现者 session 简述]

- **发现**：具体事实描述
  - 背景：为什么会遇到这个
  - 结论：正确做法是什么
```

**不需要写入的内容**：当前任务的临时状态、已在代码中体现的实现细节。

**启动时**：读完 `claude-progress.txt` 后，也要快速浏览 `docs/env-notes.md`，避免重蹈覆辙。

---

## 上下文控制（严格执行）

**目标：保持上下文精简，避免污染。**

- 每次只加载当前任务必要的文件，禁止一次性读取整个代码库
- 大文件（app_spec.md、feature_list.json）按需读取相关章节，不全量加载
- 用文件路径+行号引用代码，而非把代码贴进上下文
- **当上下文使用超过 50% 时，停止实现新功能，提示用户开启新 session**
- 跨模块的问题，优先通过读文件定向查找，而非依赖记忆

**懒加载原则**：
- 需要了解某个模块时，先读目录结构，再按需读具体文件
- 不确定某文件是否需要时，先问用户，再读

---

## 分支与 PR 规范

```
main（稳定，全绿）
  └── feature/{page-id}-{short-name}
      例：feature/EW-04-human-step
          feature/MW-03-flow-editor
          feature/tool-executor
```

- 每个 feature 在独立分支开发
- 实现完成 + 测试通过后，开 PR 合并到 main
- PR 触发 CI 自动跑回归测试（GitHub Actions，自托管 Runner）
- 回归全绿后才能合并

---

## 测试规范

### 实现 feature 的完整流程

```
1. 实现功能代码
2. 在 tests/feature-NNN.spec.ts 写对应 Playwright 测试
   （NNN 对应 feature_list.json 的 index，补零对齐，如 005）
3. 本地运行测试，通过
4. 截图存入 verification/ 目录作为证据
5. 更新 feature_list.json：将对应项 "passes" 改为 true
6. commit（代码 + 测试文件 + 截图一起提交）
```

### 测试要求

- **必须通过 UI 验证**，不接受仅 curl / 单元测试
- 测试必须模拟真实用户操作（点击、输入、滚动）
- 验证功能行为 + 视觉外观
- 检查浏览器 console 无报错

### feature_list.json 格式与规则

每个条目格式：
```json
{
  "index": 1,
  "category": "functional",
  "description": "功能描述",
  "steps": [
    "Step 1: 导航到页面",
    "Step 2: 执行操作",
    "Step 3: 验证结果"
  ],
  "passes": false
}
```

- `category` 分两类：`functional`（功能验证）和 `style`（UI 视觉验证）
- `index` 对应测试文件名 `tests/feature-NNN.spec.ts`（补零对齐）
- **只能将 `"passes": false` 改为 `"passes": true`**
- 禁止删除、修改描述、修改测试步骤、调整顺序
- 未通过测试不得标记 passes: true

### 回归测试

- 每次 PR 前，运行全部 `passes: true` 对应的测试文件
- 任何回归失败，先修复再合并

---

## 禁止事项

- ❌ 禁止依赖影刀、RPA 软件
- ❌ 禁止直接 copy v1 代码（可参考，必须重写）
- ❌ 禁止在对话中讨论架构变更（变更须直接修改 app_spec.md）
- ❌ 禁止跳过 Session 启动步骤
- ❌ 禁止在未通过测试的情况下标记 passes: true
- ❌ 禁止一次性实现多个 feature
- ❌ 禁止留下无法运行的代码就结束 session

---

## 技术栈

不另立文档。技术栈从代码本身读取：`package.json`（前端）、`requirements.txt`（后端）、`docker-compose.yml`（部署）。

---

## 关键文件说明

| 文件 | 职责 | 注意 |
|------|------|------|
| `app_spec.md` | 产品完整描述，唯一需求来源 | 写完冻结，变更需注明版本 |
| `CLAUDE.md` | 本文件，工作约束 | 每个 session 自动加载 |
| `feature_list.json` | 功能进度追踪，唯一数据源 | 只能改 passes 字段 |
| `claude-progress.txt` | Session 交接棒 | 每次 session 结束前更新 |
| `init.sh` | 一键启动开发环境 | 每个 session 启动时运行 |
| `tests/feature-NNN.spec.ts` | feature 的可执行验收测试 | 与 feature 同步提交 |
| `verification/` | 测试截图存档 | 作为 passes:true 的证据 |
| `prototype/index.html` | 页面原型导航入口 | 只读，不修改 |

---

## 运行环境（小主机）

应用运行在局域网小主机上，开发者本地写代码，push 到 GitHub，小主机 pull 后运行。

**SSH 连接**
```
ssh hz@192.168.0.112
```
> IP 为 DHCP，如连不上先确认当前 IP。密码通过 SSH 密钥免密登录，或运行 `scripts/ssh-login.sh`。

**代码同步**
```
# 本地开发完成后
git push

# 小主机拉取并重启服务
ssh hz@192.168.0.112
cd /path/to/ecom_agent_v2
git pull
# 重启后端 / 重新构建前端（具体命令待工程初始化后补充）
```

**Docker 服务**

| 容器 | 端口 | 用途 |
|------|------|------|
| pg | 5432 | PostgreSQL 17 |
| redis | 6379 | Redis |
| nginx | 80 | 前端入口 |
| n8n | 5678 | 工作流（备用） |

**数据库**

| 库名 | 用户 | 密码 |
|------|------|------|
| ecom_agent | ecom | ecom2026 |

---

## v1 参考路径

v1 项目在 `/d/ai/ecom_tools/ecom_agent/`，仅供参考，不直接复用代码。
重点参考：生意参谋采集逻辑、Redis 队列设计、PostgreSQL schema。
