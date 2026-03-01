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

test('#180 知识库RAG：AI问答基于知识库内容回答电商相关问题', async ({ page }) => {
  await loginAsExecutor(page)

  // Navigate to knowledge base
  await page.goto(`${BASE_URL}/executor/knowledge`)
  await page.waitForTimeout(1500)

  // Find and click the Q&A input
  const qaInput = page.locator('[data-testid="qa-input"]')
  await expect(qaInput).toBeVisible()

  // Ask a question about returns
  await qaInput.fill('客户要申请退货，我需要做什么？')
  await qaInput.press('Enter')
  await page.waitForTimeout(2000)

  // Verify answer appears
  const answerBubble = page.locator('[data-testid="qa-answer-bubble"]')
  await expect(answerBubble).toBeVisible({ timeout: 5000 })

  // Verify the answer is not empty
  const answerText = await answerBubble.textContent()
  expect(answerText).toBeTruthy()
  expect(answerText!.length).toBeGreaterThan(10)

  // Verify references/result section
  const qaResult = page.locator('[data-testid="qa-result"]')
  await expect(qaResult).toBeVisible()

  await page.screenshot({ path: 'verification/feature-180-knowledge-qa.png' })
})

test('#181 数据持久化：任务状态在数据库中正确存储和读取', async ({ page }) => {
  const token = await loginAsManager(page)

  // Trigger a flow to create a task
  const flowsResp = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const flowsData = await flowsResp.json()
  const flows = (flowsData.flows ?? flowsData ?? []) as Array<{ id: number }>
  expect(flows.length).toBeGreaterThan(0)

  const flowId = flows[0].id
  const triggerResp = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  const taskId = (await triggerResp.json()).task_id

  // Get initial task status
  const initialTask = await (await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  const initialStatus = initialTask.status

  // Navigate to task detail (simulates "closing" and "reopening")
  await page.goto(`${BASE_URL}/manage/monitor`)
  await page.waitForTimeout(500)

  // Re-fetch the task to verify persistence
  const reloadedTask = await (await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  expect(reloadedTask.id).toBe(taskId)
  expect(reloadedTask.status).toBe(initialStatus)
  expect(reloadedTask.title).toBeTruthy()

  await page.screenshot({ path: 'verification/feature-181-data-persistence.png' })
})

test('#182 数据持久化：流程定义在保存后可重新加载编辑', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create a new flow
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '持久化测试流程_' + Date.now(),
      trigger_type: 'manual',
      nodes: [
        { id: 'n1', type: 'auto', data: { label: '自动步骤A', nodeType: 'auto' }, position: { x: 200, y: 100 } },
        { id: 'n2', type: 'human', data: { label: '人工确认B', nodeType: 'human' }, position: { x: 200, y: 250 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }),
  })
  const created = await createResp.json()
  const flowId = created.id
  expect(flowId).toBeTruthy()

  // Navigate away and back
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(300)

  // Re-fetch the flow to verify persistence
  const reloadedFlow = await (await page.request.get(`${API_URL}/api/flows/${flowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  expect(reloadedFlow.id).toBe(flowId)
  expect((reloadedFlow.nodes as unknown[]).length).toBe(2)
  expect((reloadedFlow.edges as unknown[]).length).toBe(1)

  // Navigate to flow editor to confirm UI can load it
  await page.goto(`${BASE_URL}/manage/flows/${flowId}`)
  await page.waitForTimeout(2000)

  // Flow editor should be visible (canvas or toolbar)
  const flowCanvas = page.locator('[data-testid="flow-canvas"]')
  await expect(flowCanvas).toBeVisible()

  await page.screenshot({ path: 'verification/feature-182-flow-persistence.png' })
})

test('#183 API接口：任务CRUD接口正常工作（创建、读取、更新）', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create task via POST /api/tasks
  const createResp = await page.request.post(`${API_URL}/api/tasks`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ title: '测试任务CRUD', flow_name: 'API测试流程', status: 'pending' }),
  })
  expect(createResp.status()).toBe(200)
  const created = await createResp.json()
  expect(created.id).toBeTruthy()
  expect(created.title).toBe('测试任务CRUD')

  const taskId = created.id

  // Read task via GET /api/tasks/{id}
  const readResp = await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(readResp.status()).toBe(200)
  const read = await readResp.json()
  expect(read.id).toBe(taskId)
  expect(read.title).toBe('测试任务CRUD')

  // Update task via PATCH /api/tasks/{id}
  const updateResp = await page.request.patch(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ status: 'completed' }),
  })
  expect(updateResp.status()).toBe(200)
  const updated = await updateResp.json()
  expect(updated.status).toBe('completed')

  // Navigate to task monitor to verify UI reflects change
  await page.goto(`${BASE_URL}/manage/monitor`)
  await page.waitForTimeout(500)
  await expect(page.locator('body')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-183-task-crud.png' })
})

test('#184 API接口：流程定义CRUD接口正常工作', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create flow via POST /api/flows
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: 'API_CRUD测试流程_' + Date.now(),
      trigger_type: 'manual',
      nodes: [{ id: 'n1', type: 'auto', data: { label: '步骤1', nodeType: 'auto' }, position: { x: 100, y: 100 } }],
      edges: [],
    }),
  })
  expect(createResp.status()).toBe(200)
  const created = await createResp.json()
  const flowId = created.id
  expect(flowId).toBeTruthy()
  expect(created.version).toBe(1)

  // Read via GET /api/flows/{id}
  const readResp = await page.request.get(`${API_URL}/api/flows/${flowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(readResp.status()).toBe(200)
  const read = await readResp.json()
  expect(read.id).toBe(flowId)
  expect((read.nodes as unknown[]).length).toBe(1)

  // Update via PUT /api/flows/{id} — version should increment
  const updateResp = await page.request.put(`${API_URL}/api/flows/${flowId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: read.name,
      trigger_type: 'manual',
      nodes: [
        { id: 'n1', type: 'auto', data: { label: '步骤1更新', nodeType: 'auto' }, position: { x: 100, y: 100 } },
        { id: 'n2', type: 'auto', data: { label: '步骤2', nodeType: 'auto' }, position: { x: 100, y: 250 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }),
  })
  expect(updateResp.status()).toBe(200)
  const updated = await updateResp.json()
  expect(updated.version).toBe(2)
  expect((updated.nodes as unknown[]).length).toBe(2)

  await page.screenshot({ path: 'verification/feature-184-flow-crud.png' })
})
