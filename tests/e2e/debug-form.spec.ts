import { test, expect } from '@playwright/test'

test('debug client form hydration', async ({ page }) => {
  // Capturar errores de consola
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', err => {
    consoleErrors.push(`Page error: ${err.message}`)
  })

  // Login
  const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
  const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[id="email"]', testEmail)
  await page.fill('input[id="password"]', testPassword)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/studio/, { timeout: 15000 })

  // Navegar a nuevo cliente
  await page.goto('/studio/clients/new')
  await page.waitForLoadState('networkidle')

  // Esperar más tiempo para hidratación
  await page.waitForTimeout(5000)

  // Ver el HTML actual
  const htmlContent = await page.content()
  const hasForm = htmlContent.includes('input') && htmlContent.includes('name')

  // Mostrar errores de consola
  console.log('Console errors:', consoleErrors)
  console.log('Has form:', hasForm)

  // Listar elementos visibles
  const inputs = await page.locator('input').count()
  const buttons = await page.locator('button').count()
  console.log('Inputs count:', inputs)
  console.log('Buttons count:', buttons)

  // Verificar si el form se renderizó
  expect(inputs).toBeGreaterThan(0)
})
