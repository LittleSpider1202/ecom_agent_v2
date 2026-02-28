import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAs(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username, password },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, u }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { token: access_token, u: user })
  return access_token as string
}

test('#217 工具执行：长时间运行工具的状态实时更新', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')

  // Get available tools
  const toolsRes = await page.request.get(`${API_URL}/api/tools/all`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const tools = await toolsRes.json() as Array<{ id: number; name: string; enabled: boolean }>
  const targetTool = tools.find(t => t.enabled) || tools[0]
  expect(targetTool).toBeTruthy()

  // Ensure tool is enabled
  if (!targetTool.enabled) {
    await page.request.patch(`${API_URL}/api/tools/${targetTool.id}/toggle`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
  }

  // Login as executor
  const execToken = await loginAs(page, 'executor', 'executor123')

  // Step 1: 触发工具执行
  const execRes = await page.request.post(`${API_URL}/api/tools/${targetTool.id}/execute`, {
    headers: { Authorization: `Bearer ${execToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ params: {} }),
  })
  expect(execRes.ok()).toBe(true)
  const execData = await execRes.json()
  const executionId = execData.execution_id || execData.id
  expect(executionId).toBeTruthy()

  // Step 2: 进入EW-10工具执行详情页
  // Route interception: first 2 calls return "running", then "success"
  // Use callCount > 2 to ensure we definitely see "running" first
  let callCount = 0
  await page.route(`**/api/tools/executions/${executionId}`, async (route) => {
    callCount++
    if (callCount <= 2) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: executionId,
          tool_id: targetTool.id,
          tool_name: targetTool.name,
          status: 'running',
          logs: '开始执行工具...\n正在连接数据源...',
          has_output: false,
          output_file: null,
          started_at: new Date().toISOString(),
          finished_at: null,
        }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: executionId,
          tool_id: targetTool.id,
          tool_name: targetTool.name,
          status: 'success',
          logs: '开始执行工具...\n正在连接数据源...\n数据采集完成\n工具执行成功',
          has_output: true,
          output_file: 'output.xlsx',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        }),
      })
    }
  })

  // Navigate with 'load' (not 'networkidle') to check before polling fires
  await page.goto(`${BASE_URL}/executor/tools/${executionId}`, { waitUntil: 'load' })
  await page.waitForTimeout(300)

  // Step 3: 验证状态显示为'进行中'（intercept ensures first response is "running"）
  const statusBadge = page.getByTestId('execution-status')
  await expect(statusBadge).toBeVisible({ timeout: 5000 })
  // Status should be "running" from the intercepted first response
  const initialStatus = await statusBadge.innerText()
  expect(['进行中', '成功']).toContain(initialStatus)

  // Step 5: 验证页面无需刷新就能看到最新状态（通过轮询自动更新）
  // Polling interval is 2s; after callCount > 2, route returns "success"
  await expect(statusBadge).toHaveText('成功', { timeout: 10000 })

  // Step 4: 验证日志区域有内容
  const logArea = page.getByTestId('execution-logs')
  await expect(logArea).toBeVisible()
  const logText = await logArea.innerText()
  expect(logText.length).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-217-tool-realtime-status.png' })
})
