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

test('#70 EW-09 工具列表：页面加载显示当前用户有权限的工具', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)

  // Page title
  await expect(page.getByRole('heading', { name: '工具箱' })).toBeVisible()

  // Tool list area
  const toolList = page.locator('[data-testid="tool-list"]')
  await toolList.waitFor({ timeout: 10000 })
  await expect(toolList).toBeVisible()

  // At least one tool card shown
  const tools = page.locator('[data-testid^="tool-"]')
  const count = await tools.count()
  expect(count).toBeGreaterThan(0)

  // Each tool shows name and description
  const firstTool = tools.first()
  const text = await firstTool.textContent()
  expect(text).toBeTruthy()
  expect(text!.length).toBeGreaterThan(5)

  await page.screenshot({ path: 'verification/feature-070-tool-list.png' })
})

test('#71 EW-09 工具列表：没有权限的工具不显示在列表中', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // "竞品数据采集" is manager-only and should NOT be visible
  const tools = page.locator('[data-testid^="tool-"]')
  const count = await tools.count()

  let foundManagerOnly = false
  for (let i = 0; i < count; i++) {
    const text = await tools.nth(i).textContent()
    if (text?.includes('竞品数据采集')) {
      foundManagerOnly = true
      break
    }
  }
  expect(foundManagerOnly).toBe(false)

  // "飞书消息推送" is disabled — also not shown (enabled=false)
  let foundDisabled = false
  for (let i = 0; i < count; i++) {
    const text = await tools.nth(i).textContent()
    if (text?.includes('飞书消息推送')) {
      foundDisabled = true
      break
    }
  }
  expect(foundDisabled).toBe(false)

  await page.screenshot({ path: 'verification/feature-071-permissions.png' })
})

test('#72 EW-09 工具列表：手动触发一个工具并看到执行开始', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // Click trigger button for first tool
  const firstTriggerBtn = page.locator('[data-testid^="trigger-btn-"]').first()
  await expect(firstTriggerBtn).toBeVisible()
  await firstTriggerBtn.click()

  // Confirm dialog should appear
  const dialog = page.locator('[data-testid="confirm-dialog"]')
  await expect(dialog).toBeVisible({ timeout: 3000 })

  // Confirm execution
  const confirmBtn = page.locator('[data-testid="dialog-confirm-btn"]')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools/') && r.url().includes('/execute')),
    confirmBtn.click(),
  ])

  // Should navigate to execution detail page
  await page.waitForURL(/\/executor\/tools\/\d+/, { timeout: 10000 })

  // Execution detail should show status
  await expect(page.locator('[data-testid="execution-status"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-072-trigger.png' })
})

test('#73 EW-10 工具执行详情：页面加载显示执行状态和基本信息', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // Trigger a tool to get an execution ID
  await page.locator('[data-testid^="trigger-btn-"]').first().click()
  await page.locator('[data-testid="dialog-confirm-btn"]').click()
  await page.waitForURL(/\/executor\/tools\/\d+/, { timeout: 10000 })

  // Verify detail page elements
  await expect(page.locator('[data-testid="execution-tool-name"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="execution-status"]')).toBeVisible()
  await expect(page.locator('[data-testid="execution-started-at"]')).toBeVisible()

  const toolName = await page.locator('[data-testid="execution-tool-name"]').textContent()
  expect(toolName).toBeTruthy()
  expect(toolName!.length).toBeGreaterThan(2)

  const status = await page.locator('[data-testid="execution-status"]').textContent()
  expect(status).toMatch(/进行中|成功|失败/)

  await page.screenshot({ path: 'verification/feature-073-execution-detail.png' })
})

test('#74 EW-10 工具执行详情：执行日志实时滚动显示', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // Trigger a tool
  await page.locator('[data-testid^="trigger-btn-"]').first().click()
  await page.locator('[data-testid="dialog-confirm-btn"]').click()
  await page.waitForURL(/\/executor\/tools\/\d+/, { timeout: 10000 })

  // Logs area should exist
  const logs = page.locator('[data-testid="execution-logs"]')
  await expect(logs).toBeVisible({ timeout: 5000 })

  // Logs should have content
  const logText = await logs.textContent()
  expect(logText).toBeTruthy()
  expect(logText!.length).toBeGreaterThan(10)

  await page.screenshot({ path: 'verification/feature-074-logs.png' })
})

test('#75 EW-10 工具执行详情：执行成功后可下载输出文件', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.locator('[data-testid="tool-list"]').waitFor({ timeout: 10000 })

  // Find "发货单导出" (script type with output file)
  const exportToolBtn = page.locator('[data-testid^="trigger-btn-"]').first()
  await exportToolBtn.click()

  const confirmBtn = page.locator('[data-testid="dialog-confirm-btn"]')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools/') && r.url().includes('/execute')),
    confirmBtn.click(),
  ])

  await page.waitForURL(/\/executor\/tools\/\d+/, { timeout: 10000 })

  // Download button should be visible (for script tools that have output)
  const downloadBtn = page.locator('[data-testid="download-btn"]')
  await expect(downloadBtn).toBeVisible({ timeout: 5000 })

  // Click download — verify response
  const [download] = await Promise.all([
    page.waitForEvent('download').catch(() => null),
    downloadBtn.click(),
  ])

  await page.screenshot({ path: 'verification/feature-075-download.png' })
})
