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
  return access_token
}

test('#206 E2E：知识贡献从提交到管理员审核发布完整流程', async ({ page }) => {
  // Step 1: 执行者登录，导航到知识贡献页面
  const executorToken = await loginAs(page, 'executor', 'executor123')
  await page.goto(`${BASE_URL}/executor/knowledge/contribute`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Step 2-3: 填写新知识词条并提交
  const titleInput = page.locator('[data-testid="title-input"]')
  await expect(titleInput).toBeVisible({ timeout: 8000 })

  const uniqueTitle = `拼多多退款处理规范_${Date.now()}`
  await titleInput.fill(uniqueTitle)

  const categorySelect = page.locator('[data-testid="category-select"]')
  await categorySelect.selectOption('平台规则')

  const contentInput = page.locator('[data-testid="content-input"]')
  await contentInput.fill('拼多多退款处理规范：1. 买家申请退款后24小时内响应；2. 确认退款原因；3. 按规范处理。')

  await page.screenshot({ path: 'verification/feature-206-contribute-form.png' })

  await page.locator('[data-testid="submit-btn"]').click()
  await page.waitForTimeout(1000)

  // Step 4: 验证提交成功，状态为'待审核'
  const successMsg = page.locator('[data-testid="success-message"]')
  await expect(successMsg).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-206-contribute-success.png' })

  // 通过 API 获取提交 ID
  const mySubsRes = await page.request.get(`${API_URL}/api/knowledge/my-submissions`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  const mySubs = await mySubsRes.json()
  const newSub = mySubs.find((s: { title: string; status: string }) =>
    s.title === uniqueTitle && s.status === 'pending'
  )
  expect(newSub, '应有待审核的投稿').toBeTruthy()

  // Step 5-6: 管理员导航到知识审核页面
  await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/knowledge-review`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-testid="review-title"]')).toBeVisible()

  // Step 6: 找到该待审核词条
  const subItem = page.locator(`[data-testid="submission-${newSub.id}"]`)
  await expect(subItem).toBeVisible({ timeout: 5000 })
  await expect(subItem).toContainText(uniqueTitle)

  // Step 7: 点击'批准'
  const approveBtn = page.locator(`[data-testid="approve-btn-${newSub.id}"]`)
  await expect(approveBtn).toBeVisible({ timeout: 5000 })
  await approveBtn.click()
  await page.waitForTimeout(2000)

  // Step 8: 验证词条状态变为'已发布'（投稿消失，显示成功消息）
  const approveMsg = page.locator('[data-testid="review-message"]')
  await expect(approveMsg).toBeVisible({ timeout: 8000 })
  await expect(approveMsg).toContainText('已批准发布')

  await page.screenshot({ path: 'verification/feature-206-approved.png' })

  // Step 9-10: 执行者在知识库搜索该词条
  await loginAs(page, 'executor', 'executor123')
  await page.goto(`${BASE_URL}/executor/knowledge`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 搜索
  const searchInput = page.locator('[data-testid="search-input"], input[placeholder*="搜索"]').first()
  if (await searchInput.isVisible()) {
    await searchInput.fill('拼多多退款')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)
  }

  // Step 11: 验证词条出现在搜索结果中（通过 API 验证）
  const managerToken2 = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  }).then(r => r.json()).then(d => d.access_token)

  const searchRes = await page.request.get(
    `${API_URL}/api/knowledge?search=${encodeURIComponent('拼多多退款')}`,
    { headers: { Authorization: `Bearer ${managerToken2}` } }
  )
  const results = await searchRes.json()
  const found = results.some((e: { title: string }) => e.title === uniqueTitle)
  expect(found, '已发布词条应出现在知识库搜索结果中').toBe(true)

  await page.screenshot({ path: 'verification/feature-206-knowledge-search.png' })
})
