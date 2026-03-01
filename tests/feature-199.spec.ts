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

test('#199 知识库管理：审核并批准执行者提交的知识贡献', async ({ page }) => {
  // Step 1: 执行者提交一条新知识词条
  const executorToken = await loginAs(page, 'executor', 'executor123')

  const submitRes = await page.request.post(`${API_URL}/api/knowledge/submissions`, {
    data: {
      type: 'new',
      title: `测试知识词条_${Date.now()}`,
      content: '这是执行者提交的测试知识内容，用于审核流程验证。',
      category: '运营规则',
    },
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  expect(submitRes.ok()).toBe(true)
  const submitData = await submitRes.json()
  const subId = submitData.id
  expect(subId).toBeTruthy()

  // Step 2: 管理员导航到知识审核页面
  const managerToken = await loginAs(page, 'manager', 'manager123')
  await page.goto(`${BASE_URL}/manage/knowledge-review`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 验证页面标题
  await expect(page.locator('[data-testid="review-title"]')).toContainText('知识贡献审核')

  // Step 3: 找到待审核的词条
  await expect(page.locator('[data-testid="submission-list"]')).toBeVisible({ timeout: 8000 })
  const submissionItem = page.locator(`[data-testid="submission-${subId}"]`)
  await expect(submissionItem).toBeVisible()

  // Step 4: 查看词条内容
  const contentEl = page.locator(`[data-testid="sub-content-${subId}"]`)
  await expect(contentEl).toContainText('执行者提交的测试知识内容')

  await page.screenshot({ path: 'verification/feature-199-review-page.png' })

  // Step 5: 点击"批准"
  const approveBtn = page.locator(`[data-testid="approve-btn-${subId}"]`)
  await expect(approveBtn).toBeVisible()
  await approveBtn.click()
  await page.waitForTimeout(1000)

  // Step 6: 验证词条状态更新为已发布（投稿从列表消失，显示成功消息）
  const msg = page.locator('[data-testid="review-message"]')
  await expect(msg).toBeVisible({ timeout: 5000 })
  await expect(msg).toContainText('已批准发布')

  // 投稿已从待审核列表移除
  const submissionGone = await page.locator(`[data-testid="submission-${subId}"]`).count()
  expect(submissionGone).toBe(0)

  await page.screenshot({ path: 'verification/feature-199-approved.png' })

  // Step 7: 验证执行者可在知识库中看到该词条
  // 通过 API 验证词条已变为 active
  const pendingRes = await page.request.get(`${API_URL}/api/knowledge/submissions/pending`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const remaining = await pendingRes.json()
  const stillPending = remaining.find((s: { id: number }) => s.id === subId)
  expect(stillPending).toBeUndefined()

  // 知识库列表中可搜到该词条
  const knowledgeRes = await page.request.get(`${API_URL}/api/knowledge?search=测试知识词条`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  const entries = await knowledgeRes.json()
  const found = entries.some((e: { title: string }) => e.title.startsWith('测试知识词条'))
  expect(found, '执行者应能在知识库中看到已批准词条').toBe(true)
})
