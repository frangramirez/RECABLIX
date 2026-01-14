import { test, expect } from '@playwright/test'

/**
 * Tests E2E - Autenticación
 *
 * Estos tests verifican el flujo de autenticación:
 * - Redirección a login si no autenticado
 * - Login exitoso
 * - Logout
 * - Protección de rutas admin
 */

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

    test.skip('login exitoso redirige a /studio', async ({ page }) => {
      const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com'
      const testPassword = process.env.TEST_USER_PASSWORD || 'password123'

      await page.goto('/login')

      // Completar formulario
      await page.fill('input[id="email"]', testEmail)
      await page.fill('input[id="password"]', testPassword)
      await page.click('button[type="submit"]')

      // Debe redirigir a studio después del login
      await expect(page).toHaveURL(/\/studio/)

      // Verificar que muestra contenido autenticado
      await expect(page.locator('text=/Clientes|Dashboard|Recategorización/i')).toBeVisible()
    })

    test.skip('logout redirige a /login', async ({ page }) => {
      // Primero hacer login (requiere usuario de prueba)
      const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com'
      const testPassword = process.env.TEST_USER_PASSWORD || 'password123'

      await page.goto('/login')
      await page.fill('input[id="email"]', testEmail)
      await page.fill('input[id="password"]', testPassword)
      await page.click('button[type="submit"]')

      // Esperar a estar autenticado
      await page.waitForURL(/\/studio/)

      // Hacer logout (buscar botón de logout)
      await page.click('text=/Cerrar sesión|Logout|Salir/i')

      // Debe redirigir a login
      await expect(page).toHaveURL(/\/login/)
    })

    test.skip('usuario normal no puede acceder a /admin', async ({ page }) => {
      // Login como usuario normal (no superadmin)
      const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com'
      const testPassword = process.env.TEST_USER_PASSWORD || 'password123'

      await page.goto('/login')
      await page.fill('input[id="email"]', testEmail)
      await page.fill('input[id="password"]', testPassword)
      await page.click('button[type="submit"]')

      await page.waitForURL(/\/studio/)

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
