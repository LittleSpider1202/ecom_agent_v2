import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://192.168.0.112:8002'

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'manager', password: 'manager123' },
  })
  const { access_token, user } = await res.json()
  await page.evaluate(({ token, u }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { token: access_token, u: user })
}

test('#195 响应式布局：1920px宽度下页面合理利用宽屏空间', async ({ page }) => {
  // 设置 1920px 宽屏
  await page.setViewportSize({ width: 1920, height: 1080 })
  await loginAsManager(page)

  const pages = [
    { url: `${BASE_URL}/manage/dashboard`, name: '决策驾驶舱' },
    { url: `${BASE_URL}/manage/monitor`, name: '任务监控' },
    { url: `${BASE_URL}/manage/flows`, name: '流程列表' },
  ]

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // 验证无横向溢出
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth <= document.body.clientWidth + 5
    })
    expect(overflow, `${p.name} 有横向溢出`).toBe(true)

    // 验证主内容区宽度合理（不是极窄）
    const mainWidth = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? main.getBoundingClientRect().width : 0
    })
    expect(mainWidth, `${p.name} 主内容区过窄`).toBeGreaterThan(800)

    await page.screenshot({ path: `verification/feature-195-${p.name}-1920px.png` })
  }

  // 验证流程编辑器画布充分利用空间
  await page.goto(`${BASE_URL}/manage/flows`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // 点击第一个流程进入编辑器（或直接导航到 /manage/flows/1/edit）
  const flowLink = page.locator('table tbody tr').first().locator('a, [data-testid^="flow-name-"]').first()
  const hasFlow = await flowLink.count() > 0

  if (hasFlow) {
    await flowLink.click()
    await page.waitForTimeout(1000)
    // 验证流程编辑器画布存在
    const canvasExists = await page.locator('[data-testid="rf__wrapper"], .react-flow__renderer').count() > 0
    expect(canvasExists).toBe(true)

    const canvasWidth = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="rf__wrapper"]') ||
                 document.querySelector('.react-flow__renderer') ||
                 document.querySelector('.react-flow')
      return el ? el.getBoundingClientRect().width : 0
    })
    expect(canvasWidth, '流程编辑器画布宽度').toBeGreaterThan(1000)
    await page.screenshot({ path: 'verification/feature-195-flow-editor-1920px.png' })
  } else {
    // 直接访问编辑器
    await page.goto(`${BASE_URL}/manage/flows/1/edit`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const canvasExists = await page.locator('[data-testid="rf__wrapper"]').count() > 0
    if (canvasExists) {
      const canvasWidth = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="rf__wrapper"]')
        return el ? el.getBoundingClientRect().width : 0
      })
      expect(canvasWidth).toBeGreaterThan(1000)
    }
    await page.screenshot({ path: 'verification/feature-195-flow-editor-1920px.png' })
  }
})
