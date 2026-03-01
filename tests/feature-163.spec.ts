import { test, expect } from '@playwright/test'

test('用户认证：登录会话在页面刷新后保持有效', async ({ page }) => {
  // Step 1: 成功登录系统
  await page.goto('/login')
  await page.fill('input[type="text"]', 'admin')
  await page.fill('input[type="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })

  // Step 2: 刷新页面
  await page.reload()

  // Step 3: 验证未跳转到登录页
  await expect(page).toHaveURL(/\/executor\/dashboard/)

  // Step 4: 验证用户信息仍然显示
  const displayName = page.getByTestId('user-display-name')
  await expect(displayName).toBeVisible()
  await expect(displayName).toContainText('管理员')

  // Step 5: 验证可以正常操作页面功能
  await expect(page.locator('header')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-163.png', fullPage: true })
})
