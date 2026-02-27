import { test, expect, Page } from '@playwright/test'

async function loginAsExecutor(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const res = await page.request.post('http://localhost:8001/api/auth/login', {
    form: { username: 'executor', password: 'executor123' },
  })
  const data = await res.json()
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { token: data.access_token, user: data.user },
  )
}

async function loginAsManager(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const res = await page.request.post('http://localhost:8001/api/auth/login', {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await res.json()
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    { token: data.access_token, user: data.user },
  )
}

test('feature-043: EW-01 dashboard layout - no horizontal scroll and two-section grid', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/dashboard')
  await page.waitForSelector('[data-testid="pending-section"]')

  // No horizontal scrollbar
  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(noHScroll).toBe(true)

  // Both sections visible
  await expect(page.locator('[data-testid="pending-section"]')).toBeVisible()
  await expect(page.locator('[data-testid="running-section"]')).toBeVisible()

  // Two sections are laid out side by side (grid)
  const pendingBox = await page.locator('[data-testid="pending-section"]').boundingBox()
  const runningBox = await page.locator('[data-testid="running-section"]').boundingBox()
  expect(pendingBox).not.toBeNull()
  expect(runningBox).not.toBeNull()
  // On desktop, they should be on the same row (same top or close)
  expect(Math.abs(pendingBox!.y - runningBox!.y)).toBeLessThan(50)

  await page.screenshot({ path: 'verification/feature-043.png' })
})

test('feature-044: EW-01 dashboard card visual style - title, badge, readable text', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/dashboard')
  await page.waitForSelector('[data-testid="pending-section"]')

  // Should have at least one pending card from seed data
  const firstCard = page.locator('[data-testid^="pending-task-"]').first()
  await expect(firstCard).toBeVisible()

  // Card has a title paragraph
  const title = firstCard.locator('p.font-medium')
  await expect(title).toBeVisible()
  const titleText = await title.textContent()
  expect(titleText!.trim().length).toBeGreaterThan(0)

  // Card has a StatusBadge (span with rounded-full)
  const badge = firstCard.locator('span.rounded-full')
  await expect(badge).toBeVisible()

  // Badge has a color class (not just plain gray)
  const badgeClass = await badge.getAttribute('class')
  expect(badgeClass).toMatch(/bg-(yellow|blue|green|red|orange)/)

  await page.screenshot({ path: 'verification/feature-044.png' })
})

test('feature-045: EW-02 task list - pending badge is yellow-colored', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')
  await page.waitForSelector('[data-testid="status-tabs"]')

  // Switch to pending tab
  await page.locator('[data-testid="tab-pending"]').click()
  await page.waitForTimeout(300)

  const rows = page.locator('[data-testid^="task-row-"]')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  // Verify pending badge color is yellow
  const firstBadge = rows.first().locator('span.rounded-full')
  await expect(firstBadge).toBeVisible()
  const cls = await firstBadge.getAttribute('class')
  expect(cls).toContain('bg-yellow')

  // Screenshot with status tabs visible
  await page.screenshot({ path: 'verification/feature-045.png' })
})

test('feature-046: EW-04 human step - layout clarity and red warning banner', async ({ page }) => {
  await loginAsExecutor(page)
  // Task 1 (seed data) has has_human_step=true — navigate directly
  await page.goto('/task/1/step/current')
  await page.waitForSelector('[data-testid="warning-banner"]')

  // Warning banner must be visible and have red color class
  const banner = page.locator('[data-testid="warning-banner"]')
  await expect(banner).toBeVisible()
  const bannerCls = await banner.getAttribute('class')
  expect(bannerCls).toMatch(/bg-red|text-red|border-red/)

  // Background section and AI suggestion section are both visible
  await expect(page.locator('[data-testid="background-section"]')).toBeVisible()
  await expect(page.locator('[data-testid="ai-suggestion-section"]')).toBeVisible()

  // Both sections are distinct (different vertical positions or labeled)
  const bgBox = await page.locator('[data-testid="background-section"]').boundingBox()
  const aiBox = await page.locator('[data-testid="ai-suggestion-section"]').boundingBox()
  expect(bgBox).not.toBeNull()
  expect(aiBox).not.toBeNull()
  // They should not overlap vertically (one above the other)
  const noOverlap = bgBox!.y + bgBox!.height <= aiBox!.y + 10 || aiBox!.y + aiBox!.height <= bgBox!.y + 10
  expect(noOverlap).toBe(true)

  await page.screenshot({ path: 'verification/feature-046.png' })
})

test('feature-047: MW-01 decision cockpit - health score is large and visible', async ({ page }) => {
  await loginAsManager(page)
  await page.goto('/manage/dashboard')
  await page.waitForSelector('[data-testid="health-gauge"]')

  // Health gauge and score value visible
  await expect(page.locator('[data-testid="health-gauge"]')).toBeVisible()
  await expect(page.locator('[data-testid="health-score-value"]')).toBeVisible()

  // Health score value has a numeric content
  const scoreText = await page.locator('[data-testid="health-score-value"]').textContent()
  expect(scoreText!.trim().length).toBeGreaterThan(0)

  // Score element should have meaningful font size (large text)
  const fontSize = await page.locator('[data-testid="health-score-value"]').evaluate(
    (el) => parseInt(window.getComputedStyle(el).fontSize),
  )
  expect(fontSize).toBeGreaterThanOrEqual(24)

  // Score element has inline color style (green/amber/red depending on score)
  const scoreEl = page.locator('[data-testid="health-score-value"]')
  const inlineStyle = await scoreEl.getAttribute('style')
  // Should have a color inline style set
  expect(inlineStyle).toMatch(/color:/)

  // No element overflow
  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(noHScroll).toBe(true)

  await page.screenshot({ path: 'verification/feature-047.png' })
})

test('feature-048: MW-03 flow editor - auto node is blue, human node is orange', async ({ page }) => {
  await loginAsManager(page)
  await page.goto('/manage/flows/new')
  await page.waitForSelector('[data-testid="node-panel"]')

  // Add an auto node by clicking panel
  await page.locator('[data-testid="panel-node-auto"]').click()
  await page.waitForSelector('[data-testid="node-auto"]')

  // Add a human node by clicking panel
  await page.locator('[data-testid="panel-node-human"]').click()
  await page.waitForSelector('[data-testid="node-human"]')

  // Auto node should have blue color class
  const autoNode = page.locator('[data-testid="node-auto"]').first()
  const autoCls = await autoNode.evaluate((el) => el.className)
  expect(autoCls).toContain('bg-blue')

  // Human node should have orange color class
  const humanNode = page.locator('[data-testid="node-human"]').first()
  const humanCls = await humanNode.evaluate((el) => el.className)
  expect(humanCls).toContain('bg-orange')

  // Nodes have visible labels
  await expect(autoNode.locator('span, p').first()).toBeVisible()
  await expect(humanNode.locator('span, p').first()).toBeVisible()

  await page.screenshot({ path: 'verification/feature-048.png' })
})

test('feature-049: MW-03 flow editor layout - panel on left, canvas main area, toolbar on top', async ({
  page,
}) => {
  await loginAsManager(page)
  await page.goto('/manage/flows/new')
  await page.waitForSelector('[data-testid="node-panel"]')

  const panel = page.locator('[data-testid="node-panel"]')
  const canvas = page.locator('[data-testid="flow-canvas"]')
  const toolbar = page.locator('[data-testid="flow-toolbar"]')

  await expect(panel).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(toolbar).toBeVisible()

  const panelBox = await panel.boundingBox()
  const canvasBox = await canvas.boundingBox()
  const toolbarBox = await toolbar.boundingBox()
  expect(panelBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  expect(toolbarBox).not.toBeNull()

  // Panel is to the LEFT of canvas (panel.x < canvas.x)
  expect(panelBox!.x).toBeLessThan(canvasBox!.x)

  // Canvas is wider than panel (canvas is main area)
  expect(canvasBox!.width).toBeGreaterThan(panelBox!.width)

  // Toolbar is ABOVE canvas (toolbar top is less than canvas top)
  expect(toolbarBox!.y).toBeLessThanOrEqual(canvasBox!.y + 10)

  await page.screenshot({ path: 'verification/feature-049.png', fullPage: true })
})

test('feature-050: MW-03 flow editor - configure cron trigger and save', async ({ page }) => {
  await loginAsManager(page)
  await page.goto('/manage/flows/new')
  await page.waitForSelector('[data-testid="flow-toolbar"]')

  // Give the flow a name
  await page.locator('[data-testid="flow-name-input"]').fill('定时触发测试流程')

  // Select cron trigger type
  const triggerSelect = page.locator('[data-testid="trigger-type-select"]')
  await triggerSelect.selectOption('cron')

  // Cron input should appear
  const cronInput = page.locator('[data-testid="cron-input"]')
  await expect(cronInput).toBeVisible()

  // Enter a cron expression
  await cronInput.fill('0 8 * * *')

  // Save the flow
  await page.locator('[data-testid="save-btn"]').click()

  // URL should update to /manage/flows/{id}
  await page.waitForURL(/\/manage\/flows\/\d+/, { timeout: 8000 })

  // Version badge should show v1
  const versionBadge = page.locator('[data-testid="version-badge"]')
  await expect(versionBadge).toContainText('v1')

  // Reload to verify persistence
  await page.reload()
  await page.waitForSelector('[data-testid="flow-toolbar"]')

  // Trigger type should still be cron
  const savedTrigger = page.locator('[data-testid="trigger-type-select"]')
  await expect(savedTrigger).toHaveValue('cron')

  // Cron expression should be persisted
  const savedCron = page.locator('[data-testid="cron-input"]')
  await expect(savedCron).toBeVisible()
  await expect(savedCron).toHaveValue('0 8 * * *')

  await page.screenshot({ path: 'verification/feature-050.png' })
})
