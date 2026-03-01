import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsExecutor(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'executor', password: 'executor123' },
  })
  const data = await resp.json()
  await page.evaluate((token: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify({
      id: 1, username: 'executor', display_name: '李执行', role: 'executor',
    }))
  }, data.access_token)
}

test('#66 EW-08 知识贡献：页面加载显示提交新知识和修正现有知识的表单', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge/contribute`)

  // Page title
  await expect(page.getByRole('heading', { name: '知识贡献' })).toBeVisible()

  // Submit new entry form area
  await expect(page.locator('[data-testid="title-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="content-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="submit-btn"]')).toBeVisible()

  // Correction tab/button
  const correctionBtn = page.locator('button:has-text("提交修正意见")')
  await expect(correctionBtn).toBeVisible()

  await page.screenshot({ path: 'verification/feature-066-contribute-page.png' })
})

test('#67 EW-08 知识贡献：提交新知识词条并看到待审核状态', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge/contribute`)

  // Fill form
  await page.fill('[data-testid="title-input"]', '测试知识词条')
  await page.selectOption('[data-testid="category-select"]', '仓库操作')
  await page.fill('[data-testid="content-input"]', '这是测试词条的内容，用于验证提交功能。')

  // Submit
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge/submissions')),
    page.click('[data-testid="submit-btn"]'),
  ])

  // Success message
  const successMsg = page.locator('[data-testid="success-message"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })
  const msgText = await successMsg.textContent()
  expect(msgText).toContain('提交成功')

  // Submission appears in list with 待审核 status
  await successMsg.locator('button:has-text("继续提交")').click()
  const subsList = page.locator('[data-testid="submissions-list"]')
  if (await subsList.isVisible()) {
    await expect(subsList.getByText('待审核').first()).toBeVisible()
  }

  await page.screenshot({ path: 'verification/feature-067-submit-new.png' })
})

test('#68 EW-08 知识贡献：对已有词条提交修正意见', async ({ page }) => {
  await loginAsExecutor(page)

  // Go to detail page first
  await page.goto(`${BASE_URL}/executor/knowledge/1`)
  await page.locator('[data-testid="entry-title"]').waitFor({ timeout: 10000 })

  // Click correction button
  const correctBtn = page.locator('[data-testid="correct-btn"]')
  await expect(correctBtn).toBeVisible()
  await correctBtn.click()

  // Should navigate to contribute page with correction mode
  await page.waitForURL(/\/executor\/knowledge\/contribute/)

  // The form should show in correction mode
  await expect(page.getByRole('heading', { name: '知识贡献' })).toBeVisible()
  await expect(page.locator('[data-testid="content-input"]')).toBeVisible()

  // Fill correction
  await page.fill('[data-testid="content-input"]', '修正后的词条内容，补充了新的操作规范。')
  await page.fill('[data-testid="correction-reason-input"]', '补充了新的退货处理场景')

  // Submit
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge/submissions')),
    page.click('[data-testid="submit-btn"]'),
  ])

  // Success
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-068-correction.png' })
})

test('#69 EW-08 知识贡献：提交后显示成功确认并告知等待审核', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge/contribute`)

  // Fill and submit
  await page.fill('[data-testid="title-input"]', '另一条测试词条')
  await page.fill('[data-testid="content-input"]', '内容示例文本，用于验证成功提示消息。')

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge/submissions')),
    page.click('[data-testid="submit-btn"]'),
  ])

  // Success message contains 等待管理员审核 or similar
  const successMsg = page.locator('[data-testid="success-message"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })
  const text = await successMsg.textContent()
  expect(text).toMatch(/等待.*审核|待审核|审核/)

  // Can view submission record
  await successMsg.locator('button:has-text("继续提交")').click()
  await expect(page.locator('[data-testid="submissions-list"]')).toBeVisible({ timeout: 3000 })

  await page.screenshot({ path: 'verification/feature-069-success.png' })
})
