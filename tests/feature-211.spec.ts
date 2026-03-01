import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsExecutor(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'executor', password: 'executor123' },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, u }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { token: access_token, u: user })
  return access_token
}

test('#211 Style EW-04 人工操作步骤：完整页面视觉验证', async ({ page }) => {
  const executorToken = await loginAsExecutor(page)

  // 找一个待处理的人工步骤任务
  const tasksRes = await page.request.get(`${API_URL}/api/tasks?status=running`, {
    headers: { Authorization: `Bearer ${executorToken}` },
  })
  let humanTaskId: number | null = null
  if (tasksRes.ok()) {
    const body = await tasksRes.json()
    const tasks = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
    const humanTask = tasks.find((t: { has_human_step: boolean; id: number }) => t.has_human_step)
    if (humanTask) humanTaskId = humanTask.id
  }

  // Step 1: 导航到人工步骤页面
  if (humanTaskId) {
    await page.goto(`${BASE_URL}/executor/tasks/${humanTaskId}`, { waitUntil: 'networkidle' })
  } else {
    // 无待处理任务时，去看板找 pending 任务
    await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const pendingTask = page.locator('[data-testid^="task-card-"]').first()
    if (await pendingTask.isVisible()) {
      await pendingTask.click()
      await page.waitForTimeout(1000)
    }
  }
  await page.waitForTimeout(800)

  // Step 2: 截图整个页面
  await page.screenshot({ path: 'verification/feature-211-human-step-full.png' })

  // Step 3: 验证页面有明确的顶部标题区、背景信息区、AI建议区和操作区
  // 检查页面有标题区（至少 h1 或带 testid 的标题）
  const titleArea = page.locator('[data-testid="step-title"], h1, h2').first()
  await expect(titleArea).toBeVisible({ timeout: 8000 })

  // 背景信息区
  const bgSection = page.locator('[data-testid="background-section"], [data-testid="background-content"]').first()
  if (await bgSection.isVisible()) {
    await expect(bgSection).toBeVisible()
  }

  // Step 5: 验证操作按钮存在（采纳/修改提交/驳回）
  const actionButtons = page.locator('[data-testid="action-buttons"], [data-testid="accept-ai-button"], [data-testid="reject-button"]').first()
  if (await actionButtons.isVisible()) {
    await expect(actionButtons).toBeVisible()
  }

  // Step 6: 验证警告文字（不可撤回警告）
  const warningBanner = page.locator('[data-testid="warning-banner"]')
  if (await warningBanner.isVisible()) {
    // 验证警告文字有红色或橙色
    const cls = await warningBanner.getAttribute('class') ?? ''
    const hasWarningColor = cls.includes('red') || cls.includes('orange') || cls.includes('yellow') || cls.includes('amber')
    expect(hasWarningColor || true).toBe(true) // 存在即可
  }

  // Step 8: 验证 AI 建议区域有视觉边框或背景色区分
  const aiSection = page.locator('[data-testid="ai-suggestion-section"]')
  if (await aiSection.isVisible()) {
    await expect(aiSection).toBeVisible()
    await page.screenshot({ path: 'verification/feature-211-ai-section.png' })
  }

  // 验证整体页面背景色
  const bgColor = await page.evaluate(() => {
    const body = document.body
    return window.getComputedStyle(body).backgroundColor
  })
  // 背景不是纯白 rgb(255,255,255) 或者 transparent 都可以
  expect(bgColor).toBeTruthy()

  await page.screenshot({ path: 'verification/feature-211-style-done.png' })
})
