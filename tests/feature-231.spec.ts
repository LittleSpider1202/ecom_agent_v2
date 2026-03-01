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

test('#231 E2E：权限边界验证——执行者无法访问管理功能', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const execToken = await loginAs(page, 'executor', 'executor123')

  // Step 2: 执行者访问 /manage/flows — 应被拒绝（显示权限不足页面）
  await page.goto('/manage/flows', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-231-access-denied-flows.png' })

  // Step 3: 执行者访问 /manage/members — 应被拒绝
  await page.goto('/manage/members', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 })

  // Step 4: 执行者访问 /manage/roles — 应被拒绝
  await page.goto('/manage/roles', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 })

  // Step 5: 侧边导航中无管理工作台菜单
  await page.goto('/executor/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  // 管理工作台链接不应在侧边栏中
  const managerNav = page.locator('[data-testid="manager-sidebar"]')
  await expect(managerNav).not.toBeVisible()
  // 侧边栏应为执行者侧边栏
  await expect(page.locator('[data-testid="executor-sidebar"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-231-executor-sidebar.png' })

  // Step 6: API 直接 POST /api/flows 验证 403
  const createFlowRes = await page.request.post(`${API_URL}/api/flows`, {
    headers: {
      Authorization: `Bearer ${execToken}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ name: '测试流程', nodes: [], edges: [] }),
  })
  expect(createFlowRes.status()).toBe(403)

  // Step 7: DELETE /api/tasks/{id} 验证 403
  const deleteRes = await page.request.delete(`${API_URL}/api/tasks/1`, {
    headers: { Authorization: `Bearer ${execToken}` },
  })
  expect(deleteRes.status()).toBe(403)

  // Step 8: 执行者可正常访问 /executor/* 页面
  await page.goto('/executor/tasks', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="access-denied"]')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()

  // Step 9: 执行者可访问 EW-01 到 EW-10 的各页面
  const executorPages = [
    '/executor/dashboard',
    '/executor/tasks',
    '/executor/history',
    '/executor/knowledge',
    '/executor/tools',
  ]
  for (const path of executorPages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="access-denied"]')).not.toBeVisible()
  }

  await page.screenshot({ path: 'verification/feature-231-executor-tools.png' })

  // Step 10: 验证系统日志功能可被管理员访问（执行者不能写管理类日志）
  const managerRes = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const { access_token: mgrToken } = await managerRes.json()
  const logsRes = await page.request.get(`${API_URL}/api/logs`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  expect(logsRes.ok()).toBeTruthy()
  const data = await logsRes.json()
  // 日志 API 应返回正确结构
  expect(data).toHaveProperty('logs')
  expect(data).toHaveProperty('total')

  // 无关键 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
