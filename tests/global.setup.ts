import { chromium } from '@playwright/test'

// 预热：在所有测试开始前，先完成一次完整登录，让 DB 连接池就绪
async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  try {
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="text"]', 'executor')
    await page.fill('input[type="password"]', 'executor123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/executor\/dashboard/, { timeout: 20000 })
  } finally {
    await browser.close()
  }
}

export default globalSetup
