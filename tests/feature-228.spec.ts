import { test, expect } from '@playwright/test'

const API_URL = 'http://192.168.0.112:8002'

async function loginAs(page: any, username: string, password: string): Promise<string> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username, password },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, user }: { token: string; user: object }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: access_token, user })
  return access_token
}

test('#228 E2E：任务驳回后管理员代处理完整流程', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  // 使用 executor token 先重置 task 2 step 2
  const execToken = await loginAs(page, 'executor', 'executor123')

  // Task 2（爆款商品定价策略调整）的 human step 是 seed step 2（确认定价方案）
  // 直接使用固定 stepId 确保幂等（避免上次 admin proxy submit 后 /steps/current 返回 404）
  const stepId = 2

  // Reset the step to pending
  await page.request.post(`${API_URL}/api/tasks/2/steps/${stepId}/reset`, {
    headers: { Authorization: `Bearer ${execToken}` },
  })

  // Step 1: 触发含人工节点的流程（使用已有 task 2，已有 pending human step）
  // Step 2: 执行者进入 EW-04 人工步骤页面
  await page.goto(`/task/2/step/${stepId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="background-section"]')).toBeVisible({ timeout: 5000 })

  // Step 3: 执行者点击"驳回"
  const rejectBtn = page.locator('[data-testid="reject-button"]')
  await expect(rejectBtn).toBeVisible()
  await rejectBtn.click()

  // 驳回对话框显示
  await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible()

  // Step 4: 填写驳回原因
  const reasonInput = page.locator('[data-testid="reject-reason-input"]')
  await reasonInput.fill('建议数量超出库存上限，无法执行')

  // Step 5: 确认驳回提交
  const confirmRejectBtn = page.locator('[data-testid="confirm-reject-button"]')
  await confirmRejectBtn.click()

  // 验证驳回成功消息
  const successMsg = page.locator('[data-testid="success-message"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })
  await expect(successMsg).toContainText('驳回')

  await page.screenshot({ path: 'verification/feature-228-rejected.png' })

  // Step 6: 管理员收到告警（通过任务状态确认）
  const managerToken = await loginAs(page, 'manager', 'manager123')
  const taskRes = await page.request.get(`${API_URL}/api/tasks/2`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  if (taskRes.ok()) {
    const task = await taskRes.json()
    expect(task.status).toBe('rejected')
  }

  // Step 7: 管理员导航到 MW-11 任务实例详情
  await page.goto('/manage/monitor', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  // 找到 task 2 的行（驳回状态）
  const taskRow = page.locator('[data-testid^="monitor-task-row"]').filter({ hasText: '爆款商品' })
  if (await taskRow.count() > 0) {
    await taskRow.first().click()
  } else {
    // 直接导航到任务详情
    await page.goto('/manage/monitor/2', { waitUntil: 'domcontentloaded' })
  }

  // 等待任务详情页面加载
  await expect(page.locator('[data-testid="task-detail-title"], h1').first()).toBeVisible({ timeout: 5000 })

  // Step 8: 看到人工节点显示已驳回状态
  const statusBadge = page.locator('[data-testid="task-status-badge"]')
  await expect(statusBadge).toBeVisible()
  await expect(statusBadge).toContainText('已驳回')

  await page.screenshot({ path: 'verification/feature-228-manager-view.png' })

  // Step 9: 管理员点击"代为处理"
  const proxyBtn = page.locator('[data-testid="proxy-handle-btn"]')
  await expect(proxyBtn).toBeVisible({ timeout: 5000 })
  await proxyBtn.click()

  // Step 10: 在代处理界面修改内容后以管理员身份提交
  await expect(page.locator('[data-testid="proxy-handle-modal"]')).toBeVisible({ timeout: 3000 })

  const proxyInput = page.locator('[data-testid="proxy-content-input"]')
  await expect(proxyInput).toBeVisible()
  await proxyInput.fill('管理员代为处理：根据实际库存数据重新核算，调整建议采购量至库存上限以内，总金额控制在预算范围内。')

  const proxySubmit = page.locator('[data-testid="proxy-submit-btn"]')
  await expect(proxySubmit).toBeVisible()
  await proxySubmit.click()

  // Step 11: 验证提交成功
  await page.waitForTimeout(1000)
  // 模态框应关闭
  await expect(page.locator('[data-testid="proxy-handle-modal"]')).not.toBeVisible({ timeout: 5000 })

  // 任务状态应更新（completed 或 running）
  const taskRes2 = await page.request.get(`${API_URL}/api/tasks/2`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  if (taskRes2.ok()) {
    const task2 = await taskRes2.json()
    expect(['completed', 'running']).toContain(task2.status)
  }

  await page.screenshot({ path: 'verification/feature-228-admin-handled.png' })

  // 无 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
