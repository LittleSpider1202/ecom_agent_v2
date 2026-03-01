import { test, expect } from '@playwright/test'

// MW-01 决策驾驶舱 — feature #26-30

async function loginAsManager(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'manager')
  await page.fill('input[type="password"]', 'manager123')
  await page.click('button[type="submit"]')
  // manager role defaults to executor dashboard after login
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

async function goToDashboard(page: any) {
  await page.goto('/manage/dashboard')
  await page.waitForSelector('[data-testid="page-title"]', { timeout: 10000 })
}

// ─── Feature #26 ──────────────────────────────────────────────────────────────
test('MW-01 #26: 管理员登录后页面加载显示全局概览', async ({ page }) => {
  await loginAsManager(page)
  await goToDashboard(page)

  // Step 3: 验证页面标题为"决策驾驶舱"
  const title = page.getByTestId('page-title')
  await expect(title).toBeVisible()
  await expect(title).toContainText('决策驾驶舱')

  // Step 4: 验证存在全局健康度指标区域
  await expect(page.getByTestId('health-score-section')).toBeVisible()

  // Step 5: 验证存在AI建议列表区域
  await expect(page.getByTestId('ai-suggestions-section')).toBeVisible()

  // Step 6: 验证存在进行中任务摘要区域
  await expect(page.getByTestId('active-tasks-section')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-026.png', fullPage: true })
})

// ─── Feature #27 ──────────────────────────────────────────────────────────────
test('MW-01 #27: 全局健康度得分可视化展示', async ({ page }) => {
  await loginAsManager(page)
  await goToDashboard(page)

  // Step 2: 找到健康度指标区域
  const section = page.getByTestId('health-score-section')
  await expect(section).toBeVisible()

  // Step 3: 验证显示数值
  const value = page.getByTestId('health-score-value')
  await expect(value).toBeVisible()
  const text = await value.textContent()
  expect(text).toBeTruthy()
  const score = parseInt(text ?? '0', 10)
  expect(score).toBeGreaterThanOrEqual(0)
  expect(score).toBeLessThanOrEqual(100)

  // Step 4: 验证有视觉化表示（仪表盘）
  const gauge = page.getByTestId('health-gauge')
  await expect(gauge).toBeVisible()

  await page.screenshot({ path: 'verification/feature-027.png', fullPage: true })
})

// ─── Feature #28 ──────────────────────────────────────────────────────────────
test('MW-01 #28: AI建议列表显示建议条目', async ({ page }) => {
  await loginAsManager(page)
  await goToDashboard(page)

  // Step 2: 找到AI建议区域
  const section = page.getByTestId('ai-suggestions-section')
  await expect(section).toBeVisible()

  // Step 3: 验证显示至少一条AI建议（或空状态提示）
  const hasList = await page.getByTestId('suggestion-list').isVisible()
  const hasEmpty = await page.getByTestId('suggestions-empty').isVisible()
  expect(hasList || hasEmpty).toBe(true)

  if (hasList) {
    // Step 4: 验证每条建议显示摘要文字
    const items = page.locator('[data-testid^="suggestion-item-"]')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
    const firstItem = items.first()
    await expect(firstItem).toBeVisible()
    const text = await firstItem.textContent()
    expect(text).toBeTruthy()
    expect(text!.length).toBeGreaterThan(5)
  }

  await page.screenshot({ path: 'verification/feature-028.png', fullPage: true })
})

// ─── Feature #29 ──────────────────────────────────────────────────────────────
test('MW-01 #29: 进行中任务摘要区域展示任务概况', async ({ page }) => {
  await loginAsManager(page)
  await goToDashboard(page)

  // Step 2: 找到进行中任务区域
  const section = page.getByTestId('active-tasks-section')
  await expect(section).toBeVisible()

  // Step 3: 验证显示任务数量统计
  const countEl = page.getByTestId('active-tasks-count')
  await expect(countEl).toBeVisible()
  const countText = await countEl.textContent()
  const count = parseInt(countText ?? '0', 10)
  expect(count).toBeGreaterThanOrEqual(0)

  // Step 4: 验证显示任务列表或摘要（有任务时）
  if (count > 0) {
    const list = page.getByTestId('active-task-list')
    await expect(list).toBeVisible()
    const rows = list.locator('li')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
  }

  await page.screenshot({ path: 'verification/feature-029.png', fullPage: true })
})

// ─── Feature #30 ──────────────────────────────────────────────────────────────
test('MW-01 #30: 点击AI建议跳转到建议详情页', async ({ page }) => {
  await loginAsManager(page)
  await goToDashboard(page)

  // Step 2: 点击一条AI建议条目
  const items = page.locator('[data-testid^="suggestion-item-"]')
  const count = await items.count()
  expect(count).toBeGreaterThan(0)

  const firstItem = items.first()
  const testId = await firstItem.getAttribute('data-testid')
  const suggestionId = testId?.replace('suggestion-item-', '')

  await firstItem.click()

  // Step 3: 验证跳转到 /manage/suggestions/{id}
  await page.waitForURL(/\/manage\/suggestions\/\d+/, { timeout: 8000 })
  expect(page.url()).toContain(`/manage/suggestions/${suggestionId}`)

  // Step 4: 验证建议详情页显示完整建议内容
  await expect(page.getByTestId('suggestion-detail')).toBeVisible()
  await expect(page.getByTestId('suggestion-title')).toBeVisible()
  const titleText = await page.getByTestId('suggestion-title').textContent()
  expect(titleText).toBeTruthy()
  expect(titleText!.length).toBeGreaterThan(5)

  await expect(page.getByTestId('suggestion-content')).toBeVisible()
  const contentText = await page.getByTestId('suggestion-content').textContent()
  expect(contentText).toBeTruthy()
  expect(contentText!.length).toBeGreaterThan(20)

  await page.screenshot({ path: 'verification/feature-030.png', fullPage: true })
})
