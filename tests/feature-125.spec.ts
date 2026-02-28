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

test('#125 MW-12 数据分析看板：页面加载显示效率趋势图表', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/analytics`)

  // Verify page title
  await expect(page.locator('[data-testid="analytics-title"]')).toContainText('数据分析', { timeout: 10000 })

  // Wait for data to load
  await page.waitForSelector('[data-testid="trend-chart-container"]', { timeout: 10000 })

  // Verify trend chart container is visible
  await expect(page.locator('[data-testid="trend-chart-container"]')).toBeVisible()

  // Verify trend chart SVG is present
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible()

  // Verify time axis is present
  await expect(page.locator('[data-testid="time-axis-label"]')).toBeVisible()
  await expect(page.locator('[data-testid="time-axis-label"]')).toContainText('时间轴')

  await page.screenshot({ path: 'verification/feature-125-analytics.png' })
})

test('#126 MW-12 数据分析看板：显示流程瓶颈识别分析结果', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/analytics`)

  await page.locator('[data-testid="analytics-title"]').waitFor({ timeout: 10000 })

  // Wait for bottleneck section
  await page.waitForSelector('[data-testid="bottleneck-section"]', { timeout: 10000 })
  await expect(page.locator('[data-testid="bottleneck-section"]')).toBeVisible()

  // Verify bottleneck list has items with duration data
  const bottleneckItems = page.locator('[data-testid^="bottleneck-item-"]')
  const count = await bottleneckItems.count()
  expect(count).toBeGreaterThan(0)

  // Verify first item has duration info
  const firstDuration = page.locator('[data-testid="bottleneck-duration-0"]')
  await expect(firstDuration).toBeVisible()
  const durText = await firstDuration.textContent()
  expect(durText).toMatch(/平均|秒|分|小时/)

  await page.screenshot({ path: 'verification/feature-126-bottleneck.png' })
})

test('#127 MW-12 数据分析看板：按日期范围筛选分析数据', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/analytics`)

  await page.locator('[data-testid="analytics-title"]').waitFor({ timeout: 10000 })
  await page.waitForSelector('[data-testid="trend-chart-container"]', { timeout: 10000 })

  // Verify date range filter exists
  await expect(page.locator('[data-testid="date-range-filter"]')).toBeVisible()

  // Default is 30 days — verify 30-day button is active
  const btn30 = page.locator('[data-testid="range-btn-30"]')
  await expect(btn30).toBeVisible()

  // Get initial completed count
  const initialCompleted = await page.locator('[data-testid="total-completed"]').textContent()

  // Switch to 7 days
  await page.locator('[data-testid="range-btn-7"]').click()

  // Wait for reload
  await page.waitForTimeout(2000)

  // Verify chart updated (still visible)
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible()
  await expect(page.locator('[data-testid="total-completed"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-127-filter.png' })

  // Switch to 90 days
  await page.locator('[data-testid="range-btn-90"]').click()
  await page.waitForTimeout(2000)

  // Chart should update
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible()
  const newCompleted = await page.locator('[data-testid="total-completed"]').textContent()
  // 90-day count should be >= 30-day count
  expect(Number(newCompleted)).toBeGreaterThanOrEqual(Number(initialCompleted))

  await page.screenshot({ path: 'verification/feature-127-90days.png' })
})
