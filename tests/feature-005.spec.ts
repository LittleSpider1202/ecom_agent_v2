import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-01 我的看板：任务数量角标显示正确数字', async ({ page }) => {
  await loginAsExecutor(page)
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  // Step 2: 记录角标数字
  const badge = page.getByTestId('pending-count')
  await expect(badge).toBeVisible()
  const countText = await badge.textContent()
  const count = parseInt(countText ?? '0', 10)

  // Step 3: 验证数量与实际条目数一致
  const cards = page.getByTestId('pending-section').locator('[data-testid^="pending-task-"]')
  const cardCount = await cards.count()

  expect(count).toBe(cardCount)

  await page.screenshot({ path: 'verification/feature-005.png', fullPage: true })
})
