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

test('#227 E2E：知识库AI问答引用SOP内容指导执行者操作', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const token = await loginAs(page, 'executor', 'executor123')

  // Step 1: 确认知识库有"退货处理SOP"词条（id=1）
  const knowledgeRes = await page.request.get(`${API_URL}/api/knowledge/1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(knowledgeRes.ok()).toBeTruthy()
  const entry = await knowledgeRes.json()
  expect(entry.title).toContain('退货')

  // Step 2: 执行者导航到知识库
  await page.goto('/executor/knowledge', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="qa-input-bar"]')).toBeVisible()

  // Step 3: 在AI问答输入问题
  const qaInput = page.locator('[data-testid="qa-input"]')
  await qaInput.fill('客户买了7天前的商品要求退货，天猫规定是什么？')
  await page.keyboard.press('Enter')

  // 等待 AI 回答
  await expect(page.locator('[data-testid="qa-answer-bubble"]')).toBeVisible({ timeout: 8000 })

  // Step 4: 验证 AI 回答引用了相关知识词条
  const qaResult = page.locator('[data-testid="qa-result"]')
  await expect(qaResult).toBeVisible()
  // 验证有引用词条
  const refBtns = page.locator('[data-testid^="qa-ref-"]')
  await expect(refBtns.first()).toBeVisible({ timeout: 5000 })

  // Step 5: 验证回答内容（包含问题关键词的回答）
  const answerBubble = page.locator('[data-testid="qa-answer-bubble"]')
  await expect(answerBubble).toContainText('知识库')

  await page.screenshot({ path: 'verification/feature-227-qa-answer.png' })

  // Step 6: 点击回答中引用的知识词条链接（退货处理SOP）
  // 找到引用退货相关的词条或第一个引用
  const refBtn = page.locator('[data-testid^="qa-ref-"]').first()
  const refId = await refBtn.getAttribute('data-testid').then(t => t?.replace('qa-ref-', ''))
  await refBtn.click()

  // Step 7: 进入词条详情，验证内容完整
  await page.waitForURL(/\/executor\/knowledge\/\d+/)
  await expect(page.locator('[data-testid="entry-title"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="entry-content"]')).toBeVisible()
  const titleText = await page.locator('[data-testid="entry-title"]').innerText()
  expect(titleText.length).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-227-entry-detail.png' })

  // Step 8: 执行者点击"有帮助"，记录反馈
  const helpfulBtn = page.locator('[data-testid="helpful-btn"]')
  await expect(helpfulBtn).toBeVisible()
  const helpfulCountBefore = await page.locator('[data-testid="helpful-count"]').innerText()
  await helpfulBtn.click()
  await page.waitForTimeout(500)
  // 验证点击后按钮状态变化（disabled）
  await expect(helpfulBtn).toBeDisabled()

  // Step 9: 点击"提交修正"
  const correctBtn = page.locator('[data-testid="correct-btn"]')
  await expect(correctBtn).toBeVisible()
  await correctBtn.click()

  // Step 10: 填写修正内容
  await page.waitForURL(/\/executor\/knowledge\/contribute/)
  await expect(page.locator('[data-testid="content-input"]')).toBeVisible({ timeout: 5000 })

  // 填写必要字段
  const contentInput = page.locator('[data-testid="content-input"]')
  await contentInput.fill('根据天猫平台规则，支持7天无理由退换货，消费者可在收货后7天内申请退货，商家需在48小时内处理。')

  const correctionReason = page.locator('[data-testid="correction-reason-input"]')
  if (await correctionReason.isVisible()) {
    await correctionReason.fill('补充了天猫平台7天无理由退换货的具体规则和处理时限')
  }

  // Step 11: 提交
  const submitBtn = page.locator('[data-testid="submit-btn"]')
  await expect(submitBtn).toBeVisible()
  await submitBtn.click()

  // 验证提交成功
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="success-message"]')).toContainText('提交')

  await page.screenshot({ path: 'verification/feature-227-correction-submitted.png' })

  // 无 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
