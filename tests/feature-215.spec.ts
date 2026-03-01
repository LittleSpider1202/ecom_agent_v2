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

test('#215 工作流引擎：多个顺序自动节点完整链式执行', async ({ page }) => {
  const token = await loginAs(page, 'manager', 'manager123')

  // Step 1: 创建一个有5个顺序自动节点的流程
  const nodes = [
    { id: 'n1', type: 'auto', data: { label: '数据采集', nodeType: 'auto' }, position: { x: 100, y: 100 } },
    { id: 'n2', type: 'auto', data: { label: '数据清洗', nodeType: 'auto' }, position: { x: 100, y: 200 } },
    { id: 'n3', type: 'auto', data: { label: '数据分析', nodeType: 'auto' }, position: { x: 100, y: 300 } },
    { id: 'n4', type: 'auto', data: { label: '生成报告', nodeType: 'auto' }, position: { x: 100, y: 400 } },
    { id: 'n5', type: 'auto', data: { label: '发送通知', nodeType: 'auto' }, position: { x: 100, y: 500 } },
  ]
  const edges = [
    { id: 'e1-2', source: 'n1', target: 'n2' },
    { id: 'e2-3', source: 'n2', target: 'n3' },
    { id: 'e3-4', source: 'n3', target: 'n4' },
    { id: 'e4-5', source: 'n4', target: 'n5' },
  ]
  const createRes = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ name: '五节点顺序测试流程', trigger_type: 'manual', nodes, edges }),
  })
  expect(createRes.ok()).toBe(true)
  const flow = await createRes.json()
  expect(flow.id).toBeTruthy()

  // Step 3: 触发流程
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${flow.id}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerRes.ok()).toBe(true)
  const { task_id } = await triggerRes.json()
  expect(task_id).toBeTruthy()

  // Step 4-6: 在任务详情页验证 DAG 执行
  await page.goto(`${BASE_URL}/executor/tasks/${task_id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Step 7: 验证任务总状态为已完成
  const taskRes = await page.request.get(`${API_URL}/api/tasks/${task_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const taskData = await taskRes.json()
  expect(taskData.status).toBe('completed')

  // Step 5-6: 验证 DAG 中所有5个节点都已完成
  const dagRes = await page.request.get(`${API_URL}/api/tasks/${task_id}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const dagData = await dagRes.json()
  const dagNodes = dagData.nodes as Array<{ status: string; label: string }>
  expect(dagNodes.length).toBe(5)

  const completedNodes = dagNodes.filter(n => n.status === 'completed')
  expect(completedNodes.length).toBe(5)

  // Verify node labels (sequential)
  const labels = dagNodes.map(n => n.label)
  expect(labels).toContain('数据采集')
  expect(labels).toContain('数据清洗')
  expect(labels).toContain('数据分析')
  expect(labels).toContain('生成报告')
  expect(labels).toContain('发送通知')

  // Verify UI shows the DAG
  await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-215-sequential-nodes.png' })
})
