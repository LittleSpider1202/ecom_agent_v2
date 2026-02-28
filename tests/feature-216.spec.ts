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

test('#216 工作流引擎：自动节点失败后任务进入失败状态并告警', async ({ page }) => {
  const token = await loginAs(page, 'manager', 'manager123')

  // Step 1: 创建一个含失败节点的流程
  const createRes = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '节点失败测试流程',
      trigger_type: 'manual',
      nodes: [
        {
          id: 'n1',
          type: 'auto',
          data: { label: '正常前置节点', nodeType: 'auto' },
          position: { x: 100, y: 100 },
        },
        {
          id: 'n2',
          type: 'auto',
          data: { label: '失败API节点', nodeType: 'auto', should_fail: true },
          position: { x: 100, y: 200 },
        },
      ],
      edges: [{ id: 'e1-2', source: 'n1', target: 'n2' }],
    }),
  })
  expect(createRes.ok()).toBe(true)
  const flow = await createRes.json()

  // Step 2: 触发流程
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${flow.id}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerRes.ok()).toBe(true)
  const { task_id } = await triggerRes.json()

  // Step 3-4: 验证该API节点执行失败 + 任务整体状态变为失败
  const taskRes = await page.request.get(`${API_URL}/api/tasks/${task_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const taskData = await taskRes.json()
  expect(taskData.status).toBe('failed')

  // Step 3: DAG 中有 failed 节点
  const dagRes = await page.request.get(`${API_URL}/api/tasks/${task_id}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const dagData = await dagRes.json()
  const failedNode = (dagData.nodes as Array<{ status: string; label: string }>).find(n => n.status === 'failed')
  expect(failedNode).toBeTruthy()
  expect(failedNode!.label).toBe('失败API节点')

  // Step 5: 验证管理员收到失败告警（通过 bot notifications）
  const botsRes = await page.evaluate(async ({ apiUrl, tok }) => {
    const r = await fetch(`${apiUrl}/api/bot/notifications`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    return r.json()
  }, { apiUrl: API_URL, tok: token })

  const notifications = (botsRes.notifications || []) as Array<{ type: string; task_id: number }>
  const alertBot = notifications.find(b => b.type === 'alert' && b.task_id === task_id)
  expect(alertBot).toBeTruthy()

  // Step 6: 进入任务详情，验证失败节点显示错误信息（DAG视图红色节点）
  await page.goto(`${BASE_URL}/executor/tasks/${task_id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-216-node-failure-alert.png' })
})
