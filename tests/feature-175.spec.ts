import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await resp.json()
  await page.evaluate(({ token, user }: { token: string; user: unknown }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: data.access_token, user: data.user })
  return data.access_token as string
}

async function loginAsExecutor(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'executor', password: 'executor123' },
  })
  const data = await resp.json()
  await page.evaluate(({ token, user }: { token: string; user: unknown }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: data.access_token, user: data.user })
  return data.access_token as string
}

test('#175 工作流引擎：自动节点执行失败时任务状态更新为失败', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create a flow with a failing auto node
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '测试失败节点流程',
      trigger_type: 'manual',
      nodes: [
        {
          id: 'fail1',
          type: 'auto',
          data: { label: '必然失败节点', nodeType: 'auto', should_fail: true },
          position: { x: 200, y: 100 },
        },
      ],
      edges: [],
    }),
  })
  const flowId = (await createResp.json()).id
  expect(flowId).toBeTruthy()

  // Trigger the flow
  const triggerResp = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerResp.status()).toBe(200)
  const taskId = (await triggerResp.json()).task_id

  // Task should be failed
  const taskData = await (await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  expect(taskData.status).toBe('failed')

  // DAG node should be failed
  const dagData = await (await page.request.get(`${API_URL}/api/tasks/${taskId}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  const failedNode = (dagData.nodes as Array<{ status: string }>).find(n => n.status === 'failed')
  expect(failedNode).toBeTruthy()

  await page.screenshot({ path: 'verification/feature-175-node-failure.png' })
})

test('#176 工具执行：生意参谋数据采集工具可触发并返回数据', async ({ page }) => {
  const token = await loginAsExecutor(page)

  // Get tools list via API to find the tool
  const toolsResp = await page.request.get(`${API_URL}/api/tools`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const tools = await toolsResp.json() as Array<{ id: number; name: string }>

  // Find 生意参谋 or data collection tool
  const tool = tools.find(t => t.name.includes('生意参谋') || t.name.includes('采集'))
  expect(tool).toBeTruthy()

  // Navigate to tool list page
  await page.goto(`${BASE_URL}/executor/tools`)
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-testid="tool-list"]')).toBeVisible()

  // Execute via API
  const execResp = await page.request.post(`${API_URL}/api/tools/${tool!.id}/execute`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(execResp.status()).toBe(200)
  const execData = await execResp.json()
  expect(execData.id).toBeTruthy()
  expect(execData.status).toBe('success')

  // Navigate to execution detail
  await page.goto(`${BASE_URL}/executor/tools/${execData.id}`)
  await page.waitForTimeout(500)

  // Verify execution detail is shown
  await expect(page.locator('[data-testid="execution-status"]')).toBeVisible()

  // Verify logs contain data collection output
  const logs = page.locator('[data-testid="execution-logs"]')
  await expect(logs).toBeVisible()
  const logText = await logs.textContent()
  expect(logText).toBeTruthy()
  expect(logText!.length).toBeGreaterThan(10)

  await page.screenshot({ path: 'verification/feature-176-tool-data-collect.png' })
})

test('#177 工具执行：ERP库存查询工具返回库存数据', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // Get ALL tools as manager (includes disabled)
  const allToolsResp = await page.request.get(`${API_URL}/api/tools/all`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTools = await allToolsResp.json() as Array<{ id: number; name: string; enabled: boolean }>
  const tool = allTools.find(t => t.name.includes('ERP') || t.name.includes('库存'))
  expect(tool).toBeTruthy()

  // Enable the tool if disabled
  if (!tool!.enabled) {
    await page.request.patch(`${API_URL}/api/tools/${tool!.id}/toggle`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
  }

  const token = await loginAsExecutor(page)

  // Execute via API
  const execResp = await page.request.post(`${API_URL}/api/tools/${tool!.id}/execute`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const execData = await execResp.json()
  expect(execData.id).toBeTruthy()

  // Navigate to execution detail
  await page.goto(`${BASE_URL}/executor/tools/${execData.id}`)
  await page.waitForTimeout(500)

  // Verify logs contain inventory data
  const logs = page.locator('[data-testid="execution-logs"]')
  await expect(logs).toBeVisible()
  const logText = await logs.textContent()
  // Logs should mention SKU or 库存
  expect(logText).toContain('库存')

  await page.screenshot({ path: 'verification/feature-177-erp-inventory.png' })
})

test('#178 工具执行：发货单导出工具生成Excel文件', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // Get ALL tools as manager to find shipping export tool
  const allToolsResp = await page.request.get(`${API_URL}/api/tools/all`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTools = await allToolsResp.json() as Array<{ id: number; name: string; enabled: boolean; tool_type: string }>
  const tool = allTools.find(t => t.name.includes('发货') || t.name.includes('导出'))
  expect(tool).toBeTruthy()

  // Enable if disabled
  if (!tool!.enabled) {
    await page.request.patch(`${API_URL}/api/tools/${tool!.id}/toggle`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
  }

  const token = await loginAsExecutor(page)

  // Execute via API
  const execResp = await page.request.post(`${API_URL}/api/tools/${tool!.id}/execute`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const execData = await execResp.json()
  expect(execData.id).toBeTruthy()

  // Navigate to execution detail
  await page.goto(`${BASE_URL}/executor/tools/${execData.id}`)
  await page.waitForTimeout(500)

  // Verify execution success
  const status = page.locator('[data-testid="execution-status"]')
  await expect(status).toBeVisible()
  const statusText = await status.textContent()
  expect(statusText).toContain('成功')

  // Download button should be visible (script type has output file)
  const downloadBtn = page.locator('[data-testid="download-btn"]')
  await expect(downloadBtn).toBeVisible()

  // Verify download works (API call returns xlsx)
  const downloadResp = await page.request.get(`${API_URL}/api/tools/executions/${execData.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(downloadResp.status()).toBe(200)
  const contentType = downloadResp.headers()['content-type']
  expect(contentType).toContain('spreadsheetml')

  await page.screenshot({ path: 'verification/feature-178-excel-download.png' })
})

test('#179 Python脚本工具：自定义Python脚本在沙箱中安全执行', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // Manager creates a Python script tool
  const createResp = await page.request.post(`${API_URL}/api/tools`, {
    headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '测试Python脚本',
      description: '简单Python脚本测试',
      tool_type: 'script',
      allowed_roles: ['executor', 'manager'],
      config: { script: "print('hello from python sandbox')\nprint('result: ok')" },
    }),
  })
  expect(createResp.status()).toBe(200)
  const newTool = await createResp.json()
  expect(newTool.id).toBeTruthy()

  // Executor executes the tool
  const executorToken = await loginAsExecutor(page)
  const execResp = await page.request.post(`${API_URL}/api/tools/${newTool.id}/execute`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  expect(execResp.status()).toBe(200)
  const execData = await execResp.json()
  expect(execData.id).toBeTruthy()

  // Navigate to execution detail
  await page.goto(`${BASE_URL}/executor/tools/${execData.id}`)
  await page.waitForTimeout(500)

  // Verify logs show script output
  const logs = page.locator('[data-testid="execution-logs"]')
  await expect(logs).toBeVisible()
  const logText = await logs.textContent()
  // Should contain the script output
  expect(logText).toContain('hello')

  // Status should be success
  await expect(page.locator('[data-testid="execution-status"]')).toContainText('成功')

  await page.screenshot({ path: 'verification/feature-179-python-sandbox.png' })
})
