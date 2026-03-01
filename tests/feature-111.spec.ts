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

test('#111 MW-09 成员管理：页面加载显示成员列表', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/members`)

  await expect(page.getByRole('heading', { name: '成员管理' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-testid="member-list"]')).toBeVisible()

  // Wait for actual rows to load
  await expect(page.locator('[data-testid^="member-row-"]').first()).toBeVisible({ timeout: 10000 })

  // Default users should be in list
  const listText = await page.locator('[data-testid="member-list"]').textContent()
  expect(listText).toContain('executor')

  // Each row shows role info
  const firstRow = page.locator('[data-testid^="member-row-"]').first()
  await expect(firstRow).toBeVisible()

  await page.screenshot({ path: 'tests/verification/feature-111-member-list.png' })
})

test('#112 MW-09 成员管理：搜索成员按姓名或飞书ID过滤', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/members`)
  await expect(page.locator('[data-testid^="member-row-"]').first()).toBeVisible({ timeout: 10000 })

  const totalRows = await page.locator('[data-testid^="member-row-"]').count()
  expect(totalRows).toBeGreaterThan(0)

  // Search for 'manager'
  await page.locator('[data-testid="member-search"]').fill('manager')
  await page.waitForTimeout(500) // debounce

  const filteredRows = await page.locator('[data-testid^="member-row-"]').count()
  expect(filteredRows).toBeGreaterThan(0)
  expect(filteredRows).toBeLessThanOrEqual(totalRows)

  // Clear search
  await page.locator('[data-testid="member-search"]').clear()
  await page.waitForTimeout(500)
  const restoredRows = await page.locator('[data-testid^="member-row-"]').count()
  expect(restoredRows).toBe(totalRows)

  await page.screenshot({ path: 'tests/verification/feature-112-search.png' })
})

test('#113 MW-09 成员管理：邀请新成员（输入飞书ID/邮箱发送邀请）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/members`)
  await page.locator('[data-testid="member-list"]').waitFor({ timeout: 10000 })

  // Click invite
  await page.locator('[data-testid="invite-btn"]').click()
  await expect(page.locator('[data-testid="invite-dialog"]')).toBeVisible()

  // Fill form
  const ts = Date.now()
  await page.locator('[data-testid="invite-name-input"]').fill('测试成员_113')
  await page.locator('[data-testid="invite-feishu-input"]').fill(`fs_user_${ts}`)

  // Select role
  await page.locator('[data-testid="invite-role-select"]').selectOption('executor')

  // Select dept (pick first available)
  const deptSelect = page.locator('[data-testid="invite-dept-select"]')
  const opts = await deptSelect.locator('option').count()
  if (opts > 1) {
    await deptSelect.selectOption({ index: 1 })
  }

  // Send invite
  await page.locator('[data-testid="confirm-invite-btn"]').click()

  // Success message
  await expect(page.locator('[data-testid="invite-success"]')).toBeVisible({ timeout: 5000 })

  // Dialog closes and new member appears
  await expect(page.locator('[data-testid="invite-dialog"]')).not.toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="member-list"]')).toContainText('测试成员_113', { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-113-invite.png' })
})

test('#114 MW-09 成员管理：为成员分配不同角色', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/members`)
  await page.locator('[data-testid="member-list"]').waitFor({ timeout: 10000 })

  // Find executor user (not manager themselves)
  const executorRow = page.locator('[data-testid^="member-row-"]').filter({ hasText: 'executor' })
  const executorId = await executorRow.first().getAttribute('data-testid').then(s => s?.replace('member-row-', ''))

  // Click edit
  await page.locator(`[data-testid="edit-member-${executorId}"]`).click()
  await expect(page.locator('[data-testid="edit-member-dialog"]')).toBeVisible()

  // Change role
  const currentRole = await page.locator('[data-testid="edit-role-select"]').inputValue()
  const newRole = currentRole === 'executor' ? 'manager' : 'executor'
  await page.locator('[data-testid="edit-role-select"]').selectOption(newRole)

  // Save
  await page.locator('[data-testid="confirm-edit-member-btn"]').click()
  await expect(page.locator('[data-testid="edit-success"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="edit-member-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // Verify role badge updated
  await expect(page.locator(`[data-testid="member-role-${executorId}"]`)).toContainText(
    newRole === 'manager' ? '经理' : '执行者', { timeout: 5000 }
  )

  await page.screenshot({ path: 'tests/verification/feature-114-edit-role.png' })
})

test('#115 MW-09 成员管理：将成员移出组织（移除成员）', async ({ page }) => {
  await loginAsManager(page)
  await page.goto(`${BASE_URL}/manage/members`)
  await page.locator('[data-testid="member-list"]').waitFor({ timeout: 10000 })

  // Invite a test member to remove
  await page.locator('[data-testid="invite-btn"]').click()
  const ts = Date.now()
  await page.locator('[data-testid="invite-name-input"]').fill('待移除成员_115')
  await page.locator('[data-testid="invite-feishu-input"]').fill(`remove_${ts}`)
  await page.locator('[data-testid="confirm-invite-btn"]').click()
  await expect(page.locator('[data-testid="invite-dialog"]')).not.toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="member-list"]')).toContainText('待移除成员_115')

  // Find the remove button for this member
  const newRow = page.locator('[data-testid^="member-row-"]').filter({ hasText: '待移除成员_115' })
  const memberId = await newRow.getAttribute('data-testid').then(s => s?.replace('member-row-', ''))

  await page.locator(`[data-testid="remove-member-${memberId}"]`).click()
  await expect(page.locator('[data-testid="remove-dialog"]')).toBeVisible()
  expect(await page.locator('[data-testid="remove-dialog"]').textContent()).toContain('待移除成员_115')

  // Confirm remove
  await page.locator('[data-testid="confirm-remove-btn"]').click()
  await expect(page.locator('[data-testid="remove-dialog"]')).not.toBeVisible({ timeout: 5000 })

  // Member no longer in list
  await expect(page.locator('[data-testid="member-list"]')).not.toContainText('待移除成员_115', { timeout: 5000 })

  await page.screenshot({ path: 'tests/verification/feature-115-remove.png' })
})
