import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-01 我的看板：点击快捷入口导航到对应页面', async ({ page }) => {
  await loginAsExecutor(page)

  // Step 2 & 3: 找到快捷入口并点击'任务列表'
  const tasksShortcut = page.getByTestId('shortcut-tasks')
  await expect(tasksShortcut).toBeVisible()
  await tasksShortcut.click()

  // Step 4: 验证跳转到任务列表页面
  await page.waitForURL(/\/executor\/tasks/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/executor\/tasks/)
  await expect(page.locator('h1')).toContainText('任务列表')

  await page.screenshot({ path: 'verification/feature-004.png', fullPage: true })
})
