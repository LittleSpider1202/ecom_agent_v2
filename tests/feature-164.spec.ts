import { test, expect } from '@playwright/test'

test('用户认证：点击退出登录清除会话并跳转登录页', async ({ page }) => {
  // Step 1: 以登录状态访问任意页面
  await page.goto('/login')
  await page.fill('input[type="text"]', 'admin')
  await page.fill('input[type="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })

  // Step 2: 点击右上角用户头像
  const avatar = page.getByTestId('user-avatar')
  await expect(avatar).toBeVisible()
  await avatar.hover()

  // Step 3: 点击'退出登录'
  const logoutBtn = page.getByTestId('logout-button')
  await expect(logoutBtn).toBeVisible()
  await logoutBtn.click()

  // Step 4: 验证跳转到登录页
  await page.waitForURL(/\/login/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/login/)

  // Step 5 & 6: 手动导航到工作台URL，验证重定向回登录页
  await page.goto('/executor/dashboard')
  await page.waitForURL(/\/login/, { timeout: 5000 })
  await expect(page).toHaveURL(/\/login/)

  await page.screenshot({ path: 'verification/feature-164.png', fullPage: true })
})
