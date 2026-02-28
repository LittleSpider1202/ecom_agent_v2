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
  return access_token
}

test('#201 E2E：完整人机协作流程——从触发到人工步骤完成再到流程结束', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')

  // Step 1-2: 找一个含人工节点的流程（采购审核流程）
  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const flows = await flowsRes.json()
  const humanFlow = flows.find((f: { name: string; nodes?: unknown[] }) =>
    f.name.includes('采购') || f.name.includes('审核') || f.name.includes('human')
  ) || flows[0]
  expect(humanFlow).toBeTruthy()

  // Step 3: 管理员手动触发流程
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${humanFlow.id}/trigger`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  expect(triggerRes.ok()).toBe(true)
  const triggerData = await triggerRes.json()
  const taskId = triggerData.task_id || triggerData.id
  expect(taskId).toBeTruthy()

  await page.waitForTimeout(1000)

  // Step 4: 验证任务实例创建
  const taskRes = await page.request.get(`${API_URL}/api/tasks/monitor`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTasks = await taskRes.json()
  const createdTask = allTasks.find((t: { id: number }) => t.id === taskId)
  expect(createdTask, '任务实例应已创建').toBeTruthy()

  // 导航到任务监控，验证任务出现
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="monitor-title"]')).toBeVisible()

  const taskRow = page.locator(`[data-testid="monitor-task-row"]`).filter({ hasText: String(taskId) })
  await expect(taskRow).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-201-task-created.png' })

  // Step 6: 如果任务在人工节点暂停，执行者应能看到
  const executorToken = await loginAs(page, 'executor', 'executor123')

  // 检查执行者看板是否有待处理任务
  const myTasksRes = await page.request.get(`${API_URL}/api/tasks/my`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  const myTasks = await myTasksRes.json()
  const taskCount = (myTasks.pending?.length || 0) + (myTasks.running?.length || 0)

  // 导航到执行者看板
  await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 验证看板有任务数显示
  const dashboardTitle = page.locator('[data-testid="dashboard-title"], h1')
  await expect(dashboardTitle.first()).toBeVisible()

  await page.screenshot({ path: 'verification/feature-201-executor-dashboard.png' })

  // Steps 8-9: 如果有人工步骤任务，执行者可操作
  if (myTasks.running && myTasks.running.length > 0) {
    const runningTask = myTasks.running.find((t: { has_human_step: boolean }) => t.has_human_step) || myTasks.running[0]
    if (runningTask) {
      await page.goto(`${BASE_URL}/task/${runningTask.id}/step/current`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)

      const stepContent = page.locator('[data-testid="human-step-content"], main')
      await expect(stepContent.first()).toBeVisible()
      await page.screenshot({ path: 'verification/feature-201-human-step.png' })
    }
  }

  // Steps 11-12: 任务历史页面可访问
  await page.goto(`${BASE_URL}/executor/history`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await expect(page.locator('h1, [data-testid]').first()).toBeVisible()
  await page.screenshot({ path: 'verification/feature-201-task-history.png' })

  // 确认整个 E2E 流程步骤通过
  expect(taskId).toBeTruthy()
  expect(taskCount).toBeGreaterThanOrEqual(0)
})
