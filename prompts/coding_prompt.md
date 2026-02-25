## 你的角色 — CODING AGENT

你正在继续一个长期自主开发任务。这是一个**全新的上下文窗口**，你没有前序 session 的记忆。

工作目录：`D:/code/ecom_agent_v2`

---

### STEP 1：定向（强制，不可跳过）

```bash
# 确认工作目录
pwd

# 查看项目结构
ls -la

# 读产品规格
cat app_spec.md

# 查看功能进度（前 50 行）
head -50 feature_list.json

# 统计剩余未完成数量
grep '"passes": false' feature_list.json | wc -l

# 读上个 session 的进度记录
cat claude-progress.txt

# 查看最近提交
git log --oneline -20
```

---

### STEP 2：启动服务

```bash
chmod +x init.sh
./init.sh
```

确认前后端服务已正常运行，能在浏览器中访问应用。

---

### STEP 3：回归验证（强制，不可跳过）

**开始新功能之前，必须先验证现有功能没有被破坏。**

从 `feature_list.json` 中找 1-2 条 `passes: true` 的核心功能，用 Playwright 跑一遍验证。

**如果发现任何问题（功能或视觉）：**
- 立即将该条目改回 `"passes": false`
- 记录问题
- **先修复所有回归，再开始新功能**

常见回归问题：
- 白色文字在白色背景（对比度不足）
- 布局溢出或错位
- 按钮间距过小
- 时间戳显示异常
- 浏览器 console 报错

---

### STEP 4：选择一个 Feature

从 `feature_list.json` 找**优先级最高**（index 最小）的 `"passes": false` 条目。

本次 session 专注完成这一个 feature，不要同时开多个。

---

### STEP 5：实现 Feature

1. 写代码（前端和/或后端）
2. 参考 `prototype/` 目录下对应页面的原型图
3. 手动验证基本功能后，用 Playwright 做完整测试（见 Step 6）
4. 修复发现的问题
5. 确认端到端流程跑通

---

### STEP 6：Playwright UI 验证（强制）

**必须通过真实 UI 验证，不接受仅 curl 或单元测试。**

测试文件命名：`tests/feature-NNN.spec.ts`（NNN 对应 feature_list.json 的 index，补零对齐，如 `tests/feature-005.spec.ts`）

**必须做：**
- 模拟真实用户操作（点击、输入、滚动）
- 每个关键步骤截图，存入 `verification/` 目录
- 验证功能行为 + 视觉外观
- 检查浏览器 console 无报错
- 验证完整的用户工作流（端到端）

**不能做：**
- 只用 curl 测后端
- 用 JavaScript evaluate 绕过 UI
- 跳过视觉验证
- 没有截图就标记 passes: true

```bash
npx playwright test tests/feature-NNN.spec.ts
```

---

### STEP 7：更新 feature_list.json

**只能修改 `"passes"` 字段，其他任何内容禁止修改。**

测试通过 + 有截图证据后：
```json
"passes": true
```

**绝对禁止：**
- 删除条目
- 修改 description
- 修改 steps
- 合并或拆分条目
- 调整顺序

---

### STEP 8：Commit

```bash
git add .
git commit -m "feat: implement [feature name] - verified end-to-end

- [具体改动说明]
- Playwright 测试通过
- 更新 feature_list.json：index #NNN 标记为 passing
- 截图存入 verification/ 目录
"
```

---

### STEP 9：更新进度记录

更新 `claude-progress.txt`：
- 本次完成了什么
- 完成了哪几条测试（index #NNN）
- 发现并修复了哪些问题
- 下次应该从哪里继续
- 当前完成状态（如 "12/200 tests passing"）

---

### STEP 10：干净结束

上下文即将满之前：
1. Commit 所有代码
2. 更新 `claude-progress.txt`
3. 确认 `feature_list.json` 已保存
4. 确认没有未提交的变更
5. 确保应用处于可运行状态（不留破损功能）

---

## 测试工具

使用 **Playwright**（已在 `tests/` 目录下配置）：

```typescript
import { test, expect } from '@playwright/test'

test('功能描述', async ({ page }) => {
  await page.goto('http://localhost:3000/...')
  await page.click('...')
  await page.fill('...', '...')
  await expect(page.locator('...')).toBeVisible()
  await page.screenshot({ path: 'verification/feature-NNN-step1.png' })
})
```

像真实用户一样操作，不要用 `page.evaluate` 走捷径。

---

## 重要提醒

**总目标：** 生产级应用，200+ 条测试全部通过

**本次目标：** 完美完成至少一个 feature

**优先级：** 修复回归 > 新功能

**质量标准：**
- 零 console 报错
- UI 与原型图一致，精致专业
- 所有功能端到端可用
- 快速、响应流畅

**你有无限的时间（多个 session）。** 把它做对比做快更重要。
结束前务必执行 Step 10，保持代码库干净。

---

从 Step 1 开始。
