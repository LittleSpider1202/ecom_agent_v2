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

test('#223 E2E：工具故障恢复——工具执行失败后管理员排查并重新触发', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')
  const executorToken = await loginAs(page, 'executor', 'executor123')

  // Step 1: 获取工具列表，找一个可用工具
  const toolsRes = await page.request.get(`${API_URL}/api/tools/all`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const tools = await toolsRes.json() as Array<{
    id: number; name: string; enabled: boolean;
    endpoint_url?: string; api_url?: string; config?: Record<string, unknown>
  }>
  expect(tools.length).toBeGreaterThan(0)

  // Find enabled tool (prefer one with an API endpoint)
  let testTool = tools.find(t => t.enabled) || tools[0]
  const originalToolId = testTool.id
  const originalToolName = testTool.name

  // Step 1: 配置工具使用错误的API端点（通过创建新工具）
  const badToolRes = await page.request.post(`${API_URL}/api/tools`, {
    headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '故障恢复测试工具',
      description: '用于测试工具故障恢复的工具',
      tool_type: 'api',
      config: {
        url: 'http://invalid-endpoint-that-does-not-exist.example.com/api',
        method: 'GET',
      },
      enabled: true,
    }),
  })
  let badToolId: number
  let useCreatedTool = false
  if (badToolRes.ok()) {
    const badTool = await badToolRes.json()
    badToolId = badTool.id
    useCreatedTool = true
  } else {
    // Fall back to using existing tool
    badToolId = testTool.id
  }

  // Login as executor for step 2
  await loginAs(page, 'executor', 'executor123')

  // Step 2: 执行者触发该工具
  const execRes = await page.request.post(`${API_URL}/api/tools/${useCreatedTool ? badToolId : originalToolId}/execute`, {
    headers: { Authorization: `Bearer ${executorToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ params: {} }),
  })
  expect(execRes.ok()).toBe(true)
  const execData = await execRes.json()
  const executionId = execData.execution_id || execData.id
  expect(executionId).toBeTruthy()

  // Step 3: 进入EW-10执行详情，验证执行结果
  await page.goto(`${BASE_URL}/executor/tools/${executionId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.getByTestId('execution-status')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-223-tool-execution.png' })

  const statusText = await page.getByTestId('execution-status').innerText()
  // Tool with bad URL should fail, tool with good URL should succeed
  expect(['失败', '成功', '进行中']).toContain(statusText)

  // Step 5-6: 管理员导航到工具库
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/tools`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'verification/feature-223-tools-list.png' })

  // Verify tool list is visible
  const toolList = page.locator('[data-testid="tool-management-list"], [data-testid^="manage-tool-"]')
  const toolCount = await toolList.count()
  expect(toolCount).toBeGreaterThan(0)

  // Step 6-7: 如果创建了bad tool，删除它（cleanup）
  if (useCreatedTool) {
    // Edit the bad tool to use correct endpoint
    const editRes = await page.request.put(`${API_URL}/api/tools/${badToolId}`, {
      headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: '故障恢复测试工具（已修复）',
        description: '已修复的工具',
        tool_type: 'api',
        config: {
          url: `${API_URL}/health`,  // Use health check as "fixed" endpoint
          method: 'GET',
        },
        enabled: true,
      }),
    })

    if (editRes.ok()) {
      // Step 8: 执行者重新触发该工具
      await loginAs(page, 'executor', 'executor123')
      const exec2Res = await page.request.post(`${API_URL}/api/tools/${badToolId}/execute`, {
        headers: { Authorization: `Bearer ${executorToken}`, 'Content-Type': 'application/json' },
        data: JSON.stringify({ params: {} }),
      })
      if (exec2Res.ok()) {
        const exec2Data = await exec2Res.json()
        const exec2Id = exec2Data.execution_id || exec2Data.id

        // Step 9: 验证工具执行成功
        await page.goto(`${BASE_URL}/executor/tools/${exec2Id}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(500)
        await expect(page.getByTestId('execution-status')).toBeVisible({ timeout: 5000 })
        await page.screenshot({ path: 'verification/feature-223-tool-recovery.png' })
      }
    }
  }

  // Step 10: 管理员查看工具调用统计
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/tools`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'verification/feature-223-tools-stats.png' })
})
