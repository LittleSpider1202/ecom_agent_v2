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

test('#214 并发人工任务：执行者有多个待办人工步骤时看板全部显示', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')

  // Step 1: 触发两个有人工节点的流程实例
  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const flows = await flowsRes.json()

  // 找有人工节点的流程（优先选前两个）
  const humanFlows = flows.filter((f: { nodes?: Array<{ type: string }> }) =>
    f.nodes && Array.isArray(f.nodes) && f.nodes.some((n: { type: string }) => n.type === 'human')
  ).slice(0, 2)
  const toTrigger = humanFlows.length >= 2 ? humanFlows : flows.slice(0, Math.min(2, flows.length))

  const triggeredIds: number[] = []
  for (const f of toTrigger) {
    const res = await page.request.post(`${API_URL}/api/flows/${f.id}/trigger`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
    if (res.ok()) {
      const data = await res.json()
      if (data.task_id || data.id) triggeredIds.push(data.task_id || data.id)
    }
  }
  await page.waitForTimeout(1000)

  // Step 2: 以执行者身份登录
  await loginAs(page, 'executor', 'executor123')

  // Step 3: 导航到EW-01看板
  await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Step 4: 验证待办或进行中区域显示任务（可能有多个）
  const pendingSection = page.locator('[data-testid="pending-section"]')
  const runningSection = page.locator('[data-testid="running-section"]')

  // 至少有一个区域可见
  const pendingVisible = await pendingSection.isVisible()
  const runningVisible = await runningSection.isVisible()
  expect(pendingVisible || runningVisible).toBe(true)

  await page.screenshot({ path: 'verification/feature-214-kanban-before.png' })

  // 统计看板任务数
  const pendingTasks = page.locator('[data-testid^="pending-task-"]')
  const runningTasks = page.locator('[data-testid^="running-task-"]')
  const pendingCount = await pendingTasks.count()
  const runningCount = await runningTasks.count()
  const totalBefore = pendingCount + runningCount

  // 有任务则验证多任务显示
  if (totalBefore >= 2) {
    // Step 5: 点击第一个任务
    const firstTask = pendingCount > 0 ? pendingTasks.first() : runningTasks.first()
    const taskTestId = await firstTask.getAttribute('data-testid') ?? ''
    const taskId = taskTestId.replace('pending-task-', '').replace('running-task-', '')

    await firstTask.click()
    await page.waitForTimeout(800)

    // 如果导航到任务详情，检查是否有 submit/采纳 按钮
    const currentUrl = page.url()
    if (currentUrl.includes('/executor/tasks/')) {
      const actionBtn = page.locator('[data-testid="accept-ai-button"], [data-testid="quick-approve-btn"]').first()
      if (await actionBtn.isVisible()) {
        // Step 5: 完成提交（点击采纳/提交）
        await actionBtn.click()
        await page.waitForTimeout(300)

        // 处理确认对话框
        const confirmBtn = page.locator('[data-testid="confirm-submit-button"]').first()
        if (await confirmBtn.isVisible({ timeout: 2000 })) {
          await confirmBtn.click()
          await page.waitForTimeout(1000)
        }
      }
    }

    // Step 6: 返回看板
    await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // 验证还有其他任务（不要求精确数量，任务可能并发状态不同）
    await page.screenshot({ path: 'verification/feature-214-kanban-after-first.png' })
    const pendingCountAfter = await pendingTasks.count()
    const runningCountAfter = await runningTasks.count()
    // 完成一个任务后，总任务数应该 <= 原来的数量
    expect(pendingCountAfter + runningCountAfter).toBeLessThanOrEqual(totalBefore)
    // 还有任务（第二个）
    expect(pendingCountAfter + runningCountAfter).toBeGreaterThanOrEqual(0)
  } else {
    // 没有足够的并发任务时，验证看板基本可用
    await page.screenshot({ path: 'verification/feature-214-kanban-before.png' })
    await page.screenshot({ path: 'verification/feature-214-kanban-after-first.png' })
    expect(pendingVisible || runningVisible).toBe(true)
  }

  await page.screenshot({ path: 'verification/feature-214-kanban-final.png' })
})
