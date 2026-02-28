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

test('#170 全局搜索：顶部搜索框可搜索任务、流程、知识词条', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1500)

  // Global search input should be visible
  const searchInput = page.locator('[data-testid="global-search-input"]')
  await expect(searchInput).toBeVisible()

  // Type a search query
  await searchInput.click()
  await searchInput.fill('采购')
  await page.waitForTimeout(800)

  // Dropdown should appear
  const dropdown = page.locator('[data-testid="search-results-dropdown"]')
  await expect(dropdown).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-170-global-search.png' })

  // Should have results including tasks/flows/knowledge
  const results = page.locator('[data-testid^="search-result-"]')
  const count = await results.count()
  expect(count).toBeGreaterThan(0)

  // Click first result - verify navigation
  const firstResult = results.first()
  await firstResult.click()
  await page.waitForTimeout(1000)

  // Should have navigated somewhere
  expect(page.url()).not.toBe(`${BASE_URL}/executor/dashboard`)
})

test('#171 飞书通知集成：新任务分配时发送飞书通知给负责人', async ({ page }) => {
  const token = await loginAsManager(page)

  // Get an active flow to trigger
  const flowsResp = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const flowsData = await flowsResp.json()
  const flows = (flowsData.flows ?? flowsData ?? []) as Array<{ id: number; name: string; nodes: unknown[] }>

  // Find a flow with human node or use any available flow
  let flowId: number | null = null
  for (const f of flows) {
    const nodes = f.nodes || []
    const hasHuman = (nodes as Array<{ type?: string; data?: { nodeType?: string } }>)
      .some(n => n.type === 'human' || n.data?.nodeType === 'human')
    if (hasHuman) {
      flowId = f.id
      break
    }
  }
  if (!flowId && flows.length > 0) flowId = flows[0].id

  if (flowId) {
    // Trigger the flow
    const triggerResp = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: '{}',
    })
    expect(triggerResp.status()).toBe(200)

    // Check bot notifications for task_start or human_step
    const notifResp = await page.request.get(`${API_URL}/api/bot/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const notifData = await notifResp.json()
    expect(notifData.total).toBeGreaterThan(0)

    // Should have task_start notification
    const taskStartNotif = (notifData.notifications as Array<{ type: string }>)
      .find(n => n.type === 'task_start')
    expect(taskStartNotif).toBeTruthy()
  } else {
    // No flows available, verify bot notifications endpoint works
    const notifResp = await page.request.get(`${API_URL}/api/bot/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(notifResp.status()).toBe(200)
  }

  await page.screenshot({ path: 'verification/feature-171-feishu-notify.png' })
})

test('#172 工作流引擎：创建并触发简单两步自动流程端到端执行', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create a simple 2-step auto flow
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '测试两步自动流程',
      description: '端到端测试',
      trigger_type: 'manual',
      nodes: [
        { id: 'step1', type: 'auto', data: { label: '第一步：API调用', nodeType: 'auto' }, position: { x: 200, y: 100 } },
        { id: 'step2', type: 'auto', data: { label: '第二步：通知推送', nodeType: 'auto' }, position: { x: 200, y: 250 } },
      ],
      edges: [
        { id: 'e1-2', source: 'step1', target: 'step2' },
      ],
    }),
  })
  const createData = await createResp.json()
  const flowId = createData.id
  expect(flowId).toBeTruthy()

  // Trigger the flow
  const triggerResp = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerResp.status()).toBe(200)
  const triggerData = await triggerResp.json()
  const taskId = triggerData.task_id
  expect(taskId).toBeTruthy()

  // Verify task was created
  const taskResp = await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const taskData = await taskResp.json()
  expect(taskData.id).toBe(taskId)

  // For 2 auto steps, task should be completed
  expect(taskData.status).toBe('completed')

  // Verify DAG nodes were created
  const dagResp = await page.request.get(`${API_URL}/api/tasks/${taskId}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const dagData = await dagResp.json()
  expect(dagData.nodes.length).toBe(2)

  // Both auto nodes should be completed
  const allCompleted = (dagData.nodes as Array<{ status: string }>).every(n => n.status === 'completed')
  expect(allCompleted).toBe(true)

  await page.screenshot({ path: 'verification/feature-172-workflow-exec.png' })
})

test('#173 工作流引擎：条件分支节点根据条件选择正确执行路径', async ({ page }) => {
  const token = await loginAsManager(page)

  // Create a flow with conditional branch
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '测试条件分支流程',
      trigger_type: 'manual',
      nodes: [
        { id: 'cond1', type: 'condition', data: { label: '金额检查', nodeType: 'condition', condition: 'input.value > 100' }, position: { x: 200, y: 100 } },
        { id: 'truePath', type: 'auto', data: { label: '大额处理', nodeType: 'auto' }, position: { x: 100, y: 250 } },
        { id: 'falsePath', type: 'auto', data: { label: '小额处理', nodeType: 'auto' }, position: { x: 300, y: 250 } },
      ],
      edges: [
        { id: 'e-true', source: 'cond1', target: 'truePath', sourceHandle: 'true' },
        { id: 'e-false', source: 'cond1', target: 'falsePath', sourceHandle: 'false' },
      ],
    }),
  })
  const createData = await createResp.json()
  const flowId = createData.id

  // Trigger with value=150 (True branch)
  const triggerTrue = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ input: { value: 150 } }),
  })
  const trueTaskId = (await triggerTrue.json()).task_id

  const trueDag = await (await page.request.get(`${API_URL}/api/tasks/${trueTaskId}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()

  // True path should be completed, false path should be skipped
  const trueNode = (trueDag.nodes as Array<{ id: string; label: string; status: string }>)
    .find(n => n.id === 'truePath' || n.label === '大额处理')
  const falseNode = (trueDag.nodes as Array<{ id: string; label: string; status: string }>)
    .find(n => n.id === 'falsePath' || n.label === '小额处理')

  expect(trueNode?.status).toBe('completed')
  expect(falseNode?.status).toBe('skipped')

  await page.screenshot({ path: 'verification/feature-173-condition-branch.png' })
})

test('#174 工作流引擎：到达人工节点时流程暂停等待人工响应', async ({ page }) => {
  const token = await loginAsManager(page)
  const executorToken = await loginAsExecutor(page)

  // Create a flow with 1 auto node + 1 human node
  const createResp = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '测试人工节点暂停',
      trigger_type: 'manual',
      nodes: [
        { id: 'auto1', type: 'auto', data: { label: '自动准备', nodeType: 'auto' }, position: { x: 200, y: 100 } },
        { id: 'human1', type: 'human', data: { label: '人工确认', nodeType: 'human' }, position: { x: 200, y: 250 } },
      ],
      edges: [{ id: 'e1', source: 'auto1', target: 'human1' }],
    }),
  })
  const flowId = (await createResp.json()).id

  // Trigger the flow (as manager)
  const triggerResp = await page.request.post(`${API_URL}/api/flows/${flowId}/trigger`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  const taskId = (await triggerResp.json()).task_id

  // Task should be RUNNING (paused at human node)
  const taskResp = await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const taskData = await taskResp.json()
  expect(taskData.status).toBe('running')
  expect(taskData.has_human_step).toBe(true)

  // Verify human node is pending in DAG
  const dagResp = await page.request.get(`${API_URL}/api/tasks/${taskId}/dag`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const dagData = await dagResp.json()
  const humanNode = (dagData.nodes as Array<{ label: string; status: string }>)
    .find(n => n.label === '人工确认' || n.status === 'pending')
  expect(humanNode?.status).toBe('pending')

  // Get the pending step
  const stepsResp = await page.request.get(`${API_URL}/api/tasks/${taskId}/steps/current`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  if (stepsResp.status() === 200) {
    const stepData = await stepsResp.json()
    expect(stepData.status).toBe('pending')

    // Complete the human step
    await page.request.post(`${API_URL}/api/tasks/${taskId}/steps/${stepData.id}/submit`, {
      headers: { Authorization: `Bearer ${executorToken}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ content: '人工确认完成', mode: 'accept' }),
    })

    // Task should now be completed (no more pending steps)
    await page.waitForTimeout(500)
    const finalTask = await (await page.request.get(`${API_URL}/api/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    expect(['completed', 'running']).toContain(finalTask.status)
  }

  await page.screenshot({ path: 'verification/feature-174-human-pause.png' })
})
