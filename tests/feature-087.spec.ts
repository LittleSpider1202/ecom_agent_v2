import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const data = await resp.json()
  await page.evaluate((token: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify({
      id: 2, username: 'manager', display_name: '张经理', role: 'manager',
    }))
  }, data.access_token)
}

test('#87 MW-06 工具上传/编辑：页面加载显示工具配置表单', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)

  // Page shows form
  await expect(page.getByRole('heading', { name: '新建工具' })).toBeVisible({ timeout: 10000 })

  // Tool name input
  await expect(page.locator('[data-testid="tool-name-input"]')).toBeVisible()

  // Type selector with 3 options
  const typeSelect = page.locator('[data-testid="tool-type-select"]')
  await expect(typeSelect).toBeVisible()
  await expect(page.locator('[data-testid="type-btn-api"]')).toBeVisible()
  await expect(page.locator('[data-testid="type-btn-webhook"]')).toBeVisible()
  await expect(page.locator('[data-testid="type-btn-script"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-087-tool-form.png' })
})

test('#88 MW-06 工具上传：配置API工具（URL、HTTP方法、认证头）并保存', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)
  await page.locator('[data-testid="tool-name-input"]').waitFor({ timeout: 10000 })

  // Select API type (default)
  await page.locator('[data-testid="type-btn-api"]').click()

  // Fill name
  await page.locator('[data-testid="tool-name-input"]').fill('测试API工具_88')

  // Fill URL
  await page.locator('[data-testid="api-url-input"]').fill('https://api.example.com/test')

  // Select HTTP method
  await page.locator('[data-testid="http-method-select"]').selectOption('POST')

  // Add auth header
  await page.locator('[data-testid="header-key-input"]').fill('Authorization')
  await page.locator('[data-testid="header-val-input"]').fill('Bearer test-token-123')
  await page.locator('[data-testid="add-header-btn"]').click()

  // Verify header appears
  await expect(page.locator('[data-testid="headers-list"]')).toContainText('Authorization')

  // Save
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools') && r.request().method() === 'POST'),
    page.locator('[data-testid="save-tool-btn"]').click(),
  ])
  expect(response.status()).toBe(200)

  // Success message
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  // Redirects to tool detail
  await page.waitForURL(/\/manage\/tools\/\d+/, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-088-api-tool.png' })
})

test('#89 MW-06 工具上传：上传Python脚本文件', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)
  await page.locator('[data-testid="tool-name-input"]').waitFor({ timeout: 10000 })

  // Select script type
  await page.locator('[data-testid="type-btn-script"]').click()

  // Fill name
  await page.locator('[data-testid="tool-name-input"]').fill('测试脚本工具_89')

  // Upload script file
  const fileInput = page.locator('[data-testid="script-file-input"]')
  await fileInput.setInputFiles({
    name: 'my_script.py',
    mimeType: 'text/plain',
    buffer: Buffer.from('# test script\nprint("hello")'),
  })

  // Filename shown
  await expect(page.locator('[data-testid="script-filename"]')).toContainText('my_script.py', { timeout: 3000 })

  // Save
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools') && r.request().method() === 'POST'),
    page.locator('[data-testid="save-tool-btn"]').click(),
  ])
  expect(response.status()).toBe(200)

  // Success message
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-089-script-tool.png' })
})

test('#90 MW-06 工具编辑：定义工具输入参数（名称、类型、必填、描述）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)
  await page.locator('[data-testid="tool-name-input"]').waitFor({ timeout: 10000 })

  // Fill basic info
  await page.locator('[data-testid="tool-name-input"]').fill('测试参数工具_90')

  // Add parameter
  await page.locator('[data-testid="add-param-btn"]').click()

  // param-item-0 should appear
  const paramItem = page.locator('[data-testid="param-item-0"]')
  await expect(paramItem).toBeVisible({ timeout: 3000 })

  // Fill param name
  await page.locator('[data-testid="param-name-0"]').fill('sku_id')

  // Select type
  await page.locator('[data-testid="param-type-0"]').selectOption('string')

  // Check required
  await page.locator('[data-testid="param-required-0"]').check()

  // Fill description
  await page.locator('[data-testid="param-desc-0"]').fill('商品SKU编号')

  // Verify param appears in list
  await expect(page.locator('[data-testid="params-list"]')).toBeVisible()
  await expect(page.locator('[data-testid="param-name-0"]')).toHaveValue('sku_id')

  // Save
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools') && r.request().method() === 'POST'),
    page.locator('[data-testid="save-tool-btn"]').click(),
  ])

  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-090-params.png' })
})

test('#91 MW-06 工具编辑：设置工具访问权限（指定可使用的角色）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/tools/new`)
  await page.locator('[data-testid="tool-name-input"]').waitFor({ timeout: 10000 })

  // Fill basic info
  await page.locator('[data-testid="tool-name-input"]').fill('权限测试工具_91')

  // Roles section
  const rolesSection = page.locator('[data-testid="roles-section"]')
  await expect(rolesSection).toBeVisible()

  // Uncheck executor role (set manager-only)
  const executorCheck = page.locator('[data-testid="role-check-executor"]')
  const managerCheck = page.locator('[data-testid="role-check-manager"]')

  await expect(executorCheck).toBeChecked()
  await expect(managerCheck).toBeChecked()

  // Uncheck executor
  await executorCheck.uncheck()
  await expect(executorCheck).not.toBeChecked()

  // Save
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/tools') && r.request().method() === 'POST'),
    page.locator('[data-testid="save-tool-btn"]').click(),
  ])
  expect(response.status()).toBe(200)
  const toolData = await response.json()
  expect(toolData.allowed_roles).not.toContain('executor')
  expect(toolData.allowed_roles).toContain('manager')

  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-091-permissions.png' })
})
