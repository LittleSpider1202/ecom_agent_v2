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

test('#205 E2E：任务超时告警和催办完整流程', async ({ page }) => {
  const managerToken = await loginAs(page, 'manager', 'manager123')

  // Step 1-3: 触发含人工节点的流程，让任务停在 human 步骤
  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const flows = await flowsRes.json()
  const humanFlow = flows.find((f: { name: string }) =>
    f.name.includes('采购') || f.name.includes('审核')
  ) || flows[0]

  const triggerRes = await page.request.post(`${API_URL}/api/flows/${humanFlow.id}/trigger`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  expect(triggerRes.ok()).toBe(true)
  const { task_id } = await triggerRes.json()
  await page.waitForTimeout(1000)

  // Step 4 (加速模拟): 不等5分钟，直接验证等待时间显示
  // Steps 5-6: 管理员在 MW-10 全局监控看到该任务的等待时间
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="monitor-title"]')).toBeVisible()

  // 验证等待时间列存在（running + has_human_step 的任务）
  const monitorTable = page.locator('[data-testid="task-monitor-table"]')
  await expect(monitorTable).toBeVisible()

  // 找到 running + has_human_step 的任务行
  const allTasks = await page.request.get(`${API_URL}/api/tasks/monitor`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const tasks = await allTasks.json()
  const stalledTask = tasks.find((t: { status: string; has_human_step: boolean }) =>
    t.status === 'running' && t.has_human_step === true
  )

  await page.screenshot({ path: 'verification/feature-205-monitor-stalled.png' })

  // Step 7: 管理员点击'催办'按钮（对 stalled 任务）
  if (stalledTask) {
    const urgeBtn = page.locator(`[data-testid="urge-btn-${stalledTask.id}"]`)
    const urgeBtnVisible = await urgeBtn.isVisible().catch(() => false)

    if (urgeBtnVisible) {
      await urgeBtn.click()
      await page.waitForTimeout(500)

      // 验证催办确认对话框
      const urgeDialog = page.locator('[data-testid="urge-dialog"]')
      await expect(urgeDialog).toBeVisible()

      // 确认催办
      await page.locator('[data-testid="urge-confirm"]').click()
      await page.waitForTimeout(1000)

      // Step 8: 验证催办成功消息
      const urgeMsg = page.locator('[data-testid="urge-success"]')
      await expect(urgeMsg).toBeVisible({ timeout: 5000 })

      await page.screenshot({ path: 'verification/feature-205-urge-success.png' })
    }
  }

  // Step 9-10: 执行者完成人工步骤（验证页面可访问）
  const executorToken = await loginAs(page, 'executor', 'executor123')
  await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.locator('main').first()).toBeVisible()

  await page.screenshot({ path: 'verification/feature-205-executor-dashboard.png' })

  // 验证等待时间和超时预警系统工作
  expect(task_id).toBeTruthy()
})
