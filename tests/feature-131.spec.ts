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

test('#131 MW-13 AI决策建议：查看历史决策记录（采纳/忽略记录）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/suggestions`)

  await page.locator('[data-testid="suggestions-title"]').waitFor({ timeout: 10000 })

  // Click "决策记录" tab
  const historyTab = page.locator('[data-testid="tab-history"]')
  await expect(historyTab).toBeVisible()
  await historyTab.click()

  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'verification/feature-131-history-tab.png' })

  // Should show history items or empty state
  const historyItems = page.locator('[data-testid^="suggestion-item-"]')
  const count = await historyItems.count()

  if (count > 0) {
    // Verify items show decision type info
    const firstItem = historyItems.first()
    await expect(firstItem).toBeVisible()

    // Category badge visible
    const category = firstItem.locator('[data-testid^="suggestion-category-"]')
    await expect(category).toBeVisible()

    // decided_at info should appear if available
    const decidedAt = firstItem.locator('[data-testid^="decided-at-"]')
    const decidedCount = await decidedAt.count()
    if (decidedCount > 0) {
      await expect(decidedAt.first()).toBeVisible()
      const text = await decidedAt.first().textContent()
      expect(text).toMatch(/决策时间|已采纳|已忽略/)
    }
  }

  // Tab itself should be visible and be labeled correctly
  await expect(historyTab).toContainText('决策记录')
})

test('#132 MW-14 平台集成配置：页面加载显示各平台集成状态', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/integrations`)

  await expect(page.locator('[data-testid="integrations-title"]')).toContainText('平台集成配置', { timeout: 10000 })
  await page.waitForSelector('[data-testid="integration-list"]', { timeout: 10000 })

  // Verify three integration platforms are shown
  await expect(page.locator('[data-testid="intg-status-feishu"]')).toBeVisible()
  await expect(page.locator('[data-testid="intg-status-erp"]')).toBeVisible()
  await expect(page.locator('[data-testid="intg-status-taobao"]')).toBeVisible()

  // Each shows a connection status (已连接 or 未连接)
  const feishuCard = page.locator('[data-testid="intg-status-feishu"]')
  await expect(feishuCard).toBeVisible()
  const feishuText = await feishuCard.textContent()
  expect(feishuText).toMatch(/已连接|未连接/)

  await page.screenshot({ path: 'verification/feature-132-integrations.png' })
})

test('#133 MW-14 平台集成配置：配置飞书Bot Token并测试连接', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/integrations`)

  await page.locator('[data-testid="integrations-title"]').waitFor({ timeout: 10000 })

  // Find Feishu config section
  await expect(page.locator('[data-testid="feishu-section"]')).toBeVisible()

  // Input App ID
  await page.locator('[data-testid="feishu-app-id"]').fill('cli_test_app_id_123')

  // Input App Secret
  await page.locator('[data-testid="feishu-app-secret"]').fill('test_app_secret_456')

  // Click test connection
  await page.locator('[data-testid="feishu-test-btn"]').click()

  // Wait for result
  await page.locator('[data-testid="feishu-result"]').waitFor({ timeout: 10000 })

  // Verify feedback is shown (success or failure)
  const result = page.locator('[data-testid="feishu-result"]')
  await expect(result).toBeVisible()
  const resultText = await result.textContent()
  expect(resultText && resultText.length > 0).toBeTruthy()

  await page.screenshot({ path: 'verification/feature-133-feishu-test.png' })
})

test('#134 MW-14 平台集成配置：配置ERP系统API对接信息', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/integrations`)

  await page.locator('[data-testid="integrations-title"]').waitFor({ timeout: 10000 })

  // Find ERP config section
  await expect(page.locator('[data-testid="erp-section"]')).toBeVisible()

  // Input API URL
  await page.locator('[data-testid="erp-api-url"]').fill('https://erp.test.com/api')

  // Input API Key
  await page.locator('[data-testid="erp-api-key"]').fill('test-erp-api-key-789')

  // Click save
  await page.locator('[data-testid="erp-save-btn"]').click()

  // Verify save success
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="save-success"]')).toContainText('ERP')

  await page.screenshot({ path: 'verification/feature-134-erp-save.png' })
})

test('#135 MW-14 平台集成配置：配置电商平台（淘宝/天猫）对接信息', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/integrations`)

  await page.locator('[data-testid="integrations-title"]').waitFor({ timeout: 10000 })

  // Find Taobao config section
  await expect(page.locator('[data-testid="taobao-section"]')).toBeVisible()

  // Select platform type
  await page.locator('[data-testid="taobao-platform-select"]').selectOption('taobao')

  // Input App Key
  await page.locator('[data-testid="taobao-app-key"]').fill('test_taobao_app_key')

  // Input App Secret
  await page.locator('[data-testid="taobao-app-secret"]').fill('test_taobao_secret')

  // Click save
  await page.locator('[data-testid="taobao-save-btn"]').click()

  // Verify success
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="save-success"]')).toContainText(/淘宝|配置保存/)

  await page.screenshot({ path: 'verification/feature-135-taobao-save.png' })
})
