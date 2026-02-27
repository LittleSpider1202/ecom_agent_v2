import { test, expect, type Page } from '@playwright/test'

// EW-03 任务详情（自动）— feature #11-16

// ── 稳定登录 ────────────────────────────────────────────────────────────────
async function loginAsExecutor(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const res = await page.request.post('http://localhost:8001/api/auth/login', {
    form: { username: 'executor', password: 'executor123' },
  })
  const data = await res.json()
  await page.evaluate(
    ({ token, user }: { token: string; user: unknown }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { token: data.access_token, user: data.user },
  )
}

// 获取"618大促活动方案执行"任务 ID（用 page.request，在 Node.js context 运行）
async function getAutoTaskId(page: Page): Promise<number> {
  const loginRes = await page.request.post('http://localhost:8001/api/auth/login', {
    form: { username: 'executor', password: 'executor123' },
  })
  const { access_token } = await loginRes.json()

  const tasksRes = await page.request.get('http://localhost:8001/api/tasks?status=running&page_size=20', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const { items } = await tasksRes.json()
  const task = items.find((t: { title: string }) => t.title.includes('618'))
  if (!task) throw new Error('找不到618大促任务，请检查种子数据')
  return task.id
}

// ─── Feature #11 ──────────────────────────────────────────────────────────────
test('EW-03 #11: 通过任务列表点击进入自动任务详情页', async ({ page }) => {
  await loginAsExecutor(page)

  // Step 1: 导航到任务列表
  await page.goto('/executor/tasks', { waitUntil: 'networkidle' })

  // Step 2: 切换到"进行中"Tab，等待数据加载
  await page.getByTestId('tab-running').click()
  // 等待进行中任务行出现
  await page.waitForSelector('tr:has-text("618大促活动方案执行")', { timeout: 8000 })

  // Step 3: 点击任务行（has_human_step=false → 跳转详情）
  const row = page.locator('tr').filter({ hasText: '618大促活动方案执行' })
  await expect(row).toBeVisible()
  await row.click()

  // Step 4: 验证跳转到 /executor/tasks/{taskId}
  await page.waitForURL(/\/executor\/tasks\/\d+/, { timeout: 8000 })

  // Step 5: 验证页面显示任务名称和流程信息
  await expect(page.locator('h1')).toContainText('618大促活动方案执行')
  await expect(page.locator('body')).toContainText('促销活动流程')

  // Step 6: 验证 DAG 进度图区域存在
  await expect(page.getByTestId('dag-canvas')).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: 'verification/feature-011.png', fullPage: true })
})

// ─── Feature #12 ──────────────────────────────────────────────────────────────
test('EW-03 #12: DAG进度图正确渲染节点和连线', async ({ page }) => {
  await loginAsExecutor(page)
  const taskId = await getAutoTaskId(page)
  await page.goto(`/executor/tasks/${taskId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="dag-node-n1"]', { timeout: 12000 })
  await page.waitForTimeout(1200) // 等待 ReactFlow 完整渲染

  // Step 2: 验证有多个节点
  const nodes = page.locator('[data-testid^="dag-node-"]')
  await expect(nodes).toHaveCount(5, { timeout: 8000 })

  // Step 3: 验证存在 SVG 连线（ReactFlow edges 是 SVG g 元素，用 count 验证）
  const edgeCount = await page.locator('[data-testid^="rf__edge-"]').count()
  expect(edgeCount).toBeGreaterThan(0)

  // Step 4: 验证节点显示步骤名称
  await expect(page.getByTestId('dag-node-n1')).toContainText('采集活动数据')
  await expect(page.getByTestId('dag-node-n2')).toContainText('竞品价格分析')
  await expect(page.getByTestId('dag-node-n3')).toContainText('AI生成活动方案')

  await page.screenshot({ path: 'verification/feature-012.png', fullPage: true })
})

// ─── Feature #13 ──────────────────────────────────────────────────────────────
test('EW-03 #13: 已完成节点显示为绿色状态', async ({ page }) => {
  await loginAsExecutor(page)
  const taskId = await getAutoTaskId(page)
  await page.goto(`/executor/tasks/${taskId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="dag-node-n1"]', { timeout: 12000 })
  await page.waitForTimeout(800)

  // Step 2-3: 验证已完成节点有绿色样式
  const n1 = page.getByTestId('dag-node-n1')
  await expect(n1).toBeVisible()
  await expect(n1).toHaveAttribute('data-status', 'completed')
  await expect(n1).toHaveClass(/bg-green/)
  // 验证包含"已完成"文字
  await expect(n1).toContainText('已完成')

  const n2 = page.getByTestId('dag-node-n2')
  await expect(n2).toHaveAttribute('data-status', 'completed')

  await page.screenshot({ path: 'verification/feature-013.png', fullPage: true })
})

// ─── Feature #14 ──────────────────────────────────────────────────────────────
test('EW-03 #14: 执行中节点显示进度动画', async ({ page }) => {
  await loginAsExecutor(page)
  const taskId = await getAutoTaskId(page)
  await page.goto(`/executor/tasks/${taskId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="dag-node-n3"]', { timeout: 12000 })
  await page.waitForTimeout(800)

  // Step 2-3: 验证执行中节点有蓝色高亮 + animate-pulse
  const runningNode = page.getByTestId('dag-node-n3')
  await expect(runningNode).toBeVisible()
  await expect(runningNode).toHaveAttribute('data-status', 'running')
  await expect(runningNode).toHaveClass(/bg-blue/)
  await expect(runningNode).toHaveClass(/animate-pulse/)

  await page.screenshot({ path: 'verification/feature-014.png', fullPage: true })
})

// ─── Feature #15 ──────────────────────────────────────────────────────────────
test('EW-03 #15: 失败节点显示为红色错误状态', async ({ page }) => {
  await loginAsExecutor(page)
  const taskId = await getAutoTaskId(page)
  await page.goto(`/executor/tasks/${taskId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="dag-node-n4"]', { timeout: 12000 })
  await page.waitForTimeout(800)

  // Step 2-3: 验证失败节点有红色样式
  const failedNode = page.getByTestId('dag-node-n4')
  await expect(failedNode).toBeVisible()
  await expect(failedNode).toHaveAttribute('data-status', 'failed')
  await expect(failedNode).toHaveClass(/bg-red/)

  // Step 4: 验证有错误提示文字
  await expect(failedNode).toContainText('失败')

  await page.screenshot({ path: 'verification/feature-015.png', fullPage: true })
})

// ─── Feature #16 ──────────────────────────────────────────────────────────────
test('EW-03 #16: 点击节点展开执行日志面板', async ({ page }) => {
  await loginAsExecutor(page)
  const taskId = await getAutoTaskId(page)
  await page.goto(`/executor/tasks/${taskId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="dag-node-n1"]', { timeout: 12000 })
  await page.waitForTimeout(1000)

  // Step 2: 点击已完成节点
  // ReactFlow pane 拦截 Playwright 的鼠标事件，改用 evaluate 直接 dispatch
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="dag-node-n1"]')
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  // Step 3-4: 验证日志面板弹出并显示日志
  await expect(page.getByTestId('log-panel')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('log-content')).toContainText('采集完成')

  // Step 5-6: 关闭日志面板，DAG canvas 保持可见
  await page.getByTestId('log-panel-close').click()
  await expect(page.getByTestId('log-panel')).not.toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('dag-canvas')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-016.png', fullPage: true })
})
