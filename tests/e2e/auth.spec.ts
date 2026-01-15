import { test, expect, type Page } from '@playwright/test'

/**
 * Tests E2E - Autenticación
 *
 * Estos tests verifican el flujo de autenticación:
 * - Redirección a login si no autenticado
 * - Login exitoso
 * - Logout
 * - Protección de rutas admin
 */

// Helper para hacer login
async function doLogin(page: Page, email: string, password: string) {
  await page.goto('/login')

  // Esperar a que la página esté completamente cargada
  await page.waitForLoadState('networkidle')

  const emailInput = page.locator('input[id="email"]')
  const passwordInput = page.locator('input[id="password"]')
  const submitBtn = page.locator('button[type="submit"]')

  // Esperar a que los inputs estén visibles y habilitados
  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await expect(emailInput).toBeEnabled()

  // Limpiar y llenar campos
  await emailInput.clear()
  await emailInput.fill(email)

  await passwordInput.clear()
  await passwordInput.fill(password)

  // Verificar que se llenaron correctamente antes de hacer submit
  await expect(emailInput).toHaveValue(email)
  await expect(passwordInput).toHaveValue(password)

  await submitBtn.click()
}

test.describe('Autenticación', () => {
  test('redirige a /login si no autenticado al acceder /studio', async ({ page }) => {
    await page.goto('/studio')

    // Debe redirigir a login
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirige a /login si no autenticado al acceder /admin', async ({ page }) => {
    await page.goto('/admin')

    // Debe redirigir a login
    await expect(page).toHaveURL(/\/login/)
  })

  test('página de login muestra formulario', async ({ page }) => {
    await page.goto('/login')

    // Verificar elementos del formulario (usan id, no name)
    await expect(page.locator('input[id="email"]')).toBeVisible()
    await expect(page.locator('input[id="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test.describe('Con credenciales', () => {
    // Estos tests requieren configuración de usuario de prueba en Supabase
    // Para CI/CD, usar variables de entorno TEST_USER_EMAIL y TEST_USER_PASSWORD

    test('login exitoso redirige a /studio', async ({ page }) => {
      // Credenciales por defecto si env vars no están disponibles
      const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
      const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

      await doLogin(page, testEmail, testPassword)
      await page.waitForURL(/\/studio/, { timeout: 15000 })

      // Verificar que muestra contenido autenticado (usar heading más específico)
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 })
    })

    test('logout redirige a /login', async ({ page }) => {
      const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
      const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

      await doLogin(page, testEmail, testPassword)
      await page.waitForURL(/\/studio/, { timeout: 15000 })

      // Esperar a que la página esté estable
      await page.waitForLoadState('networkidle')

      // Abrir menú de usuario - buscar el botón trigger del dropdown en el header
      const userMenuBtn = page.locator('[data-slot="dropdown-menu-trigger"]').first()
      await userMenuBtn.waitFor({ state: 'visible', timeout: 5000 })
      await userMenuBtn.click()

      // Esperar a que el dropdown content aparezca (Radix usa portales)
      const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]')
      await dropdownContent.waitFor({ state: 'visible', timeout: 5000 })

      // Buscar la opción "Cerrar Sesión" dentro del dropdown
      const logoutOption = dropdownContent.locator('[data-slot="dropdown-menu-item"]:has-text("Cerrar Sesión")')
      await logoutOption.waitFor({ state: 'visible', timeout: 3000 })
      await logoutOption.click()

      // Debe redirigir a login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })

    test('usuario normal no puede acceder a /admin', async ({ page }) => {
      const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
      const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

      await doLogin(page, testEmail, testPassword)
      await page.waitForURL(/\/studio/, { timeout: 15000 })

      // Intentar acceder a admin
      await page.goto('/admin')

      // Debe redirigir a studio o mostrar error
      await expect(page).toHaveURL(/\/studio/)
    })
  })
})

test.describe('Rutas públicas', () => {
  test('página raíz (/) es accesible sin autenticación', async ({ page }) => {
    await page.goto('/')

    // No debe redirigir a login
    await expect(page).toHaveURL('/')
  })

  test('página de login es accesible sin autenticación', async ({ page }) => {
    await page.goto('/login')

    await expect(page).toHaveURL('/login')
    await expect(page.locator('input[id="email"]')).toBeVisible()
  })
})
