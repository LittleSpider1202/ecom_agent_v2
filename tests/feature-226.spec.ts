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

test('#226 E2E：数据分析看板展示真实任务执行效率数据', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  const token = await loginAs(page, 'manager', 'manager123')

  // Step 1: 获取当前任务完成数（用于后续对比）
  const trendRes = await page.request.get(`${API_URL}/api/analytics/trend?days=30`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const trendData = await trendRes.json()
  const expectedCompleted = trendData.total_completed

  // Step 2: 管理员导航到数据分析看板
  await page.goto('/manage/analytics', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="analytics-title"]')).toBeVisible()

  // Step 3: 选择日期范围为最近30天
  const btn30 = page.locator('[data-testid="range-btn-30"]')
  await expect(btn30).toBeVisible()
  await btn30.click()
  await page.waitForTimeout(500)

  // Step 4: 验证效率趋势图显示每日任务完成数量
  await expect(page.locator('[data-testid="trend-chart-container"]')).toBeVisible()
  await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible()
  await expect(page.locator('[data-testid="time-axis-label"]')).toBeVisible()

  // Step 5: 查看瓶颈分析，找到耗时最长的流程步骤
  await expect(page.locator('[data-testid="bottleneck-section"]')).toBeVisible()
  const bottleneckList = page.locator('[data-testid="bottleneck-list"]')
  await expect(bottleneckList).toBeVisible()
  const firstItem = page.locator('[data-testid="bottleneck-item-0"]')
  await expect(firstItem).toBeVisible()
  const firstDuration = page.locator('[data-testid="bottleneck-duration-0"]')
  await expect(firstDuration).toContainText('平均')

  // Step 6: 按流程类型筛选
  const flowSelect = page.locator('[data-testid="flow-name-select"]')
  await expect(flowSelect).toBeVisible()

  // 获取流程名称列表
  const flowNamesRes = await page.request.get(`${API_URL}/api/analytics/flow-names`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const { flow_names } = await flowNamesRes.json()

  // 如有流程名，选第一个筛选
  if (flow_names && flow_names.length > 0) {
    await flowSelect.selectOption(flow_names[0])
    await page.waitForTimeout(800)
    // 验证筛选后仍然显示图表
    await expect(page.locator('[data-testid="trend-chart-container"]')).toBeVisible()
    // 清除筛选
    const clearBtn = page.locator('[data-testid="clear-flow-filter"]')
    if (await clearBtn.isVisible()) {
      await clearBtn.click()
      await page.waitForTimeout(500)
    }
  }

  // Step 7: 验证图表数据与实际完成任务数量相符
  const totalCompleted = page.locator('[data-testid="total-completed"]')
  await expect(totalCompleted).toBeVisible()
  const displayedCount = parseInt(await totalCompleted.innerText())
  expect(displayedCount).toBe(expectedCompleted)

  // Step 8: 检查平均人工步骤处理时间指标
  const avgHumanTime = page.locator('[data-testid="avg-human-step-time"]')
  await expect(avgHumanTime).toBeVisible()
  // 值可能是数字或 "—"（无数据时）
  const avgText = await avgHumanTime.innerText()
  expect(avgText.length).toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-226-analytics.png' })

  // Step 9: 找到效率低的流程（第一个瓶颈），点击跳转到流程定义
  const bottleneckLink = page.locator('[data-testid="bottleneck-link-0"]')
  await expect(bottleneckLink).toBeVisible()
  await bottleneckLink.click()

  // 验证跳转到流程管理页面
  await page.waitForURL(/\/manage\/flows/)
  await expect(page.locator('[data-testid="flow-list-title"], h1, [data-testid="analytics-title"]').first()).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-226-flows-navigate.png' })

  // Step 10-11: 在流程编辑器中，编辑第一个流程（如有）并保存
  // 找到流程列表中的第一个流程并尝试点击编辑
  const editBtns = page.locator('[data-testid^="flow-edit-"], button:has-text("编辑"), [data-testid^="edit-flow-"]')
  if (await editBtns.count() > 0) {
    await editBtns.first().click()
    await page.waitForTimeout(500)
    // 找到保存按钮
    const saveBtn = page.locator('button:has-text("保存"), [data-testid="save-flow"]')
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click()
      await page.waitForTimeout(500)
    }
  }

  await page.screenshot({ path: 'verification/feature-226-complete.png' })

  // 无 JS 错误
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('ResizeObserver')
  )
  expect(criticalErrors).toHaveLength(0)
})
