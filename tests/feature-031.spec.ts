import { test, expect, type Page } from '@playwright/test'

// MW-03 流程编辑器 — feature #31-42

// ── 稳定登录：直接通过 API 取 token，写入 localStorage，避免 UI 登录 flakiness ──
async function loginAsManager(page: Page) {
  // 1. 先加载页面建立 origin context
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  // 2. 通过 API 获取 token
  const res = await page.request.post('http://192.168.0.112:8002/api/auth/login', {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await res.json()
  const token = data.access_token
  const user = data.user

  // 3. 写入 localStorage（绕过 UI 表单）
  await page.evaluate(
    ({ token, user }: { token: string; user: unknown }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { token, user },
  )
}

async function goToNewFlow(page: Page) {
  await page.goto('/manage/flows/new', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 12000 })
  await page.waitForTimeout(600)
}

// ─── Feature #31 ──────────────────────────────────────────────────────────────
test('MW-03 #31: 页面加载显示空白画布和节点面板', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Step 3: 验证存在可视化画布区域
  await expect(page.getByTestId('flow-canvas')).toBeVisible()

  // Step 4: 验证存在节点类型面板
  await expect(page.getByTestId('node-panel')).toBeVisible()
  await expect(page.getByTestId('panel-node-auto')).toBeVisible()
  await expect(page.getByTestId('panel-node-human')).toBeVisible()
  await expect(page.getByTestId('panel-node-condition')).toBeVisible()

  // Step 5: 验证存在工具栏
  await expect(page.getByTestId('flow-toolbar')).toBeVisible()
  await expect(page.getByTestId('save-btn')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-031.png', fullPage: true })
})

// ─── Feature #32 ──────────────────────────────────────────────────────────────
test('MW-03 #32: 自然语言输入生成DAG流程图', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Step 2: 找到自然语言输入框
  await expect(page.getByTestId('ai-prompt-input')).toBeVisible()

  // Step 3: 输入流程描述
  await page.getByTestId('ai-prompt-input').fill('每天早上8点采集竞品数据，识别异常后通知老板确认')

  // Step 4: 点击AI生成按钮
  await page.getByTestId('ai-generate-btn').click()

  // Step 5: 等待AI处理
  await page.waitForTimeout(2000)

  // Step 6: 验证画布上出现多个节点
  const nodes = page.locator('.react-flow__node')
  await expect(nodes).toHaveCount(3, { timeout: 10000 })

  // Step 7: 验证节点之间有连线
  const edges = page.locator('.react-flow__edge')
  await expect(edges).toHaveCount(2, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-032.png', fullPage: true })
})

// ─── Feature #33 ──────────────────────────────────────────────────────────────
test('MW-03 #33: 从节点面板添加自动节点到画布', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // 点击面板 API调用节点（点击即添加到画布）
  await page.getByTestId('panel-node-auto').click()

  // Step 4: 验证节点出现在画布上
  const canvasNodes = page.locator('.react-flow__node')
  await expect(canvasNodes).toHaveCount(1, { timeout: 5000 })

  // Step 5: 验证节点显示类型图标和名称
  const autoNode = page.locator('[data-testid="node-auto"]')
  await expect(autoNode).toBeVisible()
  await expect(autoNode).toContainText('API调用')

  await page.screenshot({ path: 'verification/feature-033.png', fullPage: true })
})

// ─── Feature #34 ──────────────────────────────────────────────────────────────
test('MW-03 #34: 从节点面板添加人工节点到画布，样式与自动节点不同', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  await page.getByTestId('panel-node-auto').click()
  await page.getByTestId('panel-node-human').click()
  await page.waitForTimeout(400)

  // Step 4: 验证人工节点出现
  const humanNode = page.locator('[data-testid="node-human"]')
  await expect(humanNode).toBeVisible()

  // Step 5: 验证与自动节点颜色不同
  const autoNode = page.locator('[data-testid="node-auto"]')
  await expect(autoNode).toBeVisible()

  const autoClass = await autoNode.getAttribute('class')
  const humanClass = await humanNode.getAttribute('class')
  expect(autoClass).toContain('blue')
  expect(humanClass).toContain('orange')
  expect(autoClass).not.toContain('orange')
  expect(humanClass).not.toContain('blue')

  await page.screenshot({ path: 'verification/feature-034.png', fullPage: true })
})

// ─── Feature #35 ──────────────────────────────────────────────────────────────
test('MW-03 #35: 连接两个节点建立依赖关系', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Add two nodes
  await page.getByTestId('panel-node-auto').click()
  await page.waitForTimeout(300)
  await page.getByTestId('panel-node-human').click()
  await page.waitForTimeout(800)

  const nodes = page.locator('.react-flow__node')
  await expect(nodes).toHaveCount(2, { timeout: 5000 })

  // In @xyflow/react v12: handles have data-handlepos="bottom"(source) / data-handlepos="top"(target)
  const node1 = nodes.first()
  const node2 = nodes.last()

  // Source = bottom handle of node1; Target = top handle of node2
  const sourceHandle = node1.locator('.react-flow__handle[data-handlepos="bottom"]')
  const targetHandle = node2.locator('.react-flow__handle[data-handlepos="top"]')

  await expect(sourceHandle).toBeVisible({ timeout: 5000 })
  await expect(targetHandle).toBeVisible({ timeout: 5000 })

  const sBox = await sourceHandle.boundingBox()
  const tBox = await targetHandle.boundingBox()

  if (sBox && tBox) {
    const sx = sBox.x + sBox.width / 2
    const sy = sBox.y + sBox.height / 2
    const tx = tBox.x + tBox.width / 2
    const ty = tBox.y + tBox.height / 2

    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.waitForTimeout(100)
    await page.mouse.move(tx, ty, { steps: 20 })
    await page.waitForTimeout(200)
    await page.mouse.up()
  }

  await page.waitForTimeout(1000)

  // Step 5: 验证出现连线
  const edges = page.locator('.react-flow__edge')
  const edgeCount = await edges.count()
  expect(edgeCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-035.png', fullPage: true })
})

// ─── Feature #36 ──────────────────────────────────────────────────────────────
test('MW-03 #36: 删除节点从画布移除', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Add a node
  await page.getByTestId('panel-node-auto').click()
  await page.waitForTimeout(500)

  const nodes = page.locator('.react-flow__node')
  await expect(nodes).toHaveCount(1, { timeout: 5000 })

  // Step 2: 点击选中节点
  await nodes.first().click()
  await page.waitForTimeout(400)

  // Step 3: 按Delete键
  await page.keyboard.press('Delete')
  await page.waitForTimeout(800)

  // Step 4: 验证节点消失
  await expect(nodes).toHaveCount(0, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-036.png', fullPage: true })
})

// ─── Feature #37 ──────────────────────────────────────────────────────────────
test('MW-03 #37: 配置API调用节点（URL、方法、参数）', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  await page.getByTestId('panel-node-auto').click()
  await page.waitForTimeout(500)

  // Step 2: 双击节点打开配置面板
  const autoNode = page.locator('[data-testid="node-auto"]')
  await expect(autoNode).toBeVisible()
  await autoNode.dblclick()
  await page.waitForTimeout(500)

  await expect(page.getByTestId('config-panel')).toBeVisible()

  // Step 3: 输入请求URL
  await page.getByTestId('config-url').fill('https://api.example.com/products')

  // Step 4: 选择HTTP方法
  await page.getByTestId('config-method').selectOption('POST')

  // Step 5: 添加请求参数
  await page.getByTestId('config-params').fill('{"limit": 100}')

  // Step 6: 保存
  await page.getByTestId('config-save-btn').click()
  await page.waitForTimeout(500)

  // Step 7: 验证节点显示URL摘要
  await expect(page.locator('[data-testid="node-auto"]')).toContainText('api.example.com')

  await page.screenshot({ path: 'verification/feature-037.png', fullPage: true })
})

// ─── Feature #38 ──────────────────────────────────────────────────────────────
test('MW-03 #38: 配置人工节点完整流程', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  await page.getByTestId('panel-node-human').click()
  await page.waitForTimeout(500)

  // Step 3: 双击节点打开配置面板
  const humanNode = page.locator('[data-testid="node-human"]')
  await expect(humanNode).toBeVisible()
  await humanNode.dblclick()
  await page.waitForTimeout(500)

  await expect(page.getByTestId('config-panel')).toBeVisible()

  // Step 4: 选择负责人角色
  await page.getByTestId('config-role').selectOption('运营主管')

  // Step 5: 填写操作说明
  await page.getByTestId('config-instructions').fill('请审核商品定价方案并确认是否执行')

  // Step 6: 配置AI建议提示词
  await page.getByTestId('config-ai-prompt').fill('根据竞品价格生成调价建议')

  // Step 7: 设置超时时间
  await page.getByTestId('config-timeout').fill('48')

  // Step 8: 勾选超时后催办
  await page.getByTestId('config-escalation').check()

  // Step 9: 保存
  await page.getByTestId('config-save-btn').click()
  await page.waitForTimeout(500)

  // Step 10: 验证节点显示负责人角色
  await expect(page.locator('[data-testid="node-human"]')).toContainText('运营主管')

  // Step 11: 验证节点为橙色（人工节点）
  const nodeClass = await page.locator('[data-testid="node-human"]').getAttribute('class')
  expect(nodeClass).toContain('orange')

  await page.screenshot({ path: 'verification/feature-038.png', fullPage: true })
})

// ─── Feature #39 ──────────────────────────────────────────────────────────────
test('MW-03 #39: 保存流程定义并验证版本号', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Step 1: 至少添加2个节点
  await page.getByTestId('panel-node-auto').click()
  await page.waitForTimeout(200)
  await page.getByTestId('panel-node-human').click()
  await page.waitForTimeout(300)

  // 设置流程名称
  await page.getByTestId('flow-name-input').fill('测试保存流程')

  // Step 2: 点击保存
  await page.getByTestId('save-btn').click()

  // Step 3: 验证显示保存成功提示
  await expect(page.getByTestId('save-btn')).toContainText('已保存', { timeout: 10000 })

  // Step 4: 验证URL更新为 /manage/flows/{flowId}
  await page.waitForURL(/\/manage\/flows\/\d+$/, { timeout: 12000 })
  expect(page.url()).toMatch(/\/manage\/flows\/\d+$/)

  // Step 5: 验证显示版本号 v1
  const versionBadge = page.getByTestId('version-badge')
  await expect(versionBadge).toBeVisible()
  await expect(versionBadge).toContainText('v1')

  await page.screenshot({ path: 'verification/feature-039.png', fullPage: true })
})

// ─── Feature #40 ──────────────────────────────────────────────────────────────
test('MW-03 #40: 手动触发已保存的流程创建任务实例', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // First save a flow
  await page.getByTestId('panel-node-auto').click()
  await page.getByTestId('flow-name-input').fill('手动触发测试流程')
  await page.getByTestId('save-btn').click()

  // Wait for URL to update (confirming save succeeded)
  await page.waitForURL(/\/manage\/flows\/\d+$/, { timeout: 12000 })
  await page.waitForTimeout(500)

  // Step 2: 点击触发按钮
  await expect(page.getByTestId('trigger-btn')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('trigger-btn').click()

  // Step 3: 验证弹出确认对话框
  await expect(page.getByTestId('trigger-dialog')).toBeVisible()

  // Step 4: 点击确认触发
  await page.getByTestId('trigger-confirm-btn').click()
  await page.waitForTimeout(1500)

  // Step 5: 验证成功消息出现
  await expect(page.getByTestId('trigger-success-msg')).toBeVisible({ timeout: 8000 })
  const msg = await page.getByTestId('trigger-success-msg').textContent()
  expect(msg).toContain('触发成功')

  // Step 6: 导航到任务监控页面
  await page.goto('/manage/monitor', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="task-monitor-table"]', { timeout: 12000 })

  // Step 7: 验证新任务实例出现在列表中
  const rows = page.locator('[data-testid="monitor-task-row"]')
  await expect(rows.first()).toBeVisible({ timeout: 5000 })
  const rowTexts = await rows.allTextContents()
  const hasTriggeredTask = rowTexts.some(t => t.includes('手动触发'))
  expect(hasTriggeredTask).toBe(true)

  await page.screenshot({ path: 'verification/feature-040.png', fullPage: true })
})

// ─── Feature #41 ──────────────────────────────────────────────────────────────
test('MW-03 #41: 修改已保存流程后版本号递增', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Save initial version
  await page.getByTestId('panel-node-auto').click()
  await page.getByTestId('flow-name-input').fill('版本递增测试流程')
  await page.getByTestId('save-btn').click()

  await page.waitForURL(/\/manage\/flows\/\d+$/, { timeout: 12000 })
  await page.waitForTimeout(500)

  // Verify v1
  await expect(page.getByTestId('version-badge')).toContainText('v1')

  // Get flow ID from URL
  const flowId = page.url().split('/').pop()

  // Step 2: 修改流程（添加另一个节点）
  await page.getByTestId('panel-node-human').click()
  await page.waitForTimeout(300)

  // Step 3: 点击保存
  await page.getByTestId('save-btn').click()
  await page.waitForTimeout(1000)

  // Step 4: 验证版本号更新为 v2
  await expect(page.getByTestId('version-badge')).toContainText('v2', { timeout: 10000 })

  // Step 5: 导航到流程版本历史页面
  await page.goto(`/manage/flows/${flowId}/versions`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="versions-list"]', { timeout: 12000 })

  // Step 6: 验证历史中显示 v1 和 v2
  await expect(page.locator('[data-testid="version-item-v1"]')).toBeVisible()
  await expect(page.locator('[data-testid="version-item-v2"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-041.png', fullPage: true })
})

// ─── Feature #42 ──────────────────────────────────────────────────────────────
test('MW-03 #42: 添加条件分支节点并配置判断条件', async ({ page }) => {
  await loginAsManager(page)
  await goToNewFlow(page)

  // Step 2: 点击条件分支节点（添加到画布）
  await page.getByTestId('panel-node-condition').click()
  await page.waitForTimeout(500)

  // Step 3: 验证条件节点出现
  const conditionNode = page.locator('[data-testid="node-condition"]')
  await expect(conditionNode).toBeVisible()

  // Step 4: 双击打开配置面板
  await conditionNode.dblclick()
  await page.waitForTimeout(500)
  await expect(page.getByTestId('config-panel')).toBeVisible()

  // 配置条件表达式
  await page.getByTestId('config-expression').fill('库存数量 < 100')

  // Step 6: 保存
  await page.getByTestId('config-save-btn').click()
  await page.waitForTimeout(300)

  // Step 7: 验证节点显示为菱形（rotate-45 类表示菱形）
  await expect(conditionNode).toBeVisible()
  const diamond = conditionNode.locator('.rotate-45')
  await expect(diamond).toBeVisible()

  await page.screenshot({ path: 'verification/feature-042.png', fullPage: true })
})
