import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

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
}

test('#190 空状态：列表为空时显示友好的空状态插图和说明文字', async ({ page }) => {
  await loginAsExecutor(page)

  // Navigate to task history with a search that returns no results
  await page.goto(`${BASE_URL}/executor/history`)
  await page.waitForTimeout(1500)

  // Try searching for something that doesn't exist
  const searchInput = page.locator('[data-testid="search-input"]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('XYZNOTEXIST9999')
  await searchInput.press('Enter')
  await page.waitForTimeout(1000)

  // Should show empty state message
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).toContain('暂无')

  await page.screenshot({ path: 'verification/feature-190-empty-state.png' })
})

test('#191 错误状态：表单验证错误显示在字段下方（内联），颜色为红色', async ({ page }) => {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`)
  await page.waitForTimeout(500)

  // Try to submit with empty fields (clear required attribute first)
  const submitBtn = page.locator('button[type="submit"]')

  // Click submit without filling in fields
  await submitBtn.click()
  await page.waitForTimeout(300)

  // Should show inline field errors
  const usernameError = page.locator('[data-testid="username-error"]')
  await expect(usernameError).toBeVisible()

  // Error should be red colored
  const errorClass = await usernameError.getAttribute('class')
  expect(errorClass).toContain('red')

  // Password error should also appear
  const passwordError = page.locator('[data-testid="password-error"]')
  await expect(passwordError).toBeVisible()

  await page.screenshot({ path: 'verification/feature-191-inline-errors.png' })
})

test('#192 成功反馈：操作成功后显示Toast消息通知（右上角）', async ({ page }) => {
  await loginAsManager(page)

  // Navigate to a new flow (no ID = create mode)
  await page.goto(`${BASE_URL}/manage/flows/new`)
  await page.waitForTimeout(1500)

  // Set flow name
  const flowNameInput = page.locator('[data-testid="flow-name-input"]')
  await expect(flowNameInput).toBeVisible()
  await flowNameInput.clear()
  await flowNameInput.fill('Toast测试流程_' + Date.now())

  // Click save
  const saveBtn = page.locator('[data-testid="save-btn"]')
  await saveBtn.click()
  await page.waitForTimeout(1000)

  // Toast should appear
  const toast = page.locator('[data-testid="global-toast"]')
  await expect(toast).toBeVisible({ timeout: 3000 })

  // Toast should be in top-right area
  const toastBox = await toast.boundingBox()
  expect(toastBox).toBeTruthy()
  // Should be in right portion of screen (right half)
  const viewportWidth = await page.evaluate(() => window.innerWidth)
  expect(toastBox!.x).toBeGreaterThan(viewportWidth / 2)

  await page.screenshot({ path: 'verification/feature-192-toast.png' })
})

test('#193 侧边导航：折叠/展开功能可用，折叠后只显示图标', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1500)

  // Sidebar should be visible and expanded
  const sidebar = page.locator('[data-testid="executor-sidebar"]')
  await expect(sidebar).toBeVisible()

  // Full label should be visible initially
  const navLink = page.locator('[data-testid="nav-dashboard"]')
  await expect(navLink).toBeVisible()
  const labelText = await navLink.textContent()
  expect(labelText).toContain('我的看板')

  // Click collapse toggle
  const toggleBtn = page.locator('[data-testid="sidebar-toggle"]')
  await expect(toggleBtn).toBeVisible()
  await toggleBtn.click()
  await page.waitForTimeout(300)

  // After collapse, sidebar should be narrow
  const sidebarBox = await sidebar.boundingBox()
  expect(sidebarBox!.width).toBeLessThan(100)

  // Nav link should only show icon (first character)
  const collapsedLink = page.locator('[data-testid="nav-dashboard"]')
  await expect(collapsedLink).toBeVisible()

  await page.screenshot({ path: 'verification/feature-193-collapsed.png' })

  // Click toggle again to expand
  await toggleBtn.click()
  await page.waitForTimeout(300)

  // Should be expanded again
  const expandedBox = await sidebar.boundingBox()
  expect(expandedBox!.width).toBeGreaterThan(100)

  await page.screenshot({ path: 'verification/feature-193-expanded.png' })
})

test('#194 响应式布局：1280px宽度下页面布局无溢出无横向滚动条', async ({ page }) => {
  // Set viewport to 1280px
  await page.setViewportSize({ width: 1280, height: 800 })

  await loginAsExecutor(page)

  // Test executor dashboard
  await page.goto(`${BASE_URL}/executor/dashboard`)
  await page.waitForTimeout(1500)

  let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  let clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5) // allow 5px tolerance

  await page.screenshot({ path: 'verification/feature-194a-dashboard.png' })

  // Test task list
  await page.goto(`${BASE_URL}/executor/tasks`)
  await page.waitForTimeout(1000)

  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)

  await page.screenshot({ path: 'verification/feature-194b-tasks.png' })

  // Test manager dashboard
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/dashboard`)
  await page.waitForTimeout(1500)

  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5)

  await page.screenshot({ path: 'verification/feature-194-responsive.png' })
})
