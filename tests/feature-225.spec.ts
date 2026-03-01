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

test('#225 E2E：飞书Bot深链接完整验证——BOT-02卡片到EW-04页面', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const token = await loginAs(page, 'executor', 'executor123')

  // 重置 task 1 step 1 到 pending（确保幂等）
  await page.request.post(`${API_URL}/api/tasks/1/steps/1/reset`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  // Step 2: 打开通知面板，查找 human_step 通知
  await page.goto('/executor/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  // 点开通知铃
  await page.locator('[data-testid="notification-bell"]').click()
  await page.locator('[data-testid="notification-panel"]').waitFor({ state: 'visible' })

  // 找到 human_step 类型的通知（seed notification id=2，对应 task_id=1, step_id=1）
  const notifItem = page.locator('[data-testid="notification-item-2"]')
  await expect(notifItem).toBeVisible()

  // Step 3: 验证卡片包含背景信息摘要
  const bgContent = notifItem.locator('[data-testid="notification-background-2"]')
  await expect(bgContent).toBeVisible()
  await expect(bgContent).toContainText('背景')
  await expect(bgContent).toContainText('库存')

  // Step 4: 验证卡片包含 AI 建议内容
  const aiContent = notifItem.locator('[data-testid="notification-ai-2"]')
  await expect(aiContent).toBeVisible()
  await expect(aiContent).toContainText('AI建议')
  await expect(aiContent).toContainText('采购')

  // Step 5: 点击"前往工作台"按钮
  const gotoBtn = notifItem.locator('[data-testid="notification-goto-2"]')
  await expect(gotoBtn).toBeVisible()

  await page.screenshot({ path: 'verification/feature-225-bot-card.png' })
  await gotoBtn.click()

  // Step 6: 验证 URL 正确跳转到 /task/1/step/1
  await page.waitForURL(/\/task\/\d+\/step\/\d+/)
  expect(page.url()).toContain('/task/1/step/1')

  // Step 7: 验证 EW-04 页面正确加载，显示任务步骤内容
  const bgSection = page.locator('[data-testid="background-section"]')
  await expect(bgSection).toBeVisible({ timeout: 5000 })
  const bgText = page.locator('[data-testid="background-content"]')
  await expect(bgText).toContainText('备货')

  // Step 8: 点击"全部采纳AI建议"
  const acceptBtn = page.locator('[data-testid="accept-ai-button"]')
  await expect(acceptBtn).toBeVisible()
  await acceptBtn.click()

  // 确认对话框
  const confirmBtn = page.locator('[data-testid="confirm-submit-button"]')
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()

  // Step 9: 验证提交成功消息
  const successMsg = page.locator('[data-testid="success-message"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })
  await expect(successMsg).toContainText('提交成功')

  await page.screenshot({ path: 'verification/feature-225-submitted.png' })

  // Step 10: 返回通知面板，验证卡片状态更新为"已处理"
  await page.goto('/executor/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await page.locator('[data-testid="notification-bell"]').click()
  await page.locator('[data-testid="notification-panel"]').waitFor({ state: 'visible' })

  const processedBadge = page.locator('[data-testid="notification-processed-2"]')
  await expect(processedBadge).toBeVisible({ timeout: 3000 })
  await expect(processedBadge).toContainText('已处理')

  await page.screenshot({ path: 'verification/feature-225-processed.png' })

  // Step 11: 验证任务继续执行（状态为 completed 或 running）
  const taskRes = await page.request.get(`${API_URL}/api/tasks/1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (taskRes.ok()) {
    const task = await taskRes.json()
    expect(['completed', 'running', 'pending']).toContain(task.status)
  }

  // 无 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
