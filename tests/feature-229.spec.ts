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

test('#229 E2E：完整组织架构配置——公司→部门→角色→成员', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const ts = Date.now()
  const deptName = `运营部_${ts}`
  const subDeptName = `店铺运营组_${ts}`
  const roleName = `店铺运营_${ts}`
  const memberName = `测试成员_${ts}`
  const memberFeishu = `feishu_${ts}`

  const mgrToken = await loginAs(page, 'manager', 'manager123')

  // Step 1: 导航到 MW-07 部门管理
  await page.goto('/manage/departments', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="dept-tree"]')).toBeVisible({ timeout: 5000 })

  // Step 2: 在根节点下创建子部门
  const createBtn = page.locator('[data-testid="create-dept-btn"]')
  await expect(createBtn).toBeVisible()
  await createBtn.click()
  await expect(page.locator('[data-testid="create-dialog"]')).toBeVisible()

  await page.locator('[data-testid="dept-name-input"]').fill(deptName)
  // parent_id 留空（默认根节点下）
  await page.locator('[data-testid="confirm-create-btn"]').click()
  await page.waitForTimeout(500)

  // 验证新部门出现在树中
  await expect(page.locator(`[data-testid="dept-tree"]`)).toContainText(deptName)

  // Step 3: 获取新建部门 ID，在其下创建子部门
  const deptListRes = await page.request.get(`${API_URL}/api/departments`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  const deptData = await deptListRes.json()
  const allDepts: any[] = deptData.flat || []
  const newDept = allDepts.find((d: any) => d.name === deptName)
  const parentId = newDept?.id

  if (parentId) {
    // 再创建子部门
    await page.locator('[data-testid="create-dept-btn"]').click()
    await expect(page.locator('[data-testid="create-dialog"]')).toBeVisible()
    await page.locator('[data-testid="dept-name-input"]').fill(subDeptName)
    const parentSelect = page.locator('[data-testid="parent-dept-select"]')
    await parentSelect.selectOption({ value: String(parentId) })
    await page.locator('[data-testid="confirm-create-btn"]').click()
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="dept-tree"]')).toContainText(subDeptName)
  }

  await page.screenshot({ path: 'verification/feature-229-departments.png' })

  // Step 4: 导航到 MW-08 角色权限，创建角色
  await page.goto('/manage/roles', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="role-list"]')).toBeVisible({ timeout: 5000 })

  const createRoleBtn = page.locator('[data-testid="create-role-btn"]')
  await expect(createRoleBtn).toBeVisible()
  await createRoleBtn.click()
  await expect(page.locator('[data-testid="create-role-dialog"]')).toBeVisible()

  await page.locator('[data-testid="role-name-input"]').fill(roleName)
  await page.locator('[data-testid="role-desc-input"]').fill('店铺运营岗位角色')

  // Step 5: 配置权限（勾选任务查看权限）
  const tasksViewCheck = page.locator('[data-testid="create-perm-tasks-view"]')
  if (await tasksViewCheck.count() > 0) {
    const isChecked = await tasksViewCheck.isChecked()
    if (!isChecked) await tasksViewCheck.click()
  }

  await page.locator('[data-testid="confirm-create-role-btn"]').click()
  await page.waitForTimeout(500)

  // 验证角色出现在列表
  await expect(page.locator('[data-testid="role-list"]')).toContainText(roleName)

  await page.screenshot({ path: 'verification/feature-229-roles.png' })

  // Step 6: 导航到 MW-09 成员管理，邀请新成员
  await page.goto('/manage/members', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="member-list"]')).toBeVisible({ timeout: 5000 })

  const inviteBtn = page.locator('[data-testid="invite-btn"]')
  await expect(inviteBtn).toBeVisible()
  await inviteBtn.click()
  await expect(page.locator('[data-testid="invite-dialog"]')).toBeVisible()

  await page.locator('[data-testid="invite-name-input"]').fill(memberName)
  await page.locator('[data-testid="invite-feishu-input"]').fill(memberFeishu)

  // Step 7: 为成员分配角色（选 executor）
  const roleSelect = page.locator('[data-testid="invite-role-select"]')
  await roleSelect.selectOption('executor')

  // Step 8: 归入部门（若有新建部门则选中）
  const deptSelect = page.locator('[data-testid="invite-dept-select"]')
  const deptOptions = await deptSelect.locator('option').allTextContents()
  if (deptOptions.some(o => o.includes(deptName.split('_')[0]))) {
    // 选第一个运营部相关选项
    const opt = deptOptions.find(o => o.includes(deptName.split('_')[0]))
    if (opt) {
      const optEl = page.locator('[data-testid="invite-dept-select"] option').filter({ hasText: deptName.split('_')[0] }).first()
      const val = await optEl.getAttribute('value')
      if (val) await deptSelect.selectOption(val)
    }
  }

  await page.locator('[data-testid="confirm-invite-btn"]').click()
  await expect(page.locator('[data-testid="invite-success"]')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)

  // Step 9: 验证成员出现在列表
  await page.goto('/manage/members', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="member-list"]')).toContainText(memberName)

  await page.screenshot({ path: 'verification/feature-229-members.png' })

  // Step 9b: 返回部门管理验证组织树正确显示
  await page.goto('/manage/departments', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="dept-tree"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="dept-tree"]')).toContainText(deptName)

  // Step 10: 新成员用 API 验证（已存在于系统）
  const membersRes = await page.request.get(`${API_URL}/api/members`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  if (membersRes.ok()) {
    const mData = await membersRes.json()
    const members: any[] = mData.members || mData
    const newMember = members.find((m: any) => m.display_name === memberName || m.feishu_id === memberFeishu)
    expect(newMember).toBeTruthy()
    expect(newMember.role).toBe('executor')
  }

  // Step 11: 系统日志记录了组织架构变更
  const logsRes = await page.request.get(`${API_URL}/api/logs`, {
    headers: { Authorization: `Bearer ${mgrToken}` },
  })
  if (logsRes.ok()) {
    const logData = await logsRes.json()
    const logs: any[] = logData.logs || []
    // 应有成员邀请日志
    const inviteLog = logs.find((l: any) => l.action === '成员邀请' && l.detail?.includes(memberName))
    expect(inviteLog).toBeTruthy()
  }

  // 无关键 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
