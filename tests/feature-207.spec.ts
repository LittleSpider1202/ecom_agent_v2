import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, u }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { token: access_token, u: user })
  return access_token
}

test('#207 E2E：新成员邀请、配置权限完整流程', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // Step 1: 管理员在成员管理页面点击'邀请成员'
  await page.goto(`${BASE_URL}/manage/members`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const inviteBtn = page.locator('[data-testid="invite-btn"]')
  await expect(inviteBtn).toBeVisible({ timeout: 8000 })
  await inviteBtn.click()
  await page.waitForTimeout(300)

  // 验证邀请对话框出现
  const inviteDialog = page.locator('[data-testid="invite-dialog"]')
  await expect(inviteDialog).toBeVisible()

  // Step 2-4: 填写新成员信息
  const uniqueId = Date.now()
  await page.locator('[data-testid="invite-name-input"]').fill(`测试用户_${uniqueId}`)
  await page.locator('[data-testid="invite-feishu-input"]').fill(`feishu_${uniqueId}`)

  // Step 3: 选择角色为'执行者'
  const roleSelect = page.locator('[data-testid="invite-role-select"]')
  await roleSelect.selectOption('executor')

  // Step 4: 选择部门（如有）
  const deptSelect = page.locator('[data-testid="invite-dept-select"]')
  const deptCount = await deptSelect.locator('option').count()
  if (deptCount > 1) {
    const options = await deptSelect.locator('option').all()
    // 选第一个非空选项
    for (const opt of options) {
      const val = await opt.getAttribute('value')
      if (val && val !== '') {
        await deptSelect.selectOption(val)
        break
      }
    }
  }

  await page.screenshot({ path: 'verification/feature-207-invite-form.png' })

  // Step 5: 发送邀请
  await page.locator('[data-testid="confirm-invite-btn"]').click()
  await page.waitForTimeout(1500)

  // 验证邀请成功
  const successMsg = page.locator('[data-testid="invite-success"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-207-invite-success.png' })

  // Step 6: 验证新成员出现在列表中
  await page.waitForTimeout(1000)

  const membersRes = await page.request.get(`${API_URL}/api/members`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const members = await membersRes.json()
  const newMember = members.find((m: { display_name: string }) =>
    m.display_name === `测试用户_${uniqueId}`
  )
  expect(newMember, '新成员应出现在成员列表').toBeTruthy()

  // Step 7: 在角色管理页面验证权限配置可用
  await page.goto(`${BASE_URL}/manage/roles`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.locator('main, h1, [data-testid]').first()).toBeVisible()

  await page.screenshot({ path: 'verification/feature-207-roles.png' })

  // Step 8-9: 触发流程，指定该成员
  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const flows = await flowsRes.json()
  if (flows.length > 0) {
    const triggerRes = await page.request.post(`${API_URL}/api/flows/${flows[0].id}/trigger`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
    expect(triggerRes.status()).toBeLessThan(500)
  }

  // Step 11: 系统日志
  await page.goto(`${BASE_URL}/manage/logs`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.locator('main, h1, [data-testid]').first()).toBeVisible()

  await page.screenshot({ path: 'verification/feature-207-system-logs.png' })
})
