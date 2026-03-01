import { chromium, request } from '@playwright/test'

const API_URL = 'http://192.168.0.112:8002'

// 每次全量回归前重置 DB，确保干净状态
async function globalSetup() {
  // Step 1: 重置数据库（截断所有表并重新 seed）
  const apiCtx = await request.newContext()
  const resetRes = await apiCtx.post(`${API_URL}/api/dev/reset-db`)
  if (!resetRes.ok()) {
    throw new Error(`DB reset failed: ${resetRes.status()} ${await resetRes.text()}`)
  }
  await apiCtx.dispose()

  // Step 2: 预热登录，让连接池就绪
  const browser = await chromium.launch({
    args: ['--proxy-bypass-list=localhost,127.0.0.1'],
  })
  const page = await browser.newPage()
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
    const res = await page.request.post(`${API_URL}/api/auth/login`, {
      form: { username: 'executor', password: 'executor123' },
    })
    const { access_token, user } = await res.json()
    await page.evaluate(({ token, u }) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(u))
    }, { token: access_token, u: user })
    await page.goto('http://localhost:3000/executor/dashboard', { waitUntil: 'networkidle' })
  } finally {
    await browser.close()
  }
}

export default globalSetup
