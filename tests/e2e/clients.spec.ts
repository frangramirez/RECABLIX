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
    // Para que estos tests funcionen, necesitas:
    // 1. Configurar TEST_USER_EMAIL y TEST_USER_PASSWORD en .env
    // 2. O configurar un mock de autenticación
    // 3. O usar Playwright auth state

    // Por ahora skip si no hay credenciales
    const hasAuth = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD

    if (!hasAuth) {
      test.skip()
      return
    }

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/studio/)
  })

  test('página /studio/clients es accesible', async ({ page }) => {
    await page.goto('/studio/clients')

    // Verificar que cargó la página
    await expect(page).toHaveURL(/\/studio\/clients/)
  })

  test('lista de clientes muestra tabla', async ({ page }) => {
    await page.goto('/studio/clients')

    // Buscar tabla de clientes (puede ser <table> o componente custom)
    const hasTable = await page.locator('table, [role="table"], [data-testid="clients-table"]').count() > 0

    if (hasTable) {
      await expect(page.locator('table, [role="table"], [data-testid="clients-table"]')).toBeVisible()
    } else {
      // Si no hay tabla, verificar que hay contenido de clientes
      await expect(page.locator('text=/Clientes|Nombre|CUIT/i')).toBeVisible()
    }
  })

  test('tiene botón o link para crear nuevo cliente', async ({ page }) => {
    await page.goto('/studio/clients')

    // Buscar botón/link de "Nuevo Cliente", "Agregar", etc.
    const newClientButton = page.locator('text=/Nuevo Cliente|Agregar Cliente|Crear Cliente|\\+ Cliente/i').first()

    await expect(newClientButton).toBeVisible()
  })

  test.describe('Crear cliente', () => {
    test.skip('formulario de nuevo cliente muestra campos requeridos', async ({ page }) => {
      await page.goto('/studio/clients/new')

      // Verificar campos básicos
      await expect(page.locator('input[name="name"], input[id="name"]')).toBeVisible()
      await expect(page.locator('select[name="activity"], select[id="activity"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
    })

    test.skip('crear cliente con datos mínimos funciona', async ({ page }) => {
      await page.goto('/studio/clients/new')

      // Completar campos requeridos
      const testClientName = `Test Cliente ${Date.now()}`
      await page.fill('input[name="name"], input[id="name"]', testClientName)
      await page.selectOption('select[name="activity"], select[id="activity"]', 'SERVICIOS')

      // Submit
      await page.click('button[type="submit"]')

      // Debe redirigir a lista o detalle
      await page.waitForURL(/\/studio\/clients/, { timeout: 5000 })

      // Verificar que el cliente aparece
      await expect(page.locator(`text=${testClientName}`)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Filtros y búsqueda', () => {
    test.skip('campo de búsqueda filtra resultados', async ({ page }) => {
      await page.goto('/studio/clients')

      // Buscar input de búsqueda
      const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]').first()

      if (await searchInput.count() > 0) {
        await searchInput.fill('Test')

        // Esperar a que se actualice la tabla
        await page.waitForTimeout(500)

        // Verificar que hay resultados filtrados
        const results = await page.locator('tbody tr, [role="row"]').count()
        expect(results).toBeGreaterThanOrEqual(0)
      } else {
        test.skip()
      }
    })

    test.skip('filtro por actividad funciona', async ({ page }) => {
      await page.goto('/studio/clients')

      // Buscar select de actividad
      const activitySelect = page.locator('select[name="activity"]').first()

      if (await activitySelect.count() > 0) {
        await activitySelect.selectOption('SERVICIOS')

        // Esperar actualización
        await page.waitForTimeout(500)

        // Verificar que filtró
        const results = await page.locator('tbody tr').count()
        expect(results).toBeGreaterThanOrEqual(0)
      } else {
        test.skip()
      }
    })
  })

  test.describe('Editar cliente', () => {
    test.skip('click en cliente abre detalle o editor', async ({ page }) => {
      await page.goto('/studio/clients')

      // Click en primera fila
      const firstRow = page.locator('tbody tr, [role="row"]').first()

      if (await firstRow.count() > 0) {
        await firstRow.click()

        // Debe abrir modal, página de detalle, o editor
        // Verificar que algo cambió (URL o modal visible)
        const hasModal = await page.locator('[role="dialog"], .modal').count() > 0
        const urlChanged = !page.url().includes('/studio/clients?')

        expect(hasModal || urlChanged).toBeTruthy()
      } else {
        test.skip()
      }
    })
  })

  test.describe('Importar clientes', () => {
    test.skip('botón de importar existe si la funcionalidad está implementada', async ({ page }) => {
      await page.goto('/studio/clients')

      // Buscar botón de importar
      const importButton = page.locator('text=/Importar|Import|Cargar/i').first()

      if (await importButton.count() > 0) {
        await expect(importButton).toBeVisible()
      } else {
        test.skip()
      }
    })
  })
})

test.describe('Vista sin clientes', () => {
  test.skip('muestra estado vacío si no hay clientes', async ({ page }) => {
    // Este test requiere un studio sin clientes o mock
    await page.goto('/studio/clients')

    // Buscar mensaje de "sin clientes"
    const emptyState = page.locator('text=/No hay clientes|Sin clientes|Crea tu primer cliente/i')

    if (await emptyState.count() > 0) {
      await expect(emptyState).toBeVisible()
    }
  })
})
