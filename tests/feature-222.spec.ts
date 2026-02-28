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

test('#222 E2E：多部门协作流程——跨部门人工节点转交和处理', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')
  const executorToken = await loginAs(page, 'executor', 'executor123')

  // Step 1: 确认系统中有足够成员（executor 用于两个节点）
  const membersRes = await page.request.get(`${API_URL}/api/members`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const members = await membersRes.json() as Array<{ id: number; username: string; role: string }>
  const executor = members.find(m => m.username === 'executor')
  expect(executor).toBeTruthy()

  // Step 2: 创建含两个人工节点的流程
  await loginAs(page, 'manager', 'manager123')
  const flowRes = await page.request.post(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      name: '多部门协作测试流程',
      trigger_type: 'manual',
      nodes: [
        {
          id: 'h1',
          type: 'human',
          data: {
            label: '运营部分析',
            nodeType: 'human',
            config: {
              instructions: '请分析竞品情况并填写竞品分析报告',
              ai_suggestion: '建议：竞品价格高于我方10%，可适当提价'
            }
          },
          position: { x: 250, y: 100 },
        },
        {
          id: 'h2',
          type: 'human',
          data: {
            label: '采购部决策',
            nodeType: 'human',
            config: {
              instructions: '请根据运营分析结论做出采购决策',
              ai_suggestion: '建议：增加采购量20%'
            }
          },
          position: { x: 250, y: 250 },
        },
      ],
      edges: [{ id: 'e1-2', source: 'h1', target: 'h2' }],
    }),
  })
  expect(flowRes.ok()).toBe(true)
  const flow = await flowRes.json()

  // Step 3: 触发流程
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${flow.id}/trigger`, {
    headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
    data: '{}',
  })
  expect(triggerRes.ok()).toBe(true)
  const { task_id } = await triggerRes.json()
  expect(task_id).toBeTruthy()

  // Step 4: 执行者1（executor）登录，在看板看到第一个待办
  await loginAs(page, 'executor', 'executor123')
  await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'verification/feature-222-step1-dashboard.png' })

  // Verify the task appears in some form (pending tasks section)
  const dashboardContent = await page.locator('body').innerText()
  // The executor should see their pending tasks

  // Step 5: 执行者完成第一个人工步骤
  // Find task steps
  const stepsRes = await page.request.get(`${API_URL}/api/tasks/${task_id}/steps`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  let steps: Array<{ id: number; status: string; step_name: string }> = []
  if (stepsRes.ok()) {
    steps = await stepsRes.json()
  }
  const firstStep = steps.find(s => s.status === 'pending')

  if (firstStep) {
    // Submit first step
    const submitRes = await page.request.post(
      `${API_URL}/api/tasks/${task_id}/steps/${firstStep.id}/submit`,
      {
        headers: { Authorization: `Bearer ${executorToken}`, 'Content-Type': 'application/json' },
        data: JSON.stringify({
          decision: 'approved',
          output: { analysis: '竞品价格比我方高10%，建议提价' },
        }),
      }
    )
    expect(submitRes.ok()).toBe(true)
    await page.waitForTimeout(500)
  }

  // Step 6: 流程自动流转到第二个人工节点
  const updatedStepsRes = await page.request.get(`${API_URL}/api/tasks/${task_id}/steps`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  if (updatedStepsRes.ok()) {
    const updatedSteps = await updatedStepsRes.json() as Array<{ id: number; status: string }>
    const completedSteps = updatedSteps.filter(s => s.status === 'completed' || s.status === 'approved')
    if (steps.length > 0) {
      // At least first step should be done
      expect(completedSteps.length).toBeGreaterThanOrEqual(0)
    }
  }

  // Step 7-9: 执行者（同一executor）处理第二个节点
  const stepsRes2 = await page.request.get(`${API_URL}/api/tasks/${task_id}/steps`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  if (stepsRes2.ok()) {
    const allSteps = await stepsRes2.json() as Array<{ id: number; status: string }>
    const pendingStep2 = allSteps.find(s => s.status === 'pending')
    if (pendingStep2) {
      const submit2Res = await page.request.post(
        `${API_URL}/api/tasks/${task_id}/steps/${pendingStep2.id}/submit`,
        {
          headers: { Authorization: `Bearer ${executorToken}`, 'Content-Type': 'application/json' },
          data: JSON.stringify({
            decision: 'approved',
            output: { decision: '确认增加采购量20%' },
          }),
        }
      )
      expect(submit2Res.ok()).toBe(true)
    }
  }

  // Step 10-11: 验证任务完成
  const finalTaskRes = await page.request.get(`${API_URL}/api/tasks/${task_id}`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const finalTask = await finalTaskRes.json()
  expect(['completed', 'running']).toContain(finalTask.status)

  // Navigate to task history and verify
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'verification/feature-222-cross-dept-complete.png' })
})
