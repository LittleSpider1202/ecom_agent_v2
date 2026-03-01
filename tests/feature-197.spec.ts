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

test('#197 EW-02 任务列表：按负责人筛选任务', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // 获取成员列表，找一个有任务的成员
  const membersRes = await page.request.get(`${API_URL}/api/members`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const members = await membersRes.json()

  // 获取全部任务，找一个有任务的用户
  const monRes = await page.request.get(`${API_URL}/api/tasks/monitor`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTasks = await monRes.json()

  // 找一个有任务的 assigned_to id
  const assignedIds = [...new Set(allTasks.map((t: { assigned_to: number }) => t.assigned_to).filter(Boolean))]
  const targetMemberId = assignedIds[0] as number
  const targetMember = members.find((m: { id: number }) => m.id === targetMemberId)

  // 导航到任务监控（全局任务列表）
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 验证负责人筛选器存在
  const assigneeFilter = page.locator('[data-testid="assignee-filter"]')
  await expect(assigneeFilter).toBeVisible()

  // 在筛选前记录总行数
  const totalRows = await page.locator('[data-testid="monitor-task-row"]').count()
  expect(totalRows).toBeGreaterThan(0)

  if (targetMember) {
    // 选择一个负责人
    await assigneeFilter.selectOption(String(targetMemberId))
    await page.waitForTimeout(500)

    // 验证筛选后的行数 <= 总行数
    const filteredRows = await page.locator('[data-testid="monitor-task-row"]').count()
    expect(filteredRows).toBeLessThanOrEqual(totalRows)

    // 验证所有显示的行，负责人列都是目标用户
    if (filteredRows > 0) {
      const assigneeCells = page.locator(`[data-testid^="task-assignee-"]`)
      const count = await assigneeCells.count()
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await assigneeCells.nth(i).innerText()
        expect(text).toBe(targetMember.display_name)
      }
    }

    await page.screenshot({ path: `verification/feature-197-assignee-filter-${targetMember.display_name}.png` })

    // 重置筛选
    await assigneeFilter.selectOption('')
    await page.waitForTimeout(300)
    const resetRows = await page.locator('[data-testid="monitor-task-row"]').count()
    expect(resetRows).toBeGreaterThanOrEqual(filteredRows)
  }

  await page.screenshot({ path: 'verification/feature-197-assignee-filter.png' })
})
