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
}

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
}

test('#219 整体页面：浏览器控制台无JavaScript报错（主要页面检查）', async ({ page }) => {
  const allErrors: Array<{ page: string; error: string }> = []

  // Ignore non-critical patterns
  const ignoredPatterns = [
    'favicon',
    'net::ERR_',
    'Failed to load resource',
    'ResizeObserver loop',
    'Warning:',  // React dev warnings (not real errors)
  ]

  const isIgnored = (msg: string) => ignoredPatterns.some(p => msg.includes(p))

  page.on('console', msg => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) {
      allErrors.push({ page: page.url(), error: msg.text() })
    }
  })
  page.on('pageerror', err => {
    if (!isIgnored(err.message)) {
      allErrors.push({ page: page.url(), error: `PageError: ${err.message}` })
    }
  })

  // Step 2: 依次访问主要页面

  // 看板（执行者）
  await loginAsExecutor(page)
  await page.goto(`${BASE_URL}/executor/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'verification/feature-219-dashboard.png' })

  // 任务列表
  await page.goto(`${BASE_URL}/executor/tasks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'verification/feature-219-task-list.png' })

  // EW-04 人工步骤（通过找一个 pending human step 的任务）
  const tasksRes = await page.request.get(`${API_URL}/api/tasks/my`, {
    headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('auth_token'))}` },
  })
  const tasksData = await tasksRes.json()
  const runningTasks = tasksData.running || []
  const humanTask = runningTasks.find((t: { has_human_step: boolean }) => t.has_human_step)
  if (humanTask) {
    await page.goto(`${BASE_URL}/executor/tasks/${humanTask.id}/step`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'verification/feature-219-ew04.png' })
  }

  // 流程编辑器（管理者）
  await loginAsManager(page)

  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('auth_token'))}` },
  })
  const flows = await flowsRes.json() as Array<{ id: number }>
  if (flows.length > 0) {
    await page.goto(`${BASE_URL}/manage/flows/${flows[0].id}/edit`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'verification/feature-219-flow-editor.png' })
  }

  // 决策驾驶舱
  await page.goto(`${BASE_URL}/manage/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'verification/feature-219-cockpit.png' })

  // Step 4: 验证Console中无红色Error错误
  if (allErrors.length > 0) {
    console.log('Console errors:', JSON.stringify(allErrors, null, 2))
  }
  expect(allErrors, `Found ${allErrors.length} console errors: ${JSON.stringify(allErrors)}`).toHaveLength(0)
})
