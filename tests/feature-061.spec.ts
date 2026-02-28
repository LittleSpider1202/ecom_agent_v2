import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

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

async function gotoEntry(page: Page, entryId = 1) {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge/${entryId}`)
  await page.locator('[data-testid="entry-title"]').waitFor({ timeout: 10000 })
}

test('#61 EW-07 知识词条详情：页面加载显示词条完整内容', async ({ page }) => {
  await gotoEntry(page, 1)

  // Title
  const title = page.locator('[data-testid="entry-title"]')
  await expect(title).toBeVisible()
  const titleText = await title.textContent()
  expect(titleText).toBeTruthy()
  expect(titleText!.length).toBeGreaterThan(2)

  // Content
  await expect(page.locator('[data-testid="entry-content"]')).toBeVisible()

  // Category
  await expect(page.locator('[data-testid="entry-category"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-061-detail.png' })
})

test('#62 EW-07 知识词条详情：SOP内容支持结构化格式', async ({ page }) => {
  await gotoEntry(page, 1) // 退货处理SOP - has structured content

  const content = page.locator('[data-testid="entry-content"]')
  await expect(content).toBeVisible()

  // Should have heading elements (rendered from Markdown)
  const headings = content.locator('h1, h2, h3')
  const headingCount = await headings.count()
  expect(headingCount).toBeGreaterThan(0)

  // Should have list items
  const listItems = content.locator('li')
  const listCount = await listItems.count()
  expect(listCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-062-sop-format.png' })
})

test('#63 EW-07 知识词条详情：点击有帮助按钮记录反馈', async ({ page }) => {
  await gotoEntry(page, 1)

  // Find helpful button
  const helpfulBtn = page.locator('[data-testid="helpful-btn"]')
  await expect(helpfulBtn).toBeVisible()

  // Get initial count
  const countEl = page.locator('[data-testid="helpful-count"]')
  const initialText = await countEl.textContent()
  const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0')

  // Click helpful
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge') && r.url().includes('/helpful')),
    helpfulBtn.click(),
  ])

  // Count should increase
  const newText = await countEl.textContent()
  const newCount = parseInt(newText?.match(/\d+/)?.[0] || '0')
  expect(newCount).toBeGreaterThan(initialCount)

  // Button state should change (disabled/clicked)
  await expect(helpfulBtn).toBeDisabled()

  await page.screenshot({ path: 'verification/feature-063-helpful.png' })
})

test('#64 EW-07 知识词条详情：显示版本号和最后更新时间', async ({ page }) => {
  await gotoEntry(page, 1)

  // Version number
  const version = page.locator('[data-testid="entry-version"]')
  await expect(version).toBeVisible()
  const versionText = await version.textContent()
  expect(versionText).toMatch(/v\d/)

  // Updated time
  const updated = page.locator('[data-testid="entry-updated"]')
  await expect(updated).toBeVisible()
  const updatedText = await updated.textContent()
  expect(updatedText).toContain('更新时间')

  await page.screenshot({ path: 'verification/feature-064-metadata.png' })
})

test('#65 EW-07 知识词条详情：显示查看次数统计', async ({ page }) => {
  await gotoEntry(page, 1)

  // View count
  const views = page.locator('[data-testid="entry-views"]')
  await expect(views).toBeVisible()
  const viewText = await views.textContent()
  expect(viewText).toContain('查看次数')
  const count = parseInt(viewText?.match(/\d+/)?.[0] || '0')
  expect(count).toBeGreaterThan(0)

  // Reload - view count should not decrease
  const countBefore = count
  await page.goto(page.url())
  await page.locator('[data-testid="entry-title"]').waitFor({ timeout: 10000 })
  const viewsAfter = page.locator('[data-testid="entry-views"]')
  const viewTextAfter = await viewsAfter.textContent()
  const countAfter = parseInt(viewTextAfter?.match(/\d+/)?.[0] || '0')
  expect(countAfter).toBeGreaterThanOrEqual(countBefore)

  await page.screenshot({ path: 'verification/feature-065-views.png' })
})
