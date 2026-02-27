import { test, expect } from '@playwright/test'

const API = 'http://localhost:8001'

async function loginAsExecutor(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API}/api/auth/login`, {
    form: { username: 'executor', password: 'executor123' },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(
    ({ token, u }: { token: string; u: object }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
    },
    { token: access_token, u: user }
  )
}

test('#51 任务历史：页面加载显示已完成任务归档列表', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  // 页面标题
  await expect(page.locator('h1')).toContainText('任务历史')

  // 已完成任务列表存在
  const rows = page.locator('[data-testid="history-row"]')
  await expect(rows.first()).toBeVisible()

  // 每条显示完成时间
  const completedAt = page.locator('[data-testid="completed-at"]').first()
  await expect(completedAt).toBeVisible()
  const text = await completedAt.textContent()
  expect(text).not.toBe('—')

  await page.screenshot({ path: 'verification/feature-051.png' })
})

test('#52 任务历史：已完成任务显示流程名、完成时间和耗时', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  const rows = page.locator('[data-testid="history-row"]')
  await expect(rows.first()).toBeVisible()

  const firstRow = rows.first()

  // 流程名
  const cells = firstRow.locator('td')
  const flowName = await cells.nth(1).textContent()
  expect(flowName?.trim().length).toBeGreaterThan(0)

  // 完成时间（格式 YYYY-MM-DD HH:mm）
  const completedAt = await cells.nth(3).textContent()
  expect(completedAt).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)

  // 耗时
  const duration = await cells.nth(4).textContent()
  expect(duration?.trim().length).toBeGreaterThan(0)
  expect(duration).not.toBe('—')
})

test('#53 我的操作记录 Tab 显示个人参与的人工步骤', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  // 点击"我的操作记录" Tab
  await page.getByText('我的操作记录').click()
  await page.waitForTimeout(500)

  // Tab 内容区域显示（有记录或空状态提示均可）
  const table = page.locator('table').last()
  await expect(table).toBeVisible()

  // 如果有记录，验证操作类型字段存在
  const rows = page.locator('[data-testid="step-row"]')
  const count = await rows.count()
  if (count > 0) {
    const actionBadge = rows.first().locator('[data-testid="action-badge"]')
    await expect(actionBadge).toBeVisible()
    const action = await actionBadge.textContent()
    expect(['采纳', '修改', '驳回']).toContain(action?.trim())
  } else {
    // 空状态提示
    await expect(page.locator('[data-testid="no-steps-msg"]')).toBeVisible()
  }
})

test('#54 按任务名称关键词搜索历史任务', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  const rows = page.locator('[data-testid="history-row"]')
  const totalBefore = await rows.count()
  expect(totalBefore).toBeGreaterThan(0)

  // 输入已知关键词
  const searchInput = page.locator('[data-testid="search-input"]')
  await searchInput.fill('退货')
  const [resp1] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tasks/history') && r.status() === 200),
    page.locator('[data-testid="filter-btn"]').click(),
  ])
  await resp1.json() // ensure body is consumed

  // 列表过滤为匹配任务
  const filtered = page.locator('[data-testid="history-row"]')
  await expect(filtered.first()).toBeVisible()
  const filteredCount = await filtered.count()
  expect(filteredCount).toBeGreaterThanOrEqual(1)
  const firstTitle = await filtered.first().locator('td').first().textContent()
  expect(firstTitle).toContain('退货')

  // 清空搜索，列表恢复
  const [resp2] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tasks/history') && r.status() === 200),
    page.locator('[data-testid="clear-filter-btn"]').click(),
  ])
  await resp2.json()
  const afterClear = await page.locator('[data-testid="history-row"]').count()
  expect(afterClear).toBeGreaterThanOrEqual(filteredCount)
})

test('#55 按日期范围筛选历史任务', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  // 设置开始日期（昨天的日期）
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 4)
  const dateFrom = yesterday.toISOString().split('T')[0]

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateTo = tomorrow.toISOString().split('T')[0]

  await page.locator('[data-testid="date-from"]').fill(dateFrom)
  await page.locator('[data-testid="date-to"]').fill(dateTo)
  await page.locator('[data-testid="filter-btn"]').click()
  await page.waitForTimeout(500)

  // 过滤后有结果（种子数据 completed_at 在最近7天内）
  const rows = page.locator('[data-testid="history-row"]')
  await expect(rows.first()).toBeVisible()
})

test('#92 EW-05 任务历史：列表条目样式整洁，时间戳格式统一', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/history', { waitUntil: 'networkidle' })

  // 列表条目排列整齐（table 结构）
  const table = page.locator('table').first()
  await expect(table).toBeVisible()

  // 时间戳格式一致（YYYY-MM-DD HH:mm）
  const completedAtCells = page.locator('[data-testid="completed-at"]')
  const count = await completedAtCells.count()
  for (let i = 0; i < count; i++) {
    const text = await completedAtCells.nth(i).textContent()
    if (text && text !== '—') {
      expect(text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    }
  }

  // 切换到我的操作记录，验证操作类型有颜色区分
  await page.getByText('我的操作记录').click()
  await page.waitForTimeout(400)

  const stepRows = page.locator('[data-testid="step-row"]')
  const stepCount = await stepRows.count()
  if (stepCount > 0) {
    const badge = stepRows.first().locator('[data-testid="action-badge"]')
    const cls = await badge.getAttribute('class')
    // 有背景颜色 class
    expect(cls).toMatch(/bg-(?:green|blue|red)-100/)
  }

  await page.screenshot({ path: 'verification/feature-092.png' })
})
