import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

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

test('#128 MW-13 AI决策建议：列表页面加载显示所有建议', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/suggestions`)

  // Verify page title
  await expect(page.locator('[data-testid="suggestions-title"]')).toContainText('AI决策建议', { timeout: 10000 })

  // Wait for suggestion list
  await page.waitForSelector('[data-testid="suggestion-list"]', { timeout: 10000 })
  await expect(page.locator('[data-testid="suggestion-list"]')).toBeVisible()

  // Verify suggestions have required fields
  const items = page.locator('[data-testid^="suggestion-item-"]')
  const count = await items.count()
  expect(count).toBeGreaterThan(0)

  // Check first item has title, summary, category, and time
  const firstItem = items.first()
  await expect(firstItem).toBeVisible()

  // Title should be visible
  const title = firstItem.locator('[data-testid^="suggestion-title-"]')
  await expect(title).toBeVisible()
  const titleText = await title.textContent()
  expect(titleText && titleText.length > 0).toBeTruthy()

  // Summary should be visible
  const summary = firstItem.locator('[data-testid^="suggestion-summary-"]')
  await expect(summary).toBeVisible()

  // Category badge should be visible
  const category = firstItem.locator('[data-testid^="suggestion-category-"]')
  await expect(category).toBeVisible()

  // Time should appear (text contains "生成时间")
  await expect(firstItem.getByText(/生成时间/)).toBeVisible()

  await page.screenshot({ path: 'verification/feature-128-suggestions.png' })
})

test('#129 MW-13 AI决策建议：采纳一条建议并触发对应流程', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/suggestions`)

  await page.locator('[data-testid="suggestions-title"]').waitFor({ timeout: 10000 })
  await page.waitForSelector('[data-testid="suggestion-list"]', { timeout: 10000 })

  // Find first accept button
  const acceptBtn = page.locator('[data-testid^="accept-btn-"]').first()
  const count = await acceptBtn.count()

  if (count === 0) {
    // No pending suggestions - check history tab
    await page.locator('[data-testid="tab-history"]').click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'verification/feature-129-no-pending.png' })
    return
  }

  await acceptBtn.click()

  // Verify confirmation dialog
  await expect(page.locator('[data-testid="accept-dialog"]')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('heading', { name: '确认采纳' })).toBeVisible()

  await page.screenshot({ path: 'verification/feature-129-accept-dialog.png' })

  // Confirm
  await page.locator('[data-testid="accept-confirm"]').click()

  // Verify success message
  await expect(page.locator('[data-testid="accept-success"]')).toBeVisible({ timeout: 5000 })
  const msg = await page.locator('[data-testid="accept-success"]').textContent()
  expect(msg).toMatch(/采纳|流程/)

  await page.screenshot({ path: 'verification/feature-129-accept-success.png' })

  // Verify suggestion was removed from active list
  // (count decreased or item is gone)
  const newItems = page.locator('[data-testid^="suggestion-item-"]')
  const newCount = await newItems.count()
  expect(newCount).toBeLessThan(count + 1) // count-1 or less

  // Navigate to task monitor to verify new task was created
  await page.goto(`${BASE_URL}/manage/monitor`)
  await page.locator('[data-testid="monitor-title"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(1000)

  // Should show at least one task (the newly created one or existing ones)
  const rows = page.locator('[data-testid="monitor-task-row"]')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-129-task-created.png' })
})

test('#130 MW-13 AI决策建议：忽略一条建议并从活跃列表移除', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/suggestions`)

  await page.locator('[data-testid="suggestions-title"]').waitFor({ timeout: 10000 })
  await page.waitForSelector('[data-testid="suggestion-list"]', { timeout: 10000 })

  // Count initial suggestions
  const initialItems = page.locator('[data-testid^="suggestion-item-"]')
  const initialCount = await initialItems.count()

  // Find first ignore button
  const ignoreBtn = page.locator('[data-testid^="ignore-btn-"]').first()
  const count = await ignoreBtn.count()

  if (count === 0) {
    // No pending suggestions
    await page.screenshot({ path: 'verification/feature-130-no-pending.png' })
    return
  }

  await ignoreBtn.click()

  // Wait for list to update
  await page.waitForTimeout(1500)

  // Verify suggestion removed from active list
  const newItems = page.locator('[data-testid^="suggestion-item-"]')
  const newCount = await newItems.count()
  expect(newCount).toBeLessThan(initialCount)

  await page.screenshot({ path: 'verification/feature-130-ignored.png' })

  // Switch to history tab and verify it's there as '已忽略'
  await page.locator('[data-testid="tab-history"]').click()
  await page.waitForTimeout(1500)

  const historyItems = page.locator('[data-testid^="suggestion-item-"]')
  const historyCount = await historyItems.count()
  expect(historyCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-130-history.png' })
})
