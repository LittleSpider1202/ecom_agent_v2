# 电商智能运营平台

## 目录

- [背景与问题](#背景与问题)
- [产品形态](#产品形态)
- [竞品定位](#竞品定位)
- [产品方案](#产品方案)
- [技术方案](#技术方案)
- [项目管理](#项目管理)

---

## 背景与问题

**宏观框架**
公司结构自上而下：市场定位/战略目标 → 业务流程 → 人的组织 → 信息与工具系统。市场是客观约束，业务流程是对市场的响应，人和工具是填充流程的资源。

**目标客户和核心痛点**
中小电商商家。老板一个人扛管理层，执行层链路长、节点多、事件并发，人盯不过来。业务涉及平台、ERP、仓库、快递、供应商等多个系统，数据孤岛严重，跨系统协作全靠人工搬运和对齐。核心诉求是：流程清晰、执行到位、成本低。

**产品价值主张**
用数字化方式替代或辅助人来填充和执行流程，让老板从救火队长变成真正的决策者。

---

## 产品形态

三个模块：飞书/钉钉机器人（交互层）+ 执行者工作台（执行层）+ 管理工作台（管理层）。执行者工作台分三个子模块：任务管理（DAG工作流）、知识管理、工具管理（自动化）。人机混合，机器做确定性工作，人做关系型和判断型工作。管理工作台负责流程定义（自然语言→DAG）、工具上传、部门/角色管理、全局任务监控、数据分析与决策建议。

---

## 竞品定位

三范式框架：信息系统 → 知识系统 → 行动系统。现有工具都是局部优化，本产品是垂类电商场景下三段全强、开箱即用。

| 工具 | 信息系统 | 知识系统 | 行动系统 | 核心短板 |
|------|---------|---------|---------|---------|
| 多维表格 | 强 | 弱 | 弱 | 有自动化能力但较弱，缺乏判断和推理 |
| RPA | 弱 | 弱 | 强 | 缺存储层，无知识系统和模型能力，流程全靠人定义 |
| Coze | 弱 | 强 | 中 | 行动依赖API，无法操作无API的系统 |
| CC+RAG | 强 | 强 | 强 | 最强单体，但工程门槛高，难协同 |
| 多维表格+RPA+Coze | 强 | 强 | 强 | 门槛高、价格贵、三套系统集成维护成本极高 |

---

## 产品方案

线框图原型：[prototype/index.html](prototype/index.html)

---

## 技术方案

> 待补充

---

## 项目管理

本项目采用 Autonomous Coding Agent 模式开发，基于 [claude-quickstarts/autonomous-coding](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)。

### 开发模式

两Agent协作模式，跨Session持久化推进：

- **Initializer Agent（Session 1）**：读取 `app_spec.txt`，生成 `feature_list.json`（200个测试用例），初始化项目结构和git仓库
- **Coding Agent（Session 2+）**：每次从 `feature_list.json` 取优先级最高的未完成任务，实现并通过浏览器自动化验证，标记 `passes: true`，commit进度

### 核心文件

| 文件 | 说明 |
|------|------|
| `app_spec.txt` | 产品需求完整描述，开发的唯一依据 |
| `feature_list.json` | 200个测试用例，进度追踪的单一数据源 |
| `claude-progress.txt` | 每个Session的进度记录，供下一个Agent定向 |
| `init.sh` | 环境启动脚本 |
| `prompts/initializer_prompt.md` | Initializer Agent的指令 |
| `prompts/coding_prompt.md` | Coding Agent的指令 |

### 开发原则

- 每次Session专注完成一个feature，宁可慢不出错
- 所有功能必须通过浏览器自动化UI验证，不接受纯后端测试
- `feature_list.json` 只能将 `passes: false` 改为 `passes: true`，禁止删除或修改测试用例
- 每个Session结束前必须commit，保持代码库干净可运行

### 快速开始
```bash
# 安装依赖
npm install -g @anthropic-ai/claude-code
pip install -r requirements.txt

# 设置API Key
export ANTHROPIC_API_KEY='your-api-key-here'

# 启动 Initializer Agent（首次）
python autonomous_agent_demo.py --project-dir ./project

# 后续Session继续推进
python autonomous_agent_demo.py --project-dir ./project
```
