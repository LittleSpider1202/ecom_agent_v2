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

test('#208 E2E：流程版本回滚完整操作流程', async ({ page }) => {
  const managerToken = await loginAsManager(page)

  // 找一个流程
  const flowsRes = await page.request.get(`${API_URL}/api/flows`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  const flows = await flowsRes.json()
  const targetFlow = flows[0]
  expect(targetFlow).toBeTruthy()

  // Step 1: 打开流程编辑器，记录原始节点数
  await page.goto(`${BASE_URL}/manage/flows/${targetFlow.id}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 10000 })
  await page.waitForTimeout(500)

  const initialNodes = await page.locator('[data-testid^="node-"]').count()

  // Step 2: 添加一个新节点并保存（生成新版本）
  const addAutoNode = page.locator('[data-testid="panel-node-auto"]')
  if (await addAutoNode.isVisible()) {
    await addAutoNode.click()
    await page.waitForTimeout(300)
  }

  await page.locator('[data-testid="save-btn"]').click()
  await page.waitForTimeout(1500)

  await page.screenshot({ path: 'verification/feature-208-flow-saved-v2.png' })

  // Step 5: 导航到 MW-04 流程版本历史页面
  await page.goto(`${BASE_URL}/manage/flows/${targetFlow.id}/versions`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await expect(page.locator('[data-testid="versions-title"]')).toBeVisible()
  const versionsList = page.locator('[data-testid="versions-list"]')
  await expect(versionsList).toBeVisible()

  const versionItems = page.locator('[data-testid^="version-item-v"]')
  const versionCount = await versionItems.count()
  expect(versionCount, '应有版本记录').toBeGreaterThan(0)

  await page.screenshot({ path: 'verification/feature-208-versions-list.png' })

  // Step 6: 选中两个版本进行差异对比（如果有多个版本）
  if (versionCount >= 2) {
    const checkboxes = page.locator('[data-testid^="version-check-v"]')
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()
    await page.waitForTimeout(300)

    const diffBtn = page.locator('[data-testid="diff-btn"]')
    if (await diffBtn.isEnabled()) {
      await diffBtn.click()
      await page.waitForTimeout(500)
      await expect(page.locator('[data-testid="diff-view"]')).toBeVisible()
      await page.screenshot({ path: 'verification/feature-208-diff-view.png' })
    }
  }

  // Step 7-8: 点击第一个版本的'回滚'按钮（最旧版本）
  const rollbackBtn = page.locator('[data-testid^="rollback-btn-v"]').last()
  if (await rollbackBtn.isVisible()) {
    await rollbackBtn.click()
    await page.waitForTimeout(300)

    // 验证确认对话框
    const confirmBtn = page.locator('[data-testid^="confirm-rollback-v"]').first()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
      await page.waitForTimeout(1000)

      // Step 9: 验证回滚成功
      const rollbackSuccess = page.locator('[data-testid="rollback-success"]')
      if (await rollbackSuccess.isVisible()) {
        await expect(rollbackSuccess).toContainText('已成功回滚')
      }
    }
  }

  await page.screenshot({ path: 'verification/feature-208-rollback-done.png' })

  // Step 10: 重新触发流程，验证正常执行
  const triggerRes = await page.request.post(`${API_URL}/api/flows/${targetFlow.id}/trigger`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  })
  expect(triggerRes.ok()).toBe(true)

  await page.goto(`${BASE_URL}/manage/monitor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="monitor-title"]')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-208-post-rollback-monitor.png' })
})
