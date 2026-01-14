import { test, expect } from '@playwright/test'

test('debug login flow', async ({ page }) => {
  // Capturar logs de consola
  page.on('console', msg => {
    const type = msg.type()
    if (type === 'error' || type === 'warning') {
      console.log(`BROWSER ${type.toUpperCase()}:`, msg.text())
    } else {
      console.log('BROWSER LOG:', msg.text())
    }
  })

  // Capturar errores de página
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message)
    console.log('STACK:', err.stack)
  })

  // Capturar requests
  page.on('request', request => {
    if (request.url().includes('/api/auth/login')) {
      console.log('>>> REQUEST:', request.method(), request.url())
      console.log('>>> BODY:', request.postData())
    }
  })

  // Capturar responses
  page.on('response', async response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('<<< RESPONSE:', response.status())
      const allHeaders = response.headers()
      console.log('<<< ALL HEADERS:', Object.keys(allHeaders))
      console.log('<<< SET-COOKIE:', allHeaders['set-cookie'] || allHeaders['Set-Cookie'] || '(none)')
      try {
        const body = await response.text()
        console.log('<<< BODY:', body)
      } catch (e) {
        console.log('<<< BODY: (could not read)')
      }
    }
  })

  await page.goto('/login')

  // Esperar a que los inputs estén listos
  const emailInput = page.locator('input[id="email"]')
  const passwordInput = page.locator('input[id="password"]')
  const submitBtn = page.locator('button[type="submit"]')

  await emailInput.waitFor({ state: 'visible' })
  await emailInput.fill('test@recablix.ar')
  await passwordInput.fill('testing123')

  await submitBtn.click()

  // Esperar un poco para ver qué pasa
  await page.waitForTimeout(5000)

  console.log('CURRENT URL:', page.url())

  // Inspeccionar cookies
  const cookies = await page.context().cookies()
  console.log('COOKIES AFTER LOGIN:')
  cookies.forEach(cookie => {
    console.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}...`)
  })

  // Ver si hay algún error visible en la UI
  const errorVisible = await page.locator('[class*="destructive"]').count()
  if (errorVisible > 0) {
    const errorText = await page.locator('[class*="destructive"]').first().textContent()
    console.log('UI ERROR:', errorText)
  }

  // Tomar screenshot
  await page.screenshot({ path: 'test-results/login-debug.png', fullPage: true })
})
