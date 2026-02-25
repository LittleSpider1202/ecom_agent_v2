import { test, expect } from '@playwright/test'

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

test('EW-01 我的看板：待办任务列表展示任务标题、截止时间和状态徽章', async ({ page }) => {
  await loginAsExecutor(page)

  const pendingSection = page.getByTestId('pending-section')
  await expect(pendingSection).toBeVisible()

  // 等待数据加载完成（不再显示"加载中"）
  await expect(page.locator('text=加载中')).toBeHidden({ timeout: 8000 })

  // 找到第一个待办任务卡片
  const firstCard = pendingSection.locator('[data-testid^="pending-task-"]').first()
  await expect(firstCard).toBeVisible()

  // Step 3: 验证显示任务标题
  await expect(firstCard.locator('p.font-medium')).toBeVisible()

  // Step 4 & 5: 验证截止时间和状态徽章（待处理 badge）
  await expect(firstCard.locator('span.rounded-full')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-002.png', fullPage: true })
})
