import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAs(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username, password },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, u }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { token: access_token, u: user })
  return access_token as string
}

test('#218 MW-09 成员管理：按部门筛选成员列表', async ({ page }) => {
  const token = await loginAs(page, 'manager', 'manager123')

  // Get departments to find one to filter by
  const deptsRes = await page.request.get(`${API_URL}/api/departments`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const deptsData = await deptsRes.json()
  const depts = (deptsData.flat || deptsData) as Array<{ id: number; name: string }>
  expect(depts.length).toBeGreaterThan(0)

  // Get all members to understand the data
  const allMembersRes = await page.request.get(`${API_URL}/api/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const allMembers = await allMembersRes.json() as Array<{ id: number; department_id: number | null; department_name: string | null }>

  // Find a department that has at least one member
  const deptWithMembers = depts.find(d =>
    allMembers.some(m => m.department_id === d.id)
  )

  // Step 1: 导航到成员管理页面
  await page.goto(`${BASE_URL}/manage/members`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Verify the member list and dept filter are visible
  await expect(page.getByTestId('member-list')).toBeVisible()
  await expect(page.getByTestId('dept-filter')).toBeVisible()

  const totalRows = await page.locator('[data-testid^="member-row-"]').count()
  expect(totalRows).toBeGreaterThan(0)

  if (deptWithMembers) {
    // Step 2: 在部门筛选器选择一个部门
    await page.getByTestId('dept-filter').selectOption(String(deptWithMembers.id))
    await page.waitForTimeout(800)

    // Step 3: 验证列表只显示该部门成员
    const filteredRows = await page.locator('[data-testid^="member-row-"]').count()
    expect(filteredRows).toBeGreaterThan(0)
    expect(filteredRows).toBeLessThanOrEqual(totalRows)

    // Verify via API that filter works
    const filteredRes = await page.request.get(
      `${API_URL}/api/members?department_id=${deptWithMembers.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const filteredMembers = await filteredRes.json() as Array<{ department_id: number | null }>
    expect(filteredMembers.every(m => m.department_id === deptWithMembers.id)).toBe(true)

    await page.screenshot({ path: 'verification/feature-218-dept-filter-active.png' })
  }

  // Step 4: 清除筛选，验证全部成员显示
  await page.getByTestId('dept-filter').selectOption('')
  await page.waitForTimeout(800)

  const afterClearRows = await page.locator('[data-testid^="member-row-"]').count()
  expect(afterClearRows).toBe(totalRows)

  await page.screenshot({ path: 'verification/feature-218-dept-filter-cleared.png' })
})
