import { test, expect } from '@playwright/test'

test('用户认证：密码错误时显示错误提示', async ({ page }) => {
  // Step 1: 导航到登录页
  await page.goto('/login')

  // Step 2 & 3: 输入正确用户名，错误密码
  await page.fill('input[type="text"]', 'admin')
  await page.fill('input[type="password"]', 'wrongpassword')

  // Step 4: 点击登录
  await page.click('button[type="submit"]')

  // Step 5: 验证显示错误消息
  const errorMsg = page.locator('.bg-red-50')
  await expect(errorMsg).toBeVisible({ timeout: 5000 })
  await expect(errorMsg).toContainText('用户名或密码错误')

  // Step 6: 验证停留在登录页
  await expect(page).toHaveURL(/\/login/)

  await page.screenshot({ path: 'verification/feature-162.png', fullPage: true })
})
