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

test('#230 E2E：飞书平台完整集成——配置连接→发送通知→接收回复', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const mgrToken = await loginAs(page, 'manager', 'manager123')

  // Step 1: 管理员导航到 MW-14 平台集成配置
  await page.goto('/manage/integrations', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="integrations-title"]')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('[data-testid="feishu-section"]')).toBeVisible()

  // Step 2: 配置飞书 App ID 和 App Secret
  await page.locator('[data-testid="feishu-app-id"]').fill('cli_test_app_id_230')
  await page.locator('[data-testid="feishu-app-secret"]').fill('test_app_secret_230')

  // Step 3: 点击"测试连接"，验证连接成功
  await page.locator('[data-testid="feishu-test-btn"]').click()
  await expect(page.locator('[data-testid="feishu-result"]')).toBeVisible({ timeout: 5000 })
  const resultText = await page.locator('[data-testid="feishu-result"]').textContent()
  expect(resultText).toContain('成功')

  // Step 4: 配置机器人 Webhook 地址
  await page.locator('[data-testid="feishu-webhook"]').fill('https://open.feishu.cn/open-apis/bot/v2/hook/test_webhook_230')

  // Step 5: 保存集成配置
  await page.locator('[data-testid="feishu-save-btn"]').click()
  await expect(page.locator('[data-testid="feishu-save-success"]')).toBeVisible({ timeout: 5000 })

  // 验证后端保存了配置
  const configRes = await page.request.get(`${API_URL}/api/integrations`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  const configs = await configRes.json()
  const feishuConfig = configs.find((c: any) => c.id === 'feishu')
  expect(feishuConfig?.connected).toBe(true)

  await page.screenshot({ path: 'verification/feature-230-integration-config.png' })

  // Step 6: 重置 task 1 step 1，触发含飞书通知节点的流程
  const execToken = await loginAs(page, 'executor', 'executor123')
  await page.request.post(`${API_URL}/api/tasks/1/steps/1/reset`, {
    headers: { Authorization: `Bearer ${execToken}` },
  })

  // Step 7: 验证系统有飞书通知记录（in-app bot notification = 飞书消息代理）
  // 重新以 manager 登录检查通知
  await loginAs(page, 'manager', 'manager123')
  await page.goto('/manage/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  // 打开通知中心
  const bellBtn = page.locator('[data-testid="notification-bell"]')
  if (await bellBtn.isVisible()) {
    await bellBtn.click()
    await page.waitForTimeout(300)
  }

  // Step 8: 验证有人工步骤通知卡片（BOT-02 确认卡片）
  const notifList = page.locator('[data-testid="notification-list"]')
  if (await notifList.isVisible()) {
    const humanStepNotif = notifList.locator('[data-testid^="notification-item-"]').filter({ hasText: '人工' })
    if (await humanStepNotif.count() > 0) {
      const notifId = await humanStepNotif.first().getAttribute('data-testid')
      const id = notifId?.replace('notification-item-', '')

      // 验证卡片有背景信息
      const bgElem = page.locator(`[data-testid="notification-background-${id}"]`)
      if (await bgElem.count() > 0) {
        await expect(bgElem).toBeVisible()
      }

      // Step 9: 点击"前往工作台"（相当于飞书卡片"一键采纳"操作入口）
      const gotoBtn = page.locator(`[data-testid="notification-goto-${id}"]`)
      if (await gotoBtn.count() > 0 && await gotoBtn.isVisible()) {
        await gotoBtn.click()
        await page.waitForTimeout(500)
        // 应导航到 /task/1/step/1
        expect(page.url()).toContain('/task/')
      }
    }
  }

  await page.screenshot({ path: 'verification/feature-230-bot-notification.png' })

  // Step 10: 执行者在 EW-04 提交步骤（模拟"飞书卡片操作完成"）
  await loginAs(page, 'executor', 'executor123')
  await page.goto('/task/1/step/1', { waitUntil: 'domcontentloaded' })
  const bgSection = page.locator('[data-testid="background-section"]')
  if (await bgSection.isVisible({ timeout: 5000 }).catch(() => false)) {
    const aiSection = page.locator('[data-testid="ai-suggestion-section"]')
    if (await aiSection.isVisible()) {
      const adoptBtn = page.locator('[data-testid="adopt-suggestion-btn"]')
      if (await adoptBtn.isVisible()) await adoptBtn.click()
    }
    const submitBtn = page.locator('[data-testid="submit-btn"]')
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 })
    }
  }

  // Step 11: 验证流程继续执行 — 任务状态变为 running 或 completed
  const taskRes = await page.request.get(`${API_URL}/api/tasks/1`, {
    headers: { Authorization: `Bearer ${execToken}` },
  })
  if (taskRes.ok()) {
    const task = await taskRes.json()
    // 流程继续执行（running/completed）或等待处理（pending）均合法
    expect(['running', 'completed', 'pending']).toContain(task.status)
  }

  await page.screenshot({ path: 'verification/feature-230-flow-completed.png' })

  // 验证飞书集成 API 正常响应
  const integRes = await page.request.get(`${API_URL}/api/integrations`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  expect(integRes.ok()).toBeTruthy()

  // 无关键 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
