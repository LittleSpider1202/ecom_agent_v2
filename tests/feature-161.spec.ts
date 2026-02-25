import { test, expect } from '@playwright/test'

test('用户认证：使用正确账号密码登录成功', async ({ page }) => {
  // Step 1: 导航到登录页
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login/)

  // Step 2 & 3: 输入正确用户名和密码
  await page.fill('input[type="text"]', 'admin')
  await page.fill('input[type="password"]', 'admin123')

  // Step 4: 点击登录按钮
  await page.click('button[type="submit"]')

  // Step 5: 验证跳转到工作台首页
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
  await expect(page).toHaveURL(/\/executor\/dashboard/)

  // Step 6: 验证顶部显示用户名
  const displayName = page.getByTestId('user-display-name')
  await expect(displayName).toBeVisible()
  await expect(displayName).toContainText('管理员')

  // Screenshot evidence
  await page.screenshot({ path: 'verification/feature-161.png', fullPage: true })
})
