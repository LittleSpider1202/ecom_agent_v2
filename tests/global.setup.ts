import { chromium } from '@playwright/test'

const API_URL = 'http://192.168.0.112:8002'

// 预热：程序式登录，让 DB 连接池就绪
async function globalSetup() {
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
