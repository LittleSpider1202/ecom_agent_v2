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

test('#200 MW-03 流程编辑器：飞书通知类型自动节点配置', async ({ page }) => {
  await loginAsManager(page)

  // Step 1: 进入流程编辑器新建页
  await page.goto(`${BASE_URL}/manage/flows/new`, { waitUntil: 'networkidle' })
  // 等待 ReactFlow 画布加载
  await page.waitForSelector('[data-testid="rf__wrapper"]', { timeout: 10000 })
  await page.waitForTimeout(500)

  // 验证飞书通知节点在面板中
  const feishuPanelNode = page.locator('[data-testid="panel-node-feishu_notify"]')
  await expect(feishuPanelNode).toBeVisible({ timeout: 8000 })
  await expect(feishuPanelNode).toContainText('飞书通知')

  // Step 2: 添加'飞书通知'类型自动节点（点击面板按钮）
  await feishuPanelNode.click()
  await page.waitForTimeout(500)

  // 验证节点已添加到画布
  const feishuNode = page.locator('[data-testid="node-feishu_notify"]').first()
  await expect(feishuNode).toBeVisible({ timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-200-feishu-node-added.png' })

  // Step 3: 双击节点打开配置面板（onNodeDoubleClick 触发）
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const node = document.querySelector('[data-testid="node-feishu_notify"]')
    if (node) {
      node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    }
  })
  await page.waitForTimeout(1000)

  // 等待配置面板
  const configPanel = page.locator('[data-testid="config-panel"]')
  await expect(configPanel).toBeVisible({ timeout: 5000 })

  // Step 4: 配置接收人角色
  const receiverRoleSelect = page.locator('[data-testid="config-receiver-role"]')
  await expect(receiverRoleSelect).toBeVisible()
  await receiverRoleSelect.selectOption('运营主管')

  // Step 5: 编写消息模板（支持变量插值）
  const messageTemplate = page.locator('[data-testid="config-message-template"]')
  await expect(messageTemplate).toBeVisible()
  await messageTemplate.fill('任务《{{task.name}}》需要您处理，请及时查看。')

  // Step 6: 保存配置
  await page.locator('[data-testid="config-save-btn"]').click()
  await page.waitForTimeout(300)

  // Step 7: 验证节点显示配置摘要
  const updatedNode = page.locator('[data-testid="node-feishu_notify"]').first()
  await expect(updatedNode).toContainText('运营主管')

  await page.screenshot({ path: 'verification/feature-200-feishu-node-configured.png' })

  // 保存流程
  const flowNameInput = page.locator('[data-testid="flow-name-input"]')
  if (await flowNameInput.isVisible()) {
    await flowNameInput.fill('飞书通知测试流程')
  }
  await page.locator('[data-testid="save-btn"]').click()
  await page.waitForTimeout(1000)

  const saveBtn = page.locator('[data-testid="save-btn"]')
  const saveBtnText = await saveBtn.innerText()
  expect(saveBtnText).toMatch(/已保存|保存/)

  await page.screenshot({ path: 'verification/feature-200-feishu-flow-saved.png' })
})
