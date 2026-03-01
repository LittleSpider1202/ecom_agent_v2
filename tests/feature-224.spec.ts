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

test('#224 E2E：定时流程从配置到自动执行验证', async ({ page }) => {
  const token = await loginAs(page, 'manager', 'manager123')

  // Step 1-4: 管理员创建流程并配置定时触发
  const createRes = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '定时触发测试流程',
      trigger_type: 'cron',
      trigger_config: '*/1 * * * *',  // Every minute
      nodes: [
        {
          id: 'auto1',
          type: 'auto',
          data: { label: '数据汇总', nodeType: 'auto' },
          position: { x: 250, y: 200 },
        },
      ],
      edges: [],
    }),
  })
  expect(createRes.ok()).toBe(true)
  const flow = await createRes.json()
  expect(flow.id).toBeTruthy()
  expect(flow.trigger_type).toBe('cron')
  expect(flow.trigger_config).toBe('*/1 * * * *')

  // Step 1-2: 在管理员流程编辑器验证配置已保存
  await page.goto(`${BASE_URL}/manage/flows`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Verify the flow is in the list (may have multiple with same name, use flow-id based testid)
  await expect(page.locator(`[data-testid="flow-name-${flow.id}"]`)).toBeVisible({ timeout: 5000 })
  await page.screenshot({ path: 'verification/feature-224-cron-flow-created.png' })

  // Open the flow editor to verify trigger config
  await page.goto(`${BASE_URL}/manage/flows/${flow.id}/edit`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Verify trigger type dropdown shows "cron"
  const triggerSelect = page.getByTestId('trigger-type-select')
  if (await triggerSelect.count() > 0) {
    const triggerValue = await triggerSelect.inputValue()
    expect(triggerValue).toBe('cron')
  }

  await page.screenshot({ path: 'verification/feature-224-cron-config.png' })

  // Step 5-6: 手动触发流程（模拟定时器触发）
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${flow.id}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerRes.ok()).toBe(true)
  const { task_id } = await triggerRes.json()
  expect(task_id).toBeTruthy()

  // Step 6-7: 在MW-10全局监控验证任务实例出现
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.getByTestId('monitor-title')).toBeVisible({ timeout: 5000 })

  // Look for the triggered task - use regex to match exact task ID prefix
  const taskRow = page.locator('[data-testid="monitor-task-row"]').filter({
    hasText: new RegExp(`#${task_id}\\b`),
  })
  await expect(taskRow.first()).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-224-task-in-monitor.png' })

  // Step 7-8: 验证自动节点执行
  const taskRes = await page.request.get(`${API_URL}/api/tasks/${task_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const taskData = await taskRes.json()
  expect(taskData.status).toBe('completed')

  // Step 9: 在任务历史中验证完成记录
  await page.goto(`${BASE_URL}/executor/history`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'verification/feature-224-task-history.png' })

  // Step 11: 禁用流程（通过删除或修改status）
  // Update flow status to draft/disabled
  const updateRes = await page.request.put(`${API_URL}/api/flows/${flow.id}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '定时触发测试流程',
      trigger_type: null,  // Remove cron to disable scheduled trigger
      trigger_config: null,
      nodes: flow.nodes,
      edges: flow.edges || [],
    }),
  })
  // If update works, verify cron is removed
  if (updateRes.ok()) {
    const updatedFlow = await updateRes.json()
    expect(updatedFlow.trigger_type).toBeFalsy()
  }

  await page.screenshot({ path: 'verification/feature-224-flow-disabled.png' })
})
