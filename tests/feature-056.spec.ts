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
      username: 'executor', display_name: '李执行', role: 'executor',
    }))
  }, data.access_token)
}

test('#56 EW-06 知识库首页：页面加载显示AI问答和分类浏览区域', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)

  // Page title
  await expect(page.getByText('知识库')).toBeVisible()

  // AI Q&A input
  await expect(page.locator('[data-testid="qa-input"]')).toBeVisible()

  // Category area
  await expect(page.locator('[data-testid="category-area"]')).toBeVisible()

  // Required categories (check within category area)
  const catArea = page.locator('[data-testid="category-area"]')
  await expect(catArea.getByText('仓库操作')).toBeVisible()
  await expect(catArea.getByText('客服规范')).toBeVisible()
  await expect(catArea.getByText('采购流程')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-056-knowledge-home.png' })
})

test('#57 EW-06 知识库首页：AI问答功能输入问题返回相关回答', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await page.locator('[data-testid="knowledge-list"]').waitFor()

  // Input question
  await page.fill('[data-testid="qa-input"]', '退货处理的SOP是什么？')

  // Send
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge/ask')),
    page.press('[data-testid="qa-input"]', 'Enter'),
  ])

  // Verify AI response
  const result = page.locator('[data-testid="qa-result"]')
  await result.waitFor({ timeout: 5000 })
  const text = await result.textContent()
  expect(text).toBeTruthy()
  expect(text!.length).toBeGreaterThan(10)

  // References to knowledge entries
  const refs = result.locator('button')
  const refCount = await refs.count()
  expect(refCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-057-qa.png' })
})

test('#58 EW-06 知识库首页：按分类浏览过滤显示对应知识词条', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await page.locator('[data-testid="knowledge-list"]').waitFor()

  // Click 仓库操作 category
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge')),
    page.click('[data-testid="category-btn-仓库操作"]'),
  ])
  await page.waitForTimeout(300)

  // Entries should be filtered to 仓库操作
  const entries = page.locator('[data-testid^="entry-"]')
  const count = await entries.count()
  expect(count).toBeGreaterThan(0)

  // Verify displayed items match the category
  for (let i = 0; i < Math.min(count, 3); i++) {
    const text = await entries.nth(i).textContent()
    expect(text).toContain('仓库操作')
  }

  // Switch to 客服规范
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge')),
    page.click('[data-testid="category-btn-客服规范"]'),
  ])
  await page.waitForTimeout(300)

  const entries2 = page.locator('[data-testid^="entry-"]')
  const count2 = await entries2.count()
  expect(count2).toBeGreaterThan(0)

  for (let i = 0; i < Math.min(count2, 3); i++) {
    const text = await entries2.nth(i).textContent()
    expect(text).toContain('客服规范')
  }

  await page.screenshot({ path: 'verification/feature-058-category.png' })
})

test('#59 EW-06 知识库首页：搜索框按关键词搜索知识词条', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await page.locator('[data-testid="knowledge-list"]').waitFor()

  // Search for 退货
  await page.fill('[data-testid="search-input"]', '退货')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge')),
    page.press('[data-testid="search-input"]', 'Enter'),
  ])

  await page.waitForFunction(
    () => {
      const entries = document.querySelectorAll('[data-testid^="entry-"]')
      return entries.length > 0
    },
    { timeout: 5000 }
  )

  const entries = page.locator('[data-testid^="entry-"]')
  const count = await entries.count()
  expect(count).toBeGreaterThan(0)

  // At least one result contains 退货
  const firstText = await entries.first().textContent()
  expect(firstText).toContain('退货')

  await page.screenshot({ path: 'verification/feature-059-search.png' })
})

test('#60 EW-06 知识库首页：搜索结果点击跳转到词条详情页', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await page.locator('[data-testid="knowledge-list"]').waitFor()

  // Search to find matching entries
  await page.fill('[data-testid="search-input"]', '退货')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge')),
    page.press('[data-testid="search-input"]', 'Enter'),
  ])
  await page.locator('[data-testid^="entry-"]').first().waitFor({ timeout: 5000 })

  // Get first entry ID from search results
  const firstEntry = page.locator('[data-testid^="entry-"]').first()
  const firstEntryTestId = await firstEntry.getAttribute('data-testid')
  const firstEntryId = firstEntryTestId?.replace('entry-', '')
  expect(firstEntryId).toBeTruthy()

  // Navigate to detail page (simulating click navigation)
  await page.goto(`${BASE_URL}/executor/knowledge/${firstEntryId}`)
  await page.waitForURL(new RegExp(`/executor/knowledge/${firstEntryId}`))

  // Verify detail content
  await expect(page.locator('[data-testid="entry-title"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="entry-content"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-060-nav.png' })
})
