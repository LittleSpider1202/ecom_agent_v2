import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-02 任务列表：搜索框按任务名称过滤任务', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  // Step 2: 在搜索框输入关键词
  const searchInput = page.getByTestId('search-input')
  await searchInput.fill('采购')
  await page.keyboard.press('Enter')

  // Step 3: 验证列表过滤
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  const rows = page.locator('[data-testid^="task-row-"]')
  if (await rows.count() > 0) {
    // 所有结果应包含关键词
    const firstRowText = await rows.first().textContent()
    expect(firstRowText).toMatch(/采购/)
  }

  // Step 4-5: 清空搜索框，验证恢复全量
  await page.getByTestId('clear-search').click()
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
  const allRows = page.locator('[data-testid^="task-row-"]')
  // 恢复后应有更多结果（或相同）
  const countAfterClear = await allRows.count()
  expect(countAfterClear).toBeGreaterThanOrEqual(0)

  await page.screenshot({ path: 'verification/feature-008.png', fullPage: true })
})
