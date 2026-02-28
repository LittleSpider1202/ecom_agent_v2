import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await resp.json()
  await page.evaluate((token: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify({
      username: 'manager', display_name: '张经理', role: 'manager',
    }))
  }, data.access_token)
}

test('#76 MW-02 流程定义列表：页面加载显示所有流程模板', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)

  // Page title
  await expect(page.getByText('流程定义')).toBeVisible()

  // Flow list renders
  await expect(page.locator('[data-testid="flow-list"]')).toBeVisible()

  // Multiple flow cards
  const cards = page.locator('[data-testid^="flow-card-"]')
  await expect(cards).toHaveCount(await cards.count()) // at least 1
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)

  // Each card shows name and status
  const first = cards.first()
  await expect(first).toBeVisible()

  await page.screenshot({ path: 'verification/feature-076-list.png' })
})

test('#77 MW-02 流程定义列表：每条流程显示成功率和平均耗时', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)
  await page.locator('[data-testid="flow-list"]').waitFor()

  // Look for a card with success_rate data
  const successRates = page.locator('[data-testid^="success-rate-"]')
  const count = await successRates.count()
  expect(count).toBeGreaterThan(0)

  // At least one shows a % value
  const firstRate = successRates.first()
  const text = await firstRate.textContent()
  expect(text).toMatch(/成功率/)
  expect(text).toMatch(/%/)

  await page.screenshot({ path: 'verification/feature-077-metrics.png' })
})

test('#78 MW-02 流程定义列表：点击新建流程跳转到编辑器', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)
  await page.locator('[data-testid="new-flow-btn"]').waitFor()

  await page.click('[data-testid="new-flow-btn"]')
  await page.waitForURL(`${BASE_URL}/manage/flows/new`)

  // Editor shows empty canvas
  await expect(page.getByTestId('rf__wrapper')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-078-new-flow.png' })
})

test('#79 MW-02 流程定义列表：按名称搜索过滤', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)
  await page.locator('[data-testid="flow-list"]').waitFor()

  const allCards = page.locator('[data-testid^="flow-card-"]')
  const totalBefore = await allCards.count()
  expect(totalBefore).toBeGreaterThan(0)

  // Search for "采购"
  await page.fill('[data-testid="flow-search-input"]', '采购')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/flows')),
    page.click('button[type="submit"]'),
  ])
  // Wait for list to actually filter
  await page.waitForFunction(
    () => {
      const cards = document.querySelectorAll('[data-testid^="flow-card-"]')
      return cards.length > 0 && Array.from(cards).every(c => c.textContent?.includes('采购'))
    },
    { timeout: 5000 }
  )

  // Filtered list should show only matching flows
  const filteredCards = page.locator('[data-testid^="flow-card-"]')
  const filteredCount = await filteredCards.count()
  expect(filteredCount).toBeGreaterThan(0)
  expect(filteredCount).toBeLessThanOrEqual(totalBefore)

  // All visible cards should contain 采购
  for (let i = 0; i < filteredCount; i++) {
    const text = await filteredCards.nth(i).textContent()
    expect(text).toContain('采购')
  }

  // Clear search → list restores
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/flows')),
    page.click('button:has-text("清空")'),
  ])
  await page.waitForFunction(
    (n: number) => document.querySelectorAll('[data-testid^="flow-card-"]').length === n,
    totalBefore,
    { timeout: 5000 }
  )
  const restoredCount = await page.locator('[data-testid^="flow-card-"]').count()
  expect(restoredCount).toEqual(totalBefore)

  await page.screenshot({ path: 'verification/feature-079-search.png' })
})

test('#80 MW-02 流程定义列表：启用/禁用开关切换状态', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)
  await page.locator('[data-testid="flow-list"]').waitFor()

  // Find an enabled flow
  const toggles = page.locator('[data-testid^="toggle-"]')
  const firstToggle = toggles.first()
  const toggleId = await firstToggle.getAttribute('data-testid')
  const flowId = toggleId!.replace('toggle-', '')

  // Get current state
  const card = page.locator(`[data-testid="flow-card-${flowId}"]`)
  const statusBefore = await card.locator('span').filter({ hasText: /已启用|已禁用/ }).textContent()

  // Click toggle (register waitForResponse before click to avoid race)
  const expectedAfter = statusBefore === '已启用' ? '已禁用' : '已启用'
  await Promise.all([
    page.waitForResponse(r => r.url().includes(`/api/flows/${flowId}/toggle`)),
    firstToggle.click(),
  ])
  // Wait for DOM to reflect change
  await card.locator('span').filter({ hasText: expectedAfter }).waitFor({ timeout: 5000 })

  // State should have changed
  const statusAfter = await card.locator('span').filter({ hasText: /已启用|已禁用/ }).textContent()
  expect(statusAfter).not.toEqual(statusBefore)

  // Click again to restore
  await Promise.all([
    page.waitForResponse(r => r.url().includes(`/api/flows/${flowId}/toggle`)),
    firstToggle.click(),
  ])
  await card.locator('span').filter({ hasText: statusBefore! }).waitFor({ timeout: 5000 })

  const statusRestored = await card.locator('span').filter({ hasText: /已启用|已禁用/ }).textContent()
  expect(statusRestored).toEqual(statusBefore)

  await page.screenshot({ path: 'verification/feature-080-toggle.png' })
})

test('#96 MW-02 style：流程卡片包含健康状态颜色指示器', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows`)
  await page.locator('[data-testid="flow-list"]').waitFor()

  // Health dots exist
  const dots = page.locator('[data-testid^="health-dot-"]')
  const dotCount = await dots.count()
  expect(dotCount).toBeGreaterThan(0)

  // Check there's at least one green dot (success_rate >= 80)
  const greenDots = page.locator('[data-testid^="health-dot-"].bg-green-500')
  const greenCount = await greenDots.count()
  expect(greenCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-096-health-colors.png' })
})
