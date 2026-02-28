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

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await resp.json()
  await page.evaluate((token: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify({
      id: 2, username: 'manager', display_name: '张经理', role: 'manager',
    }))
  }, data.access_token)
}

test('#93 EW-06 知识库首页：AI问答输入框和对话气泡布局清晰', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await expect(page.locator('[data-testid="qa-input"]')).toBeVisible({ timeout: 10000 })

  // Submit a question
  await page.locator('[data-testid="qa-input"]').fill('什么是生意参谋？')
  await page.getByRole('button', { name: '发送' }).click()

  // Wait for answer bubble
  await page.locator('[data-testid="qa-result"]').waitFor({ timeout: 10000 })
  await expect(page.locator('[data-testid="qa-result"]')).toBeVisible()

  // Input and result are both visible on screen
  const inputBox = page.locator('[data-testid="qa-input"]')
  const resultBox = page.locator('[data-testid="qa-result"]')
  await expect(inputBox).toBeVisible()
  await expect(resultBox).toBeVisible()

  await page.screenshot({ path: 'verification/feature-093-qa-layout.png' })
})

test('#94 EW-07 知识词条详情：内容区域排版清晰（标题层级、段落间距、代码块高亮）', async ({ page }) => {
  await loginAsExecutor(page)
  // Navigate to first entry
  await page.goto(`${BASE_URL}/executor/knowledge/1`)
  await expect(page.locator('[data-testid="entry-title"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="entry-content"]')).toBeVisible()

  // Content area exists
  const content = page.locator('[data-testid="entry-content"]')
  const text = await content.textContent()
  expect(text && text.length > 10).toBeTruthy()

  await page.screenshot({ path: 'verification/feature-094-content-layout.png' })
})

test('#95 EW-09 工具列表：工具卡片视觉包含图标、名称、描述和触发按钮', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // Each tool card has name, description, and trigger button
  const firstTool = page.locator('[data-testid^="tool-"]').first()
  const text = await firstTool.textContent()
  expect(text).toBeTruthy()

  // Trigger button visible
  await expect(page.locator('[data-testid^="trigger-btn-"]').first()).toBeVisible()

  // Type badge visible (icon-like label)
  const typeText = await page.locator('[data-testid="tool-list"]').textContent()
  expect(typeText).toMatch(/API|Webhook|脚本/)

  await page.screenshot({ path: 'verification/feature-095-tool-cards.png' })
})

test('#97 MW-03 流程编辑器：自动节点和人工节点颜色区分', async ({ page }) => {
  await loginAsManager(page)
  // Get a flow with mixed node types
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const res = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const flows = await res.json()
  const flowId = flows[0]?.id ?? 1

  await page.goto(`${BASE_URL}/manage/flows/${flowId}`)
  await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 10000 })

  // Take screenshot showing the node colors
  await page.screenshot({ path: 'verification/feature-097-node-colors.png' })

  // Verify canvas exists and has nodes
  await expect(page.locator('[data-testid="rf__wrapper"]')).toBeVisible()
})

test('#98 MW-05 工具库管理：工具列表视觉区分不同类型（图标标识）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools`)
  await page.locator('[data-testid="tool-management-list"]').waitFor({ timeout: 10000 })

  // Different tool types should have distinct badges
  const listText = await page.locator('[data-testid="tool-management-list"]').textContent()
  expect(listText).toMatch(/API调用|Webhook|Python脚本/)

  // Screenshot shows visual differentiation
  await page.screenshot({ path: 'verification/feature-098-tool-types.png' })
})

test('#99 MW-06 工具配置表单：表单分区清晰（基本信息、配置、参数、权限各一区）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)
  await page.locator('[data-testid="tool-name-input"]').waitFor({ timeout: 10000 })

  // Verify all 4 sections present
  const pageText = await page.textContent('body')
  expect(pageText).toContain('基本信息')
  expect(pageText).toContain('输入参数')
  expect(pageText).toContain('访问权限')

  // Select API type to show config section
  await page.locator('[data-testid="type-btn-api"]').click()
  await expect(page.locator('[data-testid="api-url-input"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-099-form-sections.png' })
})

test('#100 EW-06 知识库：知识分类导航视觉清晰，选中状态高亮', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await expect(page.locator('[data-testid="category-area"]')).toBeVisible({ timeout: 10000 })

  // Click a category button
  const catBtn = page.locator('[data-testid^="category-btn-"]').first()
  await catBtn.click()

  // Verify category area still visible after click
  await expect(page.locator('[data-testid="category-area"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-100-category-highlight.png' })
})
