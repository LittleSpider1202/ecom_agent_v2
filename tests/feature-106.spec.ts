import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

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

test('#106 MW-07 部门管理：尝试删除有成员的部门提示错误', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/departments`)
  await page.locator('[data-testid="dept-tree"]').waitFor({ timeout: 10000 })

  // Find a dept with members (运营部 has 3 members by default)
  const treeText = await page.locator('[data-testid="dept-tree"]').textContent()
  expect(treeText).toContain('人')

  // Find 运营部 by exact name match, then get its id and click its delete button
  const nameEl = page.locator('[data-testid^="dept-name-"]').filter({ hasText: /^运营部/ })
  const deptId = await nameEl.getAttribute('data-testid').then(s => s?.replace('dept-name-', ''))
  const deleteBtn = page.locator(`[data-testid="delete-btn-${deptId}"]`)
  await deleteBtn.click({ force: true })

  // Delete dialog appears
  await expect(page.locator('[data-testid="delete-dialog"]')).toBeVisible()

  // Try to delete
  await page.locator('[data-testid="confirm-delete-btn"]').click()

  // Error message appears
  await expect(page.locator('[data-testid="delete-error"]')).toBeVisible({ timeout: 5000 })
  const errText = await page.locator('[data-testid="delete-error"]').textContent()
  expect(errText).toContain('有成员')

  // Dept still in tree (dialog still open showing error)
  expect(await page.locator('[data-testid="dept-tree"]').textContent()).toContain('运营部')

  await page.screenshot({ path: 'tests/verification/feature-106-delete-error.png' })
})

test('#107 MW-08 角色权限：页面加载显示角色列表和权限矩阵', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/roles`)

  await expect(page.getByRole('heading', { name: '角色权限' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="role-list"]')).toBeVisible()

  // Role list has default roles
  const listText = await page.locator('[data-testid="role-list"]').textContent()
  expect(listText).toContain('管理员')
  expect(listText).toContain('执行者')

  // Click a role to show permission matrix
  await page.locator('[data-testid^="role-item-"]').first().click()
  await expect(page.locator('[data-testid="perm-matrix"]')).toBeVisible({ timeout: 5000 })

  // Permission matrix has module rows
  await expect(page.locator('[data-testid="perm-row-tasks"]')).toBeVisible()
  await expect(page.locator('[data-testid="perm-row-flows"]')).toBeVisible()

  await page.screenshot({ path: 'tests/verification/feature-107-roles.png' })
})

test('#108 MW-08 角色权限：创建新角色并配置基本权限', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/roles`)
  await page.locator('[data-testid="role-list"]').waitFor({ timeout: 10000 })

  // Click create
  await page.locator('[data-testid="create-role-btn"]').click()
  await expect(page.locator('[data-testid="create-role-dialog"]')).toBeVisible()

  // Enter name
  const roleName = '测试角色_108_' + Date.now()
  await page.locator('[data-testid="role-name-input"]').fill(roleName)

  // Check task view permission
  await page.locator('[data-testid="create-perm-tasks-view"]').check()

  // Confirm
  await page.locator('[data-testid="confirm-create-role-btn"]').click()
  await expect(page.locator('[data-testid="create-role-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // New role appears in list
  await expect(page.locator('[data-testid="role-list"]')).toContainText(roleName, { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-108-create-role.png' })
})

test('#109 MW-08 角色权限：编辑现有角色权限', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/roles`)
  await page.locator('[data-testid="role-list"]').waitFor({ timeout: 10000 })

  // Select 执行者 role
  const executorRole = page.locator('[data-testid^="role-item-"]').filter({ hasText: '执行者' })
  await executorRole.click()
  await expect(page.locator('[data-testid="perm-matrix"]')).toBeVisible()

  // Check current state of tasks-view (should be true by default)
  const tasksViewCheck = page.locator('[data-testid="perm-check-tasks-view"]')
  const isChecked = await tasksViewCheck.isChecked()

  // Toggle a permission (tasks-delete: should be false, click to true)
  const tasksDeleteCheck = page.locator('[data-testid="perm-check-tasks-delete"]')
  const wasChecked = await tasksDeleteCheck.isChecked()
  await tasksDeleteCheck.click()

  // Save
  await page.locator('[data-testid="save-role-btn"]').click()
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  // Reload and verify change persisted
  await page.reload()
  await page.locator('[data-testid="role-list"]').waitFor({ timeout: 10000 })
  await page.locator('[data-testid^="role-item-"]').filter({ hasText: '执行者' }).click()
  await expect(page.locator('[data-testid="perm-matrix"]')).toBeVisible()

  const newChecked = await page.locator('[data-testid="perm-check-tasks-delete"]').isChecked()
  expect(newChecked).toBe(!wasChecked)

  await page.screenshot({ path: 'tests/verification/feature-109-edit-role.png' })
})

test('#110 MW-08 角色权限：配置角色可接收的人工节点类型', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/roles`)
  await page.locator('[data-testid="role-list"]').waitFor({ timeout: 10000 })

  // Select 执行者 role
  await page.locator('[data-testid^="role-item-"]').filter({ hasText: '执行者' }).click()
  await expect(page.locator('[data-testid="node-types-section"]')).toBeVisible()

  // Check data_confirm and review_judge
  const dataConfirm = page.locator('[data-testid="node-type-data_confirm"]')
  const reviewJudge = page.locator('[data-testid="node-type-review_judge"]')

  await expect(dataConfirm).toBeVisible()
  await expect(reviewJudge).toBeVisible()

  // Check review_judge (may not be checked)
  if (!(await reviewJudge.isChecked())) {
    await reviewJudge.check()
  }

  // Ensure data_confirm is checked
  if (!(await dataConfirm.isChecked())) {
    await dataConfirm.check()
  }

  // Save
  await page.locator('[data-testid="save-role-btn"]').click()
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-110-node-types.png' })
})
