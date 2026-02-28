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
      id: 2, username: 'manager', display_name: '张经理', role: 'manager',
    }))
  }, data.access_token)
}

async function getFlowWithVersions(page: Page): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  // Get all flows and find one with multiple versions (or create one)
  const res = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const flows = await res.json()
  return flows[0]?.id ?? 1
}

test('#81 MW-04 流程版本历史：页面加载显示该流程所有历史版本', async ({ page }) => {
  await loginAsManager(page)

  const flowId = await getFlowWithVersions(page)
  await page.goto(`${BASE_URL}/manage/flows/${flowId}/versions`)

  // Title
  await expect(page.locator('[data-testid="versions-title"]')).toBeVisible({ timeout: 10000 })

  // Versions list
  const versionsList = page.locator('[data-testid="versions-list"]')
  await versionsList.waitFor({ timeout: 10000 })
  await expect(versionsList).toBeVisible()

  // At least one version item
  const vItems = page.locator('[data-testid^="version-item-v"]')
  const count = await vItems.count()
  expect(count).toBeGreaterThan(0)

  // Version item shows version number and time
  const firstItem = vItems.first()
  const text = await firstItem.textContent()
  expect(text).toMatch(/v\d+/)

  await page.screenshot({ path: 'verification/feature-081-versions-list.png' })
})

test('#82 MW-04 流程版本历史：选择两个版本进行差异对比', async ({ page }) => {
  await loginAsManager(page)

  const flowId = await getFlowWithVersions(page)
  await page.goto(`${BASE_URL}/manage/flows/${flowId}/versions`)
  await page.locator('[data-testid="versions-list"]').waitFor({ timeout: 10000 })

  // Need at least 2 versions — if only 1, create another by saving flow
  const vItems = page.locator('[data-testid^="version-item-v"]')
  let count = await vItems.count()

  if (count < 2) {
    // Save flow to create v2
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const flowRes = await page.request.get(`${API_URL}/api/flows/${flowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const flow = await flowRes.json()
    await page.request.put(`${API_URL}/api/flows/${flowId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: flow.name, nodes: flow.nodes || [], edges: flow.edges || [] }),
    })
    await page.reload()
    await page.locator('[data-testid="versions-list"]').waitFor({ timeout: 10000 })
    count = await page.locator('[data-testid^="version-item-v"]').count()
  }

  expect(count).toBeGreaterThanOrEqual(2)

  // Select first two version checkboxes
  const checkboxes = page.locator('[data-testid^="version-check-v"]')
  await checkboxes.nth(0).click()
  await checkboxes.nth(1).click()

  // Diff button should appear
  const diffBtn = page.locator('[data-testid="diff-btn"]')
  await expect(diffBtn).toBeVisible({ timeout: 3000 })
  await diffBtn.click()

  // Diff view should appear
  const diffView = page.locator('[data-testid="diff-view"]')
  await expect(diffView).toBeVisible({ timeout: 5000 })

  // Diff highlight should show
  await expect(page.locator('[data-testid="diff-highlight"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-082-version-diff.png' })
})

test('#83 MW-04 流程版本历史：回滚到历史版本并确认', async ({ page }) => {
  await loginAsManager(page)

  const flowId = await getFlowWithVersions(page)
  await page.goto(`${BASE_URL}/manage/flows/${flowId}/versions`)
  await page.locator('[data-testid="versions-list"]').waitFor({ timeout: 10000 })

  // Ensure 2+ versions exist
  let vItems = page.locator('[data-testid^="version-item-v"]')
  let count = await vItems.count()

  if (count < 2) {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const flowRes = await page.request.get(`${API_URL}/api/flows/${flowId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const flow = await flowRes.json()
    await page.request.put(`${API_URL}/api/flows/${flowId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: flow.name, nodes: flow.nodes || [], edges: flow.edges || [] }),
    })
    await page.reload()
    await page.locator('[data-testid="versions-list"]').waitFor({ timeout: 10000 })
    vItems = page.locator('[data-testid^="version-item-v"]')
    count = await vItems.count()
  }

  // Click rollback on oldest version (last in the list since sorted desc)
  const rollbackBtns = page.locator('[data-testid^="rollback-btn-v"]')
  const rbCount = await rollbackBtns.count()
  expect(rbCount).toBeGreaterThan(0)

  await rollbackBtns.last().click()

  // Confirm dialog should appear
  const dialog = page.locator('[data-testid="rollback-dialog"]')
  await expect(dialog).toBeVisible({ timeout: 3000 })
  const dialogText = await dialog.textContent()
  expect(dialogText).toMatch(/回滚/)

  // Confirm
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/rollback')),
    page.locator('[data-testid="dialog-rollback-btn"]').click(),
  ])

  // Success message
  await expect(page.locator('[data-testid="rollback-success"]')).toBeVisible({ timeout: 5000 })

  // Version list updated (new version added)
  await page.locator('[data-testid="versions-list"]').waitFor({ timeout: 5000 })
  const newCount = await page.locator('[data-testid^="version-item-v"]').count()
  expect(newCount).toBeGreaterThan(count)

  await page.screenshot({ path: 'verification/feature-083-rollback.png' })
})

test('#84 MW-05 工具库管理：页面加载显示所有工具列表', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools`)

  // Page title
  await expect(page.getByRole('heading', { name: '工具库' })).toBeVisible({ timeout: 10000 })

  // Tool list
  const list = page.locator('[data-testid="tool-management-list"]')
  await list.waitFor({ timeout: 10000 })
  await expect(list).toBeVisible()

  // Tools shown with type labels
  const rows = page.locator('[data-testid^="manage-tool-"]')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  // Check type labels visible (API调用, Webhook, Python脚本)
  const rowText = await list.textContent()
  expect(rowText).toMatch(/API调用|Webhook|Python脚本/)

  await page.screenshot({ path: 'verification/feature-084-tool-management.png' })
})

test('#85 MW-05 工具库管理：显示每个工具的调用次数统计', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools`)
  await page.locator('[data-testid="tool-management-list"]').waitFor({ timeout: 10000 })

  // Find tool with call count > 0
  const callCounts = page.locator('[data-testid^="call-count-"]')
  const count = await callCounts.count()
  expect(count).toBeGreaterThan(0)

  // At least one should have a non-zero count
  let hasNonZero = false
  for (let i = 0; i < count; i++) {
    const text = await callCounts.nth(i).textContent()
    if (text && parseInt(text.replace(/,/g, '')) > 0) {
      hasNonZero = true
      break
    }
  }
  expect(hasNonZero).toBe(true)

  // Success rate shown
  const successRates = page.locator('[data-testid^="success-rate-"]')
  const srCount = await successRates.count()
  expect(srCount).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-085-tool-stats.png' })
})

test('#86 MW-05 工具库管理：启用/禁用工具', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools`)
  await page.locator('[data-testid="tool-management-list"]').waitFor({ timeout: 10000 })

  // Find an enabled tool
  const enabledRow = page.locator('[data-testid^="manage-tool-"]').filter({
    has: page.locator('[data-testid^="tool-status-"]', { hasText: '已启用' }),
  }).first()

  const toolTestId = await enabledRow.getAttribute('data-testid')
  const toolId = toolTestId?.replace('manage-tool-', '')

  // Verify status before using page-level locator (not scoped to enabledRow, which would go stale)
  const statusEl = page.locator(`[data-testid="tool-status-${toolId}"]`)
  await expect(statusEl).toHaveText('已启用')

  // Click disable
  const toggleBtn = page.locator(`[data-testid="toggle-tool-${toolId}"]`)
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools/') && r.url().includes('/toggle')),
    toggleBtn.click(),
  ])

  // Status should change to 已禁用
  await expect(statusEl).toHaveText('已禁用', { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-086-toggle-tool.png' })
})
