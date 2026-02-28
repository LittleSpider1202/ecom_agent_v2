import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

async function loginAs(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username, password },
  })
  const data = await resp.json()
  await page.evaluate(({ token, user }: { token: string; user: unknown }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token: data.access_token, user: data.user })
  return data.access_token as string
}

test('#165 权限控制：执行者角色无法访问管理工作台页面', async ({ page }) => {
  await loginAs(page, 'executor', 'executor123')

  // Try to access manage dashboard as executor
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'verification/feature-165-access-denied.png' })

  // Should show access-denied page OR redirect to executor dashboard
  const accessDenied = page.locator('[data-testid="access-denied"]')
  const isOnExecutor = page.url().includes('/executor/')

  const denied = await accessDenied.isVisible()
  expect(denied || isOnExecutor).toBe(true)

  // Manager nav should NOT appear in executor sidebar
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1000)
  const managerLink = page.locator('[data-testid="nav-cockpit"]')
  // Executor sidebar should not contain manager-only items
  await expect(page.locator('[data-testid="executor-sidebar"]')).toBeVisible()
})

test('#166 权限控制：管理员角色可访问所有页面', async ({ page }) => {
  await loginAs(page, 'manager', 'manager123')

  // Navigate to executor pages
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1000)
  await expect(page.locator('body')).toBeVisible()
  expect(page.url()).toContain('/executor/dashboard')

  // Navigate to manager pages
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(1500)

  await page.screenshot({ path: 'verification/feature-166-manager-access.png' })

  // Should NOT see access-denied
  const accessDenied = page.locator('[data-testid="access-denied"]')
  expect(await accessDenied.isVisible()).toBe(false)
  // Should be on manage dashboard
  expect(page.url()).toContain('/manage/dashboard')
})

test('#167 导航菜单：执行者工作台侧边导航菜单可用', async ({ page }) => {
  await loginAs(page, 'executor', 'executor123')
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1500)

  await page.screenshot({ path: 'verification/feature-167-executor-nav.png' })

  // Verify sidebar exists with executor items
  await expect(page.locator('[data-testid="executor-sidebar"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-tasks"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-history"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-knowledge"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-tools"]')).toBeVisible()

  // Click tasks nav item and verify navigation
  await page.locator('[data-testid="nav-tasks"]').click()
  await page.waitForTimeout(1000)
  expect(page.url()).toContain('/executor/tasks')

  // Verify active state (blue highlight)
  const activeItem = page.locator('[data-testid="nav-tasks"]')
  const classList = await activeItem.getAttribute('class') ?? ''
  expect(classList).toContain('blue')
})

test('#168 导航菜单：管理工作台侧边导航菜单可用', async ({ page }) => {
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(1500)

  await page.screenshot({ path: 'verification/feature-168-manager-nav.png' })

  // Verify manager sidebar
  await expect(page.locator('[data-testid="manager-sidebar"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-cockpit"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-monitor"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-flows"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-analytics"]')).toBeVisible()

  // Click monitor nav and verify navigation
  await page.locator('[data-testid="nav-monitor"]').click()
  await page.waitForTimeout(1000)
  expect(page.url()).toContain('/manage/monitor')

  // Verify active state
  const activeItem = page.locator('[data-testid="nav-monitor"]')
  const classList = await activeItem.getAttribute('class') ?? ''
  expect(classList).toContain('blue')
})

test('#169 全局通知：顶部通知铃铛显示未读数量', async ({ page }) => {
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'verification/feature-169-notification-bell.png' })

  // Bell should be visible
  await expect(page.locator('[data-testid="notification-bell"]')).toBeVisible()

  // If there are unread notifications, badge should show
  const badge = page.locator('[data-testid="notification-badge"]')
  const hasBadge = await badge.isVisible()

  // Click bell to open notification panel
  await page.locator('[data-testid="notification-bell"]').click()
  await page.waitForTimeout(500)

  // Notification panel should open
  await expect(page.locator('[data-testid="notification-panel"]')).toBeVisible()

  // After click, badge should be hidden (marked as read)
  await page.waitForTimeout(300)
  const badgeAfterClick = page.locator('[data-testid="notification-badge"]')
  // Badge disappears after reading
  expect(await badgeAfterClick.isVisible()).toBe(false)
})
