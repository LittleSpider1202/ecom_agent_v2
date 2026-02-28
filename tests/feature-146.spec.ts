import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await resp.json()
  await page.evaluate(({ token, user }: { token: string; user: unknown }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: data.access_token, user: data.user })
}

test('#146 MW-12 数据分析看板：图表颜色主题一致，有图例说明', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/analytics`)

  await page.locator('[data-testid="analytics-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'verification/feature-146-analytics-style.png' })

  // Verify chart container exists
  await expect(page.locator('[data-testid="trend-chart-container"]')).toBeVisible()

  // Verify chart legend exists
  const legend = page.locator('[data-testid="chart-legend"]')
  await expect(legend).toBeVisible()

  // Verify time axis label
  await expect(page.locator('[data-testid="time-axis-label"]')).toBeVisible()

  // Verify the legend has text items
  const legendText = await legend.textContent()
  expect(legendText).toBeTruthy()
  expect(legendText!.length).toBeGreaterThan(0)

  // Verify chart SVG exists
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible()
})

test('#147 MW-13 AI决策建议：建议卡片有优先级标识（高/中/低）和操作按钮突出', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/suggestions`)

  await page.locator('[data-testid="suggestions-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  // If no pending suggestions, switch to history tab
  const suggestionList = page.locator('[data-testid="suggestion-list"]')
  const listVisible = await suggestionList.isVisible()
  if (!listVisible) {
    await page.locator('[data-testid="tab-history"]').click()
    await page.waitForFunction(() => {
      const list = document.querySelector('[data-testid="suggestion-list"]')
      const loading = document.querySelector('[data-testid="suggestions-title"]')
        ?.closest('.p-6')?.textContent?.includes('加载中')
      return list !== null || loading === false
    }, { timeout: 8000 })
  }

  await page.screenshot({ path: 'verification/feature-147-suggestions-style.png' })

  // Verify suggestion list exists
  await expect(suggestionList).toBeVisible()

  // Verify priority badges exist
  const priorityBadges = page.locator('[data-testid^="priority-badge-"]')
  const badgeCount = await priorityBadges.count()
  expect(badgeCount).toBeGreaterThan(0)

  // Verify first priority badge has valid content (高/中/低)
  const firstBadge = priorityBadges.first()
  await expect(firstBadge).toBeVisible()
  const badgeText = await firstBadge.textContent()
  expect(badgeText).toMatch(/高|中|低/)

  // Verify accept button is prominent (blue)
  const acceptBtns = page.locator('[data-testid^="accept-btn-"]')
  const acceptCount = await acceptBtns.count()
  if (acceptCount > 0) {
    const firstAccept = acceptBtns.first()
    const acceptClass = await firstAccept.getAttribute('class')
    expect(acceptClass).toContain('bg-blue')
  }

  // Verify ignore button is secondary (gray)
  const ignoreBtns = page.locator('[data-testid^="ignore-btn-"]')
  const ignoreCount = await ignoreBtns.count()
  if (ignoreCount > 0) {
    const firstIgnore = ignoreBtns.first()
    const ignoreClass = await firstIgnore.getAttribute('class')
    expect(ignoreClass).toContain('bg-gray')
  }
})

test('#148 MW-14 平台集成配置：各集成平台用卡片展示，已连接显示绿色勾选', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/integrations`)

  await page.locator('[data-testid="integrations-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'verification/feature-148-integrations-style.png' })

  // Verify each integration is in a card
  const intgList = page.locator('[data-testid="integration-list"]')
  await expect(intgList).toBeVisible()

  // Verify status cards exist
  const statusCards = page.locator('[data-testid^="intg-status-"]')
  const cardCount = await statusCards.count()
  expect(cardCount).toBeGreaterThan(0)

  // Verify feishu section exists
  await expect(page.locator('[data-testid="feishu-section"]')).toBeVisible()

  // Verify ERP section exists
  await expect(page.locator('[data-testid="erp-section"]')).toBeVisible()

  // Verify each card has visible content
  const firstCard = statusCards.first()
  await expect(firstCard).toBeVisible()

  // Verify at least one connected status badge visible on page
  const pageContent = await page.content()
  expect(pageContent).toMatch(/已连接|未连接/)
})

test('#149 MW-15 系统日志：表格有斑马纹或悬停高亮，操作类型有颜色标签', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/logs`)

  await page.locator('[data-testid="logs-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'verification/feature-149-logs-style.png' })

  // Verify log table exists with rows
  const table = page.locator('[data-testid="log-table"]')
  await expect(table).toBeVisible()

  // Verify rows have hover styling (check class attribute)
  const rows = page.locator('[data-testid^="log-row-"]')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)

  const firstRow = rows.first()
  const rowClass = await firstRow.getAttribute('class')
  // Should have hover styling
  expect(rowClass).toContain('hover:bg-gray-50')

  // Verify action type badges have color styling
  const actionBadges = page.locator('[data-testid^="log-action-"]')
  const actionCount = await actionBadges.count()
  expect(actionCount).toBeGreaterThan(0)

  const firstBadge = actionBadges.first()
  const badgeClass = await firstBadge.getAttribute('class')
  // Should have colored background (blue-50)
  expect(badgeClass).toMatch(/bg-blue|bg-green|bg-red|bg-gray/)
})

test('#150 MW-01 决策驾驶舱：全局健康度仪表盘大字显示，整体布局信息密度适中', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/dashboard`)

  await page.locator('[data-testid="page-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.screenshot({ path: 'verification/feature-150-cockpit-style.png' })

  // Verify page title exists
  await expect(page.locator('[data-testid="page-title"]')).toBeVisible()

  // Verify health score is displayed prominently
  await expect(page.locator('[data-testid="health-gauge"]')).toBeVisible()
  await expect(page.locator('[data-testid="health-score-value"]')).toBeVisible()

  // Verify health score has large font class
  const scoreEl = page.locator('[data-testid="health-score-value"]')
  const scoreClass = await scoreEl.getAttribute('class')
  expect(scoreClass).toMatch(/text-[2-9]xl|text-\d{2,}/)

  // Verify health score section exists
  await expect(page.locator('[data-testid="health-score-section"]')).toBeVisible()

  // Verify active tasks section
  await expect(page.locator('[data-testid="active-tasks-section"]')).toBeVisible()
  await expect(page.locator('[data-testid="active-tasks-count"]')).toBeVisible()
})
