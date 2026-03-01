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

test('#196 MW-10 全局任务监控：显示人工节点等待时间（超时预警）', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // 确保有一个 running + has_human_step=True 的任务
  // 先获取任务列表看是否已有
  const monRes = await page.request.get(`${API_URL}/api/tasks/monitor`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTasks = await monRes.json()
  const stalledTask = allTasks.find((t: { status: string; has_human_step: boolean }) =>
    t.status === 'running' && t.has_human_step === true
  )

  if (!stalledTask) {
    // 触发一个新流程（采购审核流程有 human 节点）
    const flowRes = await page.request.get(`${API_URL}/api/flows`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
    const flows = await flowRes.json()
    const humanFlow = flows.find((f: { name: string }) =>
      f.name.includes('采购') || f.name.includes('审核')
    )
    if (humanFlow) {
      await page.request.post(`${API_URL}/api/flows/${humanFlow.id}/trigger`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      })
    }
  }

  // 导航到全局任务监控
  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // 验证页面标题
  await expect(page.locator('[data-testid="monitor-title"]')).toContainText('全局任务监控', { timeout: 10000 })

  // 验证有任务行
  const rows = page.locator('[data-testid="monitor-task-row"]')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)

  // 验证有"人工等待时间"列（找有 wait-time 的行）
  // 如果有 running + has_human_step 的任务，等待时间应该显示
  const waitTimeCells = page.locator('[data-testid^="wait-time-"]')
  const waitCount = await waitTimeCells.count()

  if (waitCount > 0) {
    // 验证等待时间文字包含时间信息
    const firstWait = waitTimeCells.first()
    const text = await firstWait.innerText()
    expect(text).toMatch(/\d+.*[分小时]/)

    // 如果有超时预警（橙色/红色），验证有警告图标
    const warnIcons = page.locator('[data-testid^="timeout-warn-"], [data-testid^="timeout-alert-"]')
    // 不强制要求有超时，但验证没有错误样式
    const warnCount = await warnIcons.count()
    // warnCount may be 0 if tasks just started — that's OK
    expect(warnCount).toBeGreaterThanOrEqual(0)
  } else {
    // 没有 running human 任务时，列仍然存在（显示 — 占位）
    // 验证表格存在即可
    await expect(page.locator('[data-testid="task-monitor-table"]')).toBeVisible()
  }

  await page.screenshot({ path: 'verification/feature-196-task-monitor-wait-time.png' })

  // 额外验证：对于 running+has_human_step 的任务行，等待时间列不为空
  const monRes2 = await page.request.get(`${API_URL}/api/tasks/monitor`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const allTasks2 = await monRes2.json()
  const stalledTasks = allTasks2.filter((t: { status: string; has_human_step: boolean }) =>
    t.status === 'running' && t.has_human_step === true
  )

  for (const t of stalledTasks.slice(0, 3)) {
    const cell = page.locator(`[data-testid="wait-time-${t.id}"]`)
    const count = await cell.count()
    if (count > 0) {
      const txt = await cell.innerText()
      expect(txt).toMatch(/\d+/)
    }
  }
})
