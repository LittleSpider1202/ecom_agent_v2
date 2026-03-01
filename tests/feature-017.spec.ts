import { test, expect } from '@playwright/test'

// EW-04 人工操作步骤 — feature #17-25
// workers: 1, tests run sequentially
// Tests #21, #22, #23 each consume one pending human step (different tasks)

async function loginAsExecutor(page: any) {
  await page.goto('/login')
  await page.fill('input[type="text"]', 'executor')
  await page.fill('input[type="password"]', 'executor123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/executor\/dashboard/, { timeout: 10000 })
}

/** Click the first pending task that has a human step in the dashboard */
async function goToFirstHumanStepFromDashboard(page: any) {
  await page.goto('/executor/dashboard')
  const pendingSection = page.getByTestId('pending-section')
  // Tasks with has_human_step=true navigate to /task/:id/step/current
  const firstTask = pendingSection.locator('[data-testid^="pending-task-"]').first()
  await firstTask.click()
  await page.waitForURL(/\/task\/\d+\/step\//, { timeout: 8000 })
}

// ─── Feature #17 ──────────────────────────────────────────────────────────────
test('EW-04 #17: 从看板点击进入待处理人工步骤页面', async ({ page }) => {
  await loginAsExecutor(page)
  await page.goto('/executor/dashboard')

  // Step 2: 在待办区域找到人工步骤任务并点击
  const pendingSection = page.getByTestId('pending-section')
  const firstTask = pendingSection.locator('[data-testid^="pending-task-"]').first()
  await firstTask.click()

  // Step 4: 验证跳转到 /task/{taskId}/step/{stepId}
  await page.waitForURL(/\/task\/\d+\/step\//, { timeout: 8000 })
  expect(page.url()).toMatch(/\/task\/\d+\/step\//)

  // Step 5: 验证页面标题显示步骤名称
  const title = page.getByTestId('step-title')
  await expect(title).toBeVisible()
  await expect(title).not.toBeEmpty()

  // Step 6: 验证页面包含背景信息、AI建议和操作按钮
  await expect(page.getByTestId('background-section')).toBeVisible()
  await expect(page.getByTestId('ai-suggestion-section')).toBeVisible()
  await expect(page.getByTestId('action-buttons')).toBeVisible()

  await page.screenshot({ path: 'verification/feature-017.png', fullPage: true })
})

// ─── Feature #18 ──────────────────────────────────────────────────────────────
test('EW-04 #18: 显示机器已完成的背景信息摘要', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 2: 验证存在背景信息区域
  await expect(page.getByTestId('background-section')).toBeVisible()

  // Step 3 & 4: 验证背景信息显示摘要文本且非空
  const content = page.getByTestId('background-content')
  await expect(content).toBeVisible()
  const text = await content.textContent()
  expect(text).toBeTruthy()
  expect(text!.length).toBeGreaterThan(10)

  await page.screenshot({ path: 'verification/feature-018.png', fullPage: true })
})

// ─── Feature #19 ──────────────────────────────────────────────────────────────
test('EW-04 #19: 明确显示人需要执行什么操作的说明', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 2: 验证存在"需要您完成"操作说明区域
  const section = page.getByTestId('instructions-section')
  await expect(section).toBeVisible()
  await expect(section).toContainText('需要您完成')

  // Step 3 & 4: 验证操作说明文字清晰且非空
  const content = page.getByTestId('instructions-content')
  await expect(content).toBeVisible()
  const text = await content.textContent()
  expect(text).toBeTruthy()
  expect(text!.length).toBeGreaterThan(10)

  await page.screenshot({ path: 'verification/feature-019.png', fullPage: true })
})

// ─── Feature #20 ──────────────────────────────────────────────────────────────
test('EW-04 #20: 显示AI建议内容并可修改', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 2 & 3: 验证AI建议区域存在且内容非空
  await expect(page.getByTestId('ai-suggestion-section')).toBeVisible()
  const textarea = page.getByTestId('ai-suggestion-textarea')
  await expect(textarea).toBeVisible()
  const initialValue = await textarea.inputValue()
  expect(initialValue.length).toBeGreaterThan(0)

  // Step 4-6: 点击并修改内容，验证非只读
  await textarea.click()
  await textarea.fill(initialValue + '\n【已确认】')
  const newValue = await textarea.inputValue()
  expect(newValue).toContain('【已确认】')

  await page.screenshot({ path: 'verification/feature-020.png', fullPage: true })
})

// ─── Feature #21 ──────────────────────────────────────────────────────────────
test('EW-04 #21: 点击"全部采纳AI建议"完成提交完整流程', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 3-4: 阅读背景信息和AI建议
  await expect(page.getByTestId('background-content')).toBeVisible()
  await expect(page.getByTestId('ai-suggestion-textarea')).toBeVisible()

  // Step 5: 注意不可撤回警告
  await expect(page.getByTestId('warning-banner')).toContainText('不可撤回')

  // Step 6: 点击"全部采纳AI建议"
  await page.getByTestId('accept-ai-button').click()

  // Step 7: 验证弹出确认对话框
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()

  // Step 8: 点击确认按钮
  await page.getByTestId('confirm-submit-button').click()

  // Step 9: 验证提交成功提示
  await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('success-message')).toContainText('提交成功')

  // Step 10: 验证跳转回任务列表
  await page.waitForURL(/\/executor\/tasks/, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-021.png', fullPage: true })
})

// ─── Feature #22 ──────────────────────────────────────────────────────────────
test('EW-04 #22: 修改AI建议后提交完整流程', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 3: 查看AI建议内容
  const textarea = page.getByTestId('ai-suggestion-textarea')
  await expect(textarea).toBeVisible()
  const original = await textarea.inputValue()
  expect(original.length).toBeGreaterThan(0)

  // Step 4-5: 修改AI建议内容
  const modified = original + '\n\n【人工补充】已确认价格区间合理，同意执行。'
  await textarea.fill(modified)
  expect(await textarea.inputValue()).toContain('【人工补充】')

  // Step 6: 点击"修改后提交"
  await page.getByTestId('modify-submit-button').click()

  // Step 7: 验证弹出确认对话框，显示修改后的内容
  await expect(page.getByTestId('confirm-dialog')).toBeVisible()
  await expect(page.getByTestId('confirm-dialog')).toContainText('修改后的内容')

  // Step 8: 点击确认提交
  await page.getByTestId('confirm-submit-button').click()

  // Step 9: 验证提交成功消息
  await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('success-message')).toContainText('提交成功')

  // Step 10: 验证页面跳转
  await page.waitForURL(/\/executor\/tasks/, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-022.png', fullPage: true })
})

// ─── Feature #23 ──────────────────────────────────────────────────────────────
test('EW-04 #23: 驳回操作并填写驳回原因完整流程', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 3: 点击"驳回"按钮
  await page.getByTestId('reject-button').click()

  // Step 4: 验证弹出驳回原因输入对话框
  await expect(page.getByTestId('reject-dialog')).toBeVisible()

  // Step 5: 输入驳回原因
  await page.getByTestId('reject-reason-input').fill('价格策略需重新评估，当前建议与市场实际不符，请管理员复核后重新生成AI建议。')

  // Step 6: 点击确认驳回
  await page.getByTestId('confirm-reject-button').click()

  // Step 7: 验证驳回成功消息
  await expect(page.getByTestId('success-message')).toBeVisible({ timeout: 8000 })
  await expect(page.getByTestId('success-message')).toContainText('驳回')

  // Step 8: 验证页面跳转（任务列表中该步骤不再是待处理状态）
  await page.waitForURL(/\/executor\/tasks/, { timeout: 5000 })

  await page.screenshot({ path: 'verification/feature-023.png', fullPage: true })
})

// ─── Feature #24 ──────────────────────────────────────────────────────────────
test('EW-04 #24: 页面明显显示"提交后不可撤回"警告', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 2: 验证存在警告文字
  const warning = page.getByTestId('warning-banner')
  await expect(warning).toBeVisible()
  const text = await warning.textContent()
  expect(text).toMatch(/不可撤回/)

  // Step 3: 验证警告视觉上突出（红色背景/边框）
  // Check that the warning element has red styling classes
  const classes = await warning.getAttribute('class')
  expect(classes).toMatch(/red/)

  await page.screenshot({ path: 'verification/feature-024.png', fullPage: true })
})

// ─── Feature #25 ──────────────────────────────────────────────────────────────
test('EW-04 #25: 提交表单为空时显示验证错误', async ({ page }) => {
  await loginAsExecutor(page)
  await goToFirstHumanStepFromDashboard(page)

  // Step 2: 清空AI建议文本框
  const textarea = page.getByTestId('ai-suggestion-textarea')
  await textarea.fill('')

  // Step 3: 点击"修改后提交"
  await page.getByTestId('modify-submit-button').click()

  // Step 4: 验证显示表单验证错误提示
  await expect(page.getByTestId('suggestion-error')).toBeVisible()
  await expect(page.getByTestId('suggestion-error')).toContainText('不能为空')

  // Step 5: 验证不跳转页面，停留在当前步骤页
  expect(page.url()).toMatch(/\/task\/\d+\/step\//)
  await expect(page.getByTestId('confirm-dialog')).not.toBeVisible()

  await page.screenshot({ path: 'verification/feature-025.png', fullPage: true })
})
