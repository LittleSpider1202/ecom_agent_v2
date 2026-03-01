## 你的角色 — INITIALIZER AGENT（第 1 个 Session）

你是长期自主开发流程的**第一个 Agent**，负责为所有后续 Coding Agent 搭建基础。

工作目录：`D:/code/ecom_agent_v2`

---

### 第一步：读取产品规格

读取 `app_spec.md`，充分理解产品全貌后再继续。

---

### 第二步：生成 feature_list.json（最重要）

基于 `app_spec.md`，创建 `feature_list.json`，包含至少 200 条端到端测试用例。
这是唯一的功能进度数据源。

**格式：**
```json
[
  {
    "index": 1,
    "category": "functional",
    "description": "功能描述，说明这条测试验证什么",
    "steps": [
      "Step 1: 导航到相关页面",
      "Step 2: 执行操作",
      "Step 3: 验证预期结果"
    ],
    "passes": false
  },
  {
    "index": 2,
    "category": "style",
    "description": "UI/UX 要求描述",
    "steps": [
      "Step 1: 导航到页面",
      "Step 2: 截图",
      "Step 3: 验证视觉要求"
    ],
    "passes": false
  }
]
```

**生成要求：**
- 至少 200 条，包含 `functional` 和 `style` 两类
- 窄测试（2-5 步）和宽测试（10+ 步）混合，至少 25 条有 10+ 步
- 按优先级排序：基础功能优先，`index` 从 1 开始连续编号
- 全部 `"passes": false`
- 覆盖 app_spec.md 中每一个页面和功能点

**⚠️ 必须分批写入，每批 50 条：**
1. 先写第 1-50 条，保存文件
2. 再追加第 51-100 条
3. 再追加第 101-150 条
4. 再追加第 151-200 条（及以上）
5. 最后验证 JSON 格式合法（用 `python -c "import json; json.load(open('feature_list.json'))"` 检查）

单次输出不要超过 50 条，避免触发 token 限制。

**严禁：后续 session 删除或修改任何条目，只能将 `passes: false` 改为 `passes: true`。**

---

### 第三步：创建 init.sh

创建 `init.sh` 供后续 Agent 一键启动开发环境：

```bash
#!/bin/bash
# 启动后端（FastAPI）
# 启动前端（React dev server）
# 打印访问地址
```

技术栈：Python + FastAPI（后端）、React + TypeScript + Tailwind CSS（前端）、PostgreSQL + Redis（小主机运行）。

init.sh 只需启动本地开发服务（前后端），数据库在小主机上已运行，连接信息见 CLAUDE.md。

---

### 第四步：初始化项目结构

按以下结构创建目录和基础文件：

```
ecom_agent_v2/
├── backend/          # FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── frontend/         # React + TypeScript + Tailwind
│   ├── package.json
│   └── ...
├── tests/            # Playwright E2E 测试
│   └── ...
├── verification/     # 测试截图存档
├── prompts/          # Agent 启动指令（本文件所在目录）
├── prototype/        # 原型图（只读）
├── feature_list.json
├── init.sh
├── app_spec.md
├── CLAUDE.md
└── claude-progress.txt
```

前后端都要能跑起来（Hello World 级别即可），确保环境搭建正确。

---

### 第五步：第一次 Git Commit

```bash
git add .
git commit -m "init: project structure, feature_list.json, init.sh"
```

---

### 第六步（可选）：开始实现

如果上下文还够，可以开始实现 feature_list.json 中优先级最高的条目：
- 每次只做一个 feature
- 实现 → Playwright 测试 → 截图到 verification/ → passes: true → commit
- 参考 `prompts/coding_prompt.md` 的流程

---

### 结束前（强制）

1. 确保所有变更已 commit
2. 创建 `claude-progress.txt`，记录本次完成了什么，下次从哪继续
3. 确保应用处于可运行状态

---

**记住：** 多个 session 持续推进，专注质量而非速度。目标是生产级应用。
