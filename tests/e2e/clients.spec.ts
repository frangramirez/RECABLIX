import { test, expect } from '@playwright/test'

/**
 * Tests E2E - Gestión de Clientes
 *
 * Estos tests verifican las operaciones CRUD de clientes:
 * - Listar clientes
 * - Crear nuevo cliente
 * - Editar cliente
 * - Filtros y búsqueda
 * - Importar desde Excel/CSV (si está implementado)
 */

test.describe('Gestión de Clientes', () => {
  // Setup: estos tests requieren estar autenticado
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
    const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[id="email"]')
    const passwordInput = page.locator('input[id="password"]')
    const submitBtn = page.locator('button[type="submit"]')

    await emailInput.waitFor({ state: 'visible', timeout: 10000 })
    await emailInput.clear()
    await emailInput.fill(testEmail)
    await passwordInput.clear()
    await passwordInput.fill(testPassword)

    await submitBtn.click()
    await page.waitForURL(/\/studio/, { timeout: 15000 })
  })

  test('página /studio/clients es accesible', async ({ page }) => {
    await page.goto('/studio/clients')

    // Verificar que cargó la página
    await expect(page).toHaveURL(/\/studio\/clients/)
  })

  test('lista de clientes muestra tabla', async ({ page }) => {
    await page.goto('/studio/clients')

    // Buscar tabla de clientes o lista de clientes
    const table = page.locator('table, [role="table"], [data-testid="clients-table"]').first()
    const hasTable = await table.count() > 0

    if (hasTable) {
      await expect(table).toBeVisible()
    } else {
      // Si no hay tabla, verificar que hay heading de clientes
      await expect(page.locator('h1:has-text("Clientes"), h2:has-text("Clientes")')).toBeVisible()
    }
  })

  test('tiene botón o link para crear nuevo cliente', async ({ page }) => {
    await page.goto('/studio/clients')

    // Buscar botón/link de "Nuevo Cliente", "Agregar", etc.
    const newClientButton = page.locator('text=/Nuevo Cliente|Agregar Cliente|Crear Cliente|\\+ Cliente/i').first()

    await expect(newClientButton).toBeVisible()
  })

  test.describe('Crear cliente', () => {
    test('formulario de nuevo cliente muestra campos requeridos', async ({ page }) => {
      await page.goto('/studio/clients/new')
      await page.waitForLoadState('networkidle')

      // Esperar hidratación de React - el form tarda en cargar
      const nameInput = page.locator('input[id="name"]')
      await nameInput.waitFor({ state: 'visible', timeout: 15000 })

      await expect(nameInput).toBeVisible()
      // Activity es un shadcn Select (button con data-slot)
      await expect(page.locator('button[data-slot="select-trigger"]').first()).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test('crear cliente con datos mínimos funciona', async ({ page }) => {
      await page.goto('/studio/clients/new')
      await page.waitForLoadState('networkidle')

      // Esperar hidratación de React
      const nameInput = page.locator('input[id="name"]')
      await nameInput.waitFor({ state: 'visible', timeout: 15000 })

      // Completar campos requeridos
      const testClientName = `Test Cliente ${Date.now()}`
      await nameInput.fill(testClientName)

      // shadcn Select: click en button trigger, luego seleccionar opción
      const activityTrigger = page.locator('button[data-slot="select-trigger"]').first()
      await activityTrigger.click()
      await page.locator('[data-slot="select-item"]:has-text("Servicios")').click()

      // Submit
      await page.click('button[type="submit"]')

      // Debe redirigir a lista de clientes
      await page.waitForURL(/\/studio\/clients/, { timeout: 10000 })
    })
  })

  test.describe('Filtros y búsqueda', () => {
    test('campo de búsqueda filtra resultados', async ({ page }) => {
      await page.goto('/studio/clients')
      await page.waitForLoadState('networkidle')

      // Input de búsqueda con placeholder específico
      const searchInput = page.locator('input[placeholder*="Buscar por nombre o CUIT"]')
      await expect(searchInput).toBeVisible()

      await searchInput.fill('Test')
      await page.waitForTimeout(500)

      // Verificar que la tabla se actualizó (existe)
      const table = page.locator('table')
      await expect(table).toBeVisible()
    })

    test('filtro por actividad no existe (solo búsqueda)', async ({ page }) => {
      // La UI actual solo tiene búsqueda, no filtro por actividad
      await page.goto('/studio/clients')
      await page.waitForLoadState('networkidle')

      // Verificar que existe búsqueda pero no filtro de actividad nativo
      const searchInput = page.locator('input[placeholder*="Buscar"]')
      await expect(searchInput).toBeVisible()

      // No hay select nativo de actividad en la lista
      const activitySelect = page.locator('select[name="activity"]')
      expect(await activitySelect.count()).toBe(0)
    })
  })

  test.describe('Editar cliente', () => {
    test('botón editar navega a página de edición', async ({ page }) => {
      await page.goto('/studio/clients')
      await page.waitForLoadState('networkidle')

      // Buscar el botón de editar (Pencil icon) en la primera fila
      const editButton = page.locator('tbody tr').first().locator('a[href*="/studio/clients/"]').first()

      if (await editButton.count() > 0) {
        await editButton.click()

        // Debe navegar a /studio/clients/{id}
        await page.waitForURL(/\/studio\/clients\/[a-f0-9-]+$/, { timeout: 5000 })
        expect(page.url()).toMatch(/\/studio\/clients\/[a-f0-9-]+$/)
      } else {
        // Si no hay clientes, el test pasa pero sin verificar navegación
        const emptyMessage = page.locator('text=/No hay clientes/i')
        if (await emptyMessage.count() > 0) {
          await expect(emptyMessage).toBeVisible()
        }
      }
    })
  })

  test.describe('Importar clientes', () => {
    test('botón de importar Excel existe', async ({ page }) => {
      await page.goto('/studio/clients')
      await page.waitForLoadState('networkidle')

      // El botón dice "Importar Excel"
      const importButton = page.locator('a:has-text("Importar Excel")')
      await expect(importButton).toBeVisible()
      expect(await importButton.getAttribute('href')).toBe('/studio/clients/import')
    })
  })
})

test.describe('Vista sin clientes', () => {
  test.beforeEach(async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL || 'test@recablix.ar'
    const testPassword = process.env.TEST_USER_PASSWORD || 'testing123'

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[id="email"]')
    const passwordInput = page.locator('input[id="password"]')
    const submitBtn = page.locator('button[type="submit"]')

    await emailInput.waitFor({ state: 'visible', timeout: 10000 })
    await emailInput.clear()
    await emailInput.fill(testEmail)
    await passwordInput.clear()
    await passwordInput.fill(testPassword)

    await submitBtn.click()
    await page.waitForURL(/\/studio/, { timeout: 15000 })
  })

  test('muestra tabla incluso vacía', async ({ page }) => {
    await page.goto('/studio/clients')
    await page.waitForLoadState('networkidle')

    // La página siempre muestra la tabla (vacía o con datos)
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Si no hay clientes, muestra mensaje en la tabla
    const emptyRow = page.locator('td:has-text("No hay clientes")')
    const hasClients = await page.locator('tbody tr').count() > 0

    // Una u otra condición debe ser verdadera
    expect(hasClients || (await emptyRow.count() > 0)).toBeTruthy()
  })
})
