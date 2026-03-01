import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const API_URL = 'http://localhost:8001'

test('debug knowledge detail', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    form: { username: 'executor', password: 'executor123' },
  })
  const data = await resp.json()
  console.log('Token:', data.access_token?.slice(0,20))
  
  await page.evaluate((token: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify({
      id: 1, username: 'executor', display_name: '李执行', role: 'executor',
    }))
  }, data.access_token)
  
  await page.goto(`${BASE_URL}/executor/knowledge/1`)
  await page.waitForTimeout(3000)
  
  const title = await page.locator('[data-testid="entry-title"]').count()
  console.log('Entry title count:', title)
  
  const loading = await page.locator('text=加载中').count()
  console.log('Loading count:', loading)
  
  const notFound = await page.locator('text=词条不存在').count()
  console.log('Not found count:', notFound)
  
  const html = await page.locator('main').innerHTML()
  console.log('Main HTML (first 500):', html.slice(0, 500))
})
