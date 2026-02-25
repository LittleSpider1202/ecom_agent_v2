import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-02 任务列表：页面加载并展示任务列表', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')

  // Step 2: 验证页面标题
  await expect(page.locator('h1')).toContainText('任务列表')

  // Step 3: 验证任务列表区域存在
  await expect(page.locator('table')).toBeVisible()

  // Step 4: 验证至少一个任务条目或空状态
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })
  const rows = page.locator('[data-testid^="task-row-"]')
  const emptyMsg = page.locator('text=暂无任务')
  const hasItems = await rows.count() > 0
  if (!hasItems) {
    await expect(emptyMsg).toBeVisible()
  } else {
    await expect(rows.first()).toBeVisible()
  }

  await page.screenshot({ path: 'verification/feature-006.png', fullPage: true })
})
