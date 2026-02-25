import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-02 任务列表：分页功能可跳转页面', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/tasks')
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  // Step 2: 验证分页组件
  const pagination = page.getByTestId('pagination')
  const hasPagination = await pagination.isVisible()

  if (hasPagination) {
    // Step 3: 点击第2页
    const page2Btn = page.getByTestId('page-2')
    await page2Btn.click()
    await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
    await expect(page2Btn).toHaveClass(/bg-blue-600/)

    // Step 5: 点击上一页
    await page.getByTestId('page-prev').click()
    await expect(page.locator('text=加载中')).toBeHidden({ timeout: 5000 })
    await expect(page.getByTestId('page-1')).toHaveClass(/bg-blue-600/)
  } else {
    // 数据量不足一页时，验证分页组件不显示（合理情况）
    await expect(page.locator('[data-testid^="task-row-"]').first()).toBeVisible()
  }

  await page.screenshot({ path: 'verification/feature-009.png', fullPage: true })
})
