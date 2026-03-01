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

test('#101 MW-07 部门管理：页面加载显示组织树结构', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)

  await expect(page.getByRole('heading', { name: '部门管理' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="dept-tree"]')).toBeVisible()

  // Root node visible
  const tree = page.locator('[data-testid="dept-tree"]')
  const text = await tree.textContent()
  expect(text).toContain('总公司')

  // At least one dept node visible
  await expect(page.locator('[data-testid^="dept-node-"]').first()).toBeVisible()

  await page.screenshot({ path: 'tests/verification/feature-101-dept-tree.png' })
})

test('#102 MW-07 部门管理：展开/折叠组织树节点', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)
  await page.locator('[data-testid="dept-tree"]').waitFor({ timeout: 10000 })

  // Find the root node (总公司) which has children
  // The toggle button is visible on the root node
  const rootToggle = page.locator('[data-testid^="toggle-"]').first()
  await expect(rootToggle).toBeVisible()

  // Children should be visible initially
  const childrenContainer = page.locator('[data-testid^="children-"]').first()
  await expect(childrenContainer).toBeVisible()

  // Collapse
  await rootToggle.click()
  await expect(childrenContainer).not.toBeVisible()

  // Expand
  await rootToggle.click()
  await expect(childrenContainer).toBeVisible()

  await page.screenshot({ path: 'tests/verification/feature-102-expand-collapse.png' })
})

test('#103 MW-07 部门管理：新建部门并设置父级部门', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)
  await page.locator('[data-testid="dept-tree"]').waitFor({ timeout: 10000 })

  // Click create button
  await page.locator('[data-testid="create-dept-btn"]').click()
  await expect(page.locator('[data-testid="create-dialog"]')).toBeVisible()

  // Enter name
  const deptName = '测试新部门_103_' + Date.now()
  await page.locator('[data-testid="dept-name-input"]').fill(deptName)

  // Select parent (choose 运营部 or any existing)
  const parentSelect = page.locator('[data-testid="parent-dept-select"]')
  const options = await parentSelect.locator('option').count()
  expect(options).toBeGreaterThan(1) // has at least one real dept

  // Pick second option (first real dept)
  await parentSelect.selectOption({ index: 1 })

  // Confirm
  await page.locator('[data-testid="confirm-create-btn"]').click()

  // Dialog closes
  await expect(page.locator('[data-testid="create-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // New dept appears in tree
  await expect(page.locator('[data-testid="dept-tree"]')).toContainText(deptName, { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-103-create-dept.png' })
})

test('#104 MW-07 部门管理：编辑部门名称', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)
  await page.locator('[data-testid="dept-tree"]').waitFor({ timeout: 10000 })

  // Click edit button (hidden via CSS group-hover, use force)
  const editBtn = page.locator('[data-testid^="edit-btn-"]').first()
  await editBtn.click({ force: true })

  await expect(page.locator('[data-testid="edit-dialog"]')).toBeVisible()

  // Change name
  const newName = '已编辑部门_104'
  await page.locator('[data-testid="edit-name-input"]').clear()
  await page.locator('[data-testid="edit-name-input"]').fill(newName)
  await page.locator('[data-testid="confirm-edit-btn"]').click()

  // Dialog closes
  await expect(page.locator('[data-testid="edit-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // Tree shows updated name
  await expect(page.locator('[data-testid="dept-tree"]')).toContainText(newName, { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-104-edit-dept.png' })
})

test('#105 MW-07 部门管理：删除空部门（无成员）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)
  await page.locator('[data-testid="dept-tree"]').waitFor({ timeout: 10000 })

  // Create an empty dept first to ensure we have one to delete
  await page.locator('[data-testid="create-dept-btn"]').click()
  const deptName = '待删除部门_105_' + Date.now()
  await page.locator('[data-testid="dept-name-input"]').fill(deptName)
  await page.locator('[data-testid="confirm-create-btn"]').click()
  await expect(page.locator('[data-testid="create-dialog"]')).not.toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="dept-tree"]')).toContainText(deptName)

  // Find node by name and click delete (hidden via CSS group-hover, use force)
  const newNode = page.locator('[data-testid^="dept-node-"]').filter({ hasText: deptName })
  const deleteBtn = newNode.locator('[data-testid^="delete-btn-"]').first()
  await deleteBtn.click({ force: true })

  // Delete dialog appears
  await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()
  expect(await page.locator('[data-testid="delete-dialog"]').textContent()).toContain(deptName)

  // Confirm delete
  await page.locator('[data-testid="confirm-delete-btn"]').click()

  // Dialog closes
  await expect(page.locator('[data-testid="delete-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // Dept no longer in tree
  await expect(page.locator('[data-testid="dept-tree"]')).not.toContainText(deptName, { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-105-delete-dept.png' })
})
