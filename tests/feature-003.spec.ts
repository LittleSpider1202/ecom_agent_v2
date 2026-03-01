import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-01 我的看板：进行中任务区域展示当前执行任务', async ({ page }) => {
  await loginAsExecutor(page)

  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  const runningSection = page.getByTestId('running-section')
  await expect(runningSection).toBeVisible()

  // Step 3: 验证显示进行中任务列表
  const runningCard = runningSection.locator('[data-testid^="running-task-"]').first()
  await expect(runningCard).toBeVisible()

  // Step 4: 验证显示流程名称和当前步骤
  await expect(runningCard.locator('p.font-medium')).toBeVisible()
  // 当前步骤显示（蓝色文字）
  await expect(runningCard.locator('.text-blue-500')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-003.png', fullPage: true })
})
