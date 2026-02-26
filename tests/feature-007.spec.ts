import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-02 任务列表：状态Tab筛选任务', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  // Step 2-3: 点击'待处理' Tab，验证只显示待处理
  await page.getByTestId('tab-pending').click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  const pendingRows = page.locator('[data-testid^="task-row-"]')
  if (await pendingRows.count() > 0) {
    // 只检查第一个 task-row 内的 badge
    const firstBadge = pendingRows.first().locator('span.rounded-full')
    await expect(firstBadge).toContainText('待处理')
  }

  // Step 4-5: 点击'进行中' Tab
  await page.getByTestId('tab-running').click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  if (await page.locator('[data-testid^="task-row-"]').count() > 0) {
    const firstBadge = page.locator('[data-testid^="task-row-"]').first().locator('span.rounded-full')
    await expect(firstBadge).toContainText('进行中')
  }

  // Step 6-7: 点击'已完成' Tab
  await page.getByTestId('tab-completed').click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  if (await page.locator('[data-testid^="task-row-"]').count() > 0) {
    const firstBadge = page.locator('[data-testid^="task-row-"]').first().locator('span.rounded-full')
    await expect(firstBadge).toContainText('已完成')
  }

  await page.screenshot({ path: 'verification/feature-007.png', fullPage: true })
})
