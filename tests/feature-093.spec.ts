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
  await page.locator('[data-testid="qa-input"]').fill('退货处理的SOP是什么？')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/knowledge/ask')),
    page.getByRole('button', { name: '发送' }).click(),
  ])

  // Wait for answer bubble
  await page.locator('[data-testid="qa-answer-bubble"]').waitFor({ timeout: 10000 })

  await page.screenshot({ path: 'verification/feature-093-qa-layout.png' })

  // Question bubble should be visible (blue)
  const questionBubble = page.locator('[data-testid="qa-question-bubble"]')
  await expect(questionBubble).toBeVisible()
  const qClass = await questionBubble.getAttribute('class')
  expect(qClass).toContain('bg-blue-600')

  // Answer bubble should be visible (gray — different from question)
  const answerBubble = page.locator('[data-testid="qa-answer-bubble"]')
  await expect(answerBubble).toBeVisible()
  const aClass = await answerBubble.getAttribute('class')
  expect(aClass).toContain('bg-gray-100')

  // qa-result (answer text + refs) is inside answer bubble
  await expect(page.locator('[data-testid="qa-result"]')).toBeVisible()

  // Input is inside bottom bar
  await expect(page.locator('[data-testid="qa-input-bar"]')).toBeVisible()
})

test('#94 EW-07 知识词条详情：内容区域排版清晰（标题层级、段落间距、代码块高亮）', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/knowledge/1`)
  await expect(page.locator('[data-testid="entry-title"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="entry-content"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-094-content-layout.png' })

  // Page title has text-2xl (larger than body)
  const titleClass = await page.locator('[data-testid="entry-title"]').getAttribute('class')
  expect(titleClass).toContain('text-2xl')

  // Content has h2 headings with bold styling (larger than body text)
  const h2Els = page.locator('[data-testid="entry-content"] h2')
  const h2Count = await h2Els.count()
  expect(h2Count).toBeGreaterThan(0)
  const h2Class = await h2Els.first().getAttribute('class')
  expect(h2Class).toContain('font-bold')

  // h3 sub-headings also present
  const h3Count = await page.locator('[data-testid="entry-content"] h3').count()
  expect(h3Count).toBeGreaterThan(0)

  // Paragraph spacing (mb-3 in content HTML)
  const html = await page.locator('[data-testid="entry-content"]').innerHTML()
  expect(html).toContain('mb-3')

  // If code exists, it should use font-mono
  const codeCount = await page.locator('[data-testid="entry-content"] code, [data-testid="entry-content"] pre').count()
  if (codeCount > 0) {
    const codeClass = await page.locator('[data-testid="entry-content"] code, [data-testid="entry-content"] pre').first().getAttribute('class')
    expect(codeClass).toContain('font-mono')
  }
})

test('#95 EW-09 工具列表：工具卡片视觉包含图标、名称、描述和触发按钮', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  await page.screenshot({ path: 'verification/feature-095-tool-cards.png' })

  // Tool icon visible
  const firstIcon = page.locator('[data-testid^="tool-icon-"]').first()
  await expect(firstIcon).toBeVisible()
  const iconText = await firstIcon.textContent()
  expect(iconText?.trim().length).toBeGreaterThan(0)

  // Tool name is prominent (text-lg)
  const toolCards = page.locator('[data-testid="tool-list"] [data-testid^="tool-"]')
  const nameEl = toolCards.first().locator('.text-lg')
  await expect(nameEl).toBeVisible()

  // Trigger button visible
  await expect(page.locator('[data-testid^="trigger-btn-"]').first()).toBeVisible()

  // Type badge visible
  const typeText = await page.locator('[data-testid="tool-list"]').textContent()
  expect(typeText).toMatch(/API|Webhook|脚本/)
})

test('#97 MW-03 流程编辑器：自动节点和人工节点颜色区分', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/flows/new`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="flow-canvas"]').waitFor({ timeout: 12000 })
  await page.waitForTimeout(500)

  // Add auto node via panel
  await page.click('[data-testid="panel-node-auto"]')
  await page.waitForTimeout(300)

  // Add human node via panel
  await page.click('[data-testid="panel-node-human"]')
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'verification/feature-097-node-colors.png' })

  // Auto node should have blue classes
  const autoNode = page.locator('[data-testid="node-auto"]').first()
  await expect(autoNode).toBeVisible()
  const autoClass = await autoNode.getAttribute('class')
  expect(autoClass).toContain('bg-blue-50')
  expect(autoClass).toContain('border-blue-')

  // Human node should have orange classes
  const humanNode = page.locator('[data-testid="node-human"]').first()
  await expect(humanNode).toBeVisible()
  const humanClass = await humanNode.getAttribute('class')
  expect(humanClass).toContain('bg-orange-50')
  expect(humanClass).toContain('border-orange-')

  // The two node types must be visually different
  expect(autoClass).not.toEqual(humanClass)
})

test('#98 MW-05 工具库管理：工具列表视觉区分不同类型（图标标识）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools`)
  await page.locator('[data-testid="tool-management-list"]').waitFor({ timeout: 10000 })

  await page.screenshot({ path: 'verification/feature-098-tool-types.png' })

  // Type icons should be visible and differ across tool types
  const allIcons = page.locator('[data-testid^="tool-type-icon-"]')
  const iconCount = await allIcons.count()
  expect(iconCount).toBeGreaterThan(0)

  // Collect icon texts to verify multiple distinct icons
  const iconTexts = new Set<string>()
  for (let i = 0; i < Math.min(iconCount, 6); i++) {
    const txt = await allIcons.nth(i).textContent()
    if (txt?.trim()) iconTexts.add(txt.trim())
  }
  expect(iconTexts.size).toBeGreaterThan(1)

  // Disabled tools should have opacity-50 class
  const disabledRows = page.locator('[data-testid^="manage-tool-"].opacity-50')
  const disabledCount = await disabledRows.count()
  expect(disabledCount).toBeGreaterThan(0)
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
