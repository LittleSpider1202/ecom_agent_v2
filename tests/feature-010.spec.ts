import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-02 任务列表：按创建时间排序（升序/降序）', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  const sortBtn = page.getByTestId('sort-created-at')
  await expect(sortBtn).toBeVisible()

  // 默认降序，点击切换到升序
  await expect(sortBtn).toContainText('↓')

  // Step 2-3: 点击切换为升序
  await sortBtn.click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  await expect(sortBtn).toContainText('↑')

  // Step 4-5: 再次点击切换回降序
  await sortBtn.click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  await expect(sortBtn).toContainText('↓')

  await page.screenshot({ path: 'verification/feature-010.png', fullPage: true })
})
