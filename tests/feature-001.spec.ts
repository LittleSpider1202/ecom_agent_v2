import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-01 我的看板：页面加载，显示待办、进行中任务和快捷入口', async ({ page }) => {
  // Step 1 & 2: 以执行者身份登录并导航到看板
  await loginAsExecutor(page)

  // Step 3: 验证页面标题显示'我的看板'
  await expect(page.locator('h1')).toContainText('我的看板')

  // Step 4: 验证存在'待办'任务区域
  await expect(page.getByTestId('pending-section')).toBeVisible()
  await expect(page.getByTestId('pending-section')).toContainText('待办')

  // Step 5: 验证存在'进行中'任务区域
  await expect(page.getByTestId('running-section')).toBeVisible()
  await expect(page.getByTestId('running-section')).toContainText('进行中')

  // Step 6: 验证存在快捷入口区域
  await expect(page.getByTestId('shortcuts')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-001.png', fullPage: true })
})
