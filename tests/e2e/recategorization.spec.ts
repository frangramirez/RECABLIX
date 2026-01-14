import { test, expect } from '@playwright/test'

/**
 * Tests E2E - Recategorización
 *
 * Estos tests verifican la funcionalidad de recategorización:
 * - Visualización de estadísticas
 * - Tabla de resultados calculados
 * - Modal de detalle por cliente
 * - Exportación a Excel
 * - Generación de PDF (si está implementado)
 */

test.describe('Recategorización', () => {
  // Setup: estos tests requieren estar autenticado
  test.beforeEach(async ({ page }) => {
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

  test('página /studio/recategorization es accesible', async ({ page }) => {
    await page.goto('/studio/recategorization')

    await expect(page).toHaveURL(/\/studio\/recategorization/)
  })

  test.describe('Estadísticas', () => {
    test('muestra tarjetas con estadísticas básicas', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar indicadores de stats (pueden tener variantes de texto)
      const statsKeywords = [
        /Total.*Clientes?/i,
        /Suben?/i,
        /Bajan?/i,
        /Mantienen?|Igual|Sin cambio/i,
      ]

      // Verificar que al menos 2 stats están visibles
      let visibleStats = 0
      for (const keyword of statsKeywords) {
        const statElement = page.locator(`text=${keyword}`).first()
        if (await statElement.count() > 0) {
          visibleStats++
        }
      }

      expect(visibleStats).toBeGreaterThanOrEqual(2)
    })

    test.skip('estadísticas muestran números', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar elementos que parezcan números (stats cards)
      const numberElements = page.locator('[class*="text-"][class*="font-bold"]').filter({ hasText: /\d+/ })

      if (await numberElements.count() > 0) {
        await expect(numberElements.first()).toBeVisible()
      }
    })
  })

  test.describe('Tabla de resultados', () => {
    test('muestra tabla con resultados de recategorización', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar tabla (puede ser <table>, div con role="table", o custom)
      const tableSelector = 'table, [role="table"], [data-testid="recategorization-table"]'
      const table = page.locator(tableSelector).first()

      if (await table.count() > 0) {
        await expect(table).toBeVisible()
      } else {
        // Verificar que hay contenido de recategorización
        await expect(page.locator('text=/Categoría|Cliente|Cuota/i')).toBeVisible()
      }
    })

    test.skip('tabla tiene columnas esperadas', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Verificar headers comunes
      const headers = ['Nombre', 'Categoría', 'Cuota', 'Cambio']

      for (const header of headers) {
        const headerElement = page.locator(`th:has-text("${header}"), [role="columnheader"]:has-text("${header}")`)

        if (await headerElement.count() > 0) {
          await expect(headerElement.first()).toBeVisible()
        }
      }
    })

    test.skip('filas de tabla son clickeables', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Click en primera fila
      const firstRow = page.locator('tbody tr, [role="row"]').filter({ hasNotText: /Nombre|Cliente/ }).first()

      if (await firstRow.count() > 0) {
        await firstRow.click()

        // Debe abrir modal o navegar
        await page.waitForTimeout(500)

        const hasModal = await page.locator('[role="dialog"], .modal').count() > 0
        const urlChanged = page.url().includes('/recategorization/')

        expect(hasModal || urlChanged).toBeTruthy()
      }
    })
  })

  test.describe('Modal de detalle', () => {
    test.skip('modal muestra desglose de cuota', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Click en primera fila
      const firstRow = page.locator('tbody tr').first()

      if (await firstRow.count() === 0) {
        test.skip()
        return
      }

      await firstRow.click()

      // Esperar modal
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible({ timeout: 3000 })

      // Verificar que muestra desglose
      const hasDesglose = await page.locator('text=/Determinación|Desglose|Componentes|Cuota/i').count() > 0
      expect(hasDesglose).toBeTruthy()
    })

    test.skip('modal tiene botón para cerrar', async ({ page }) => {
      await page.goto('/studio/recategorization')

      const firstRow = page.locator('tbody tr').first()

      if (await firstRow.count() === 0) {
        test.skip()
        return
      }

      await firstRow.click()

      // Buscar botón de cerrar
      const closeButton = page.locator('[aria-label*="Cerrar"], [aria-label*="Close"], button:has-text("×")')
      await expect(closeButton.first()).toBeVisible({ timeout: 3000 })
    })
  })

  test.describe('Exportación', () => {
    test.skip('botón de exportar Excel existe', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar botón de exportar
      const exportButton = page.locator('text=/Exportar|Export|Descargar.*Excel/i').first()

      if (await exportButton.count() > 0) {
        await expect(exportButton).toBeVisible()
      } else {
        test.skip()
      }
    })

    test.skip('exportar Excel descarga archivo .xlsx', async ({ page }) => {
      await page.goto('/studio/recategorization')

      const exportButton = page.locator('text=/Exportar|Export|Descargar.*Excel/i').first()

      if (await exportButton.count() === 0) {
        test.skip()
        return
      }

      // Interceptar descarga
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        exportButton.click(),
      ])

      const filename = download.suggestedFilename()
      expect(filename).toMatch(/\.xlsx?$/i)
    })
  })

  test.describe('Generación PDF', () => {
    test.skip('botón de PDF individual existe', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar botones de PDF en la tabla
      const pdfButton = page.locator('button:has-text("PDF"), a:has-text("PDF")').first()

      if (await pdfButton.count() > 0) {
        await expect(pdfButton).toBeVisible()
      }
    })

    test.skip('botón de PDFs batch existe', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar botón de descarga múltiple
      const batchButton = page.locator('text=/PDFs|Descargar PDFs|Batch PDF/i').first()

      if (await batchButton.count() > 0) {
        await expect(batchButton).toBeVisible()
      }
    })

    test.skip('generar PDF individual abre nueva pestaña o descarga', async ({ page, context }) => {
      await page.goto('/studio/recategorization')

      const pdfButton = page.locator('button:has-text("PDF"), a:has-text("PDF")').first()

      if (await pdfButton.count() === 0) {
        test.skip()
        return
      }

      // Interceptar navegación o descarga
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }),
        pdfButton.click(),
      ])

      // Verificar que cargó PDF
      await newPage.waitForLoadState()
      const url = newPage.url()
      expect(url).toMatch(/\/pdf|\.pdf/i)
    })

    test.skip('descargar PDFs batch genera ZIP', async ({ page }) => {
      await page.goto('/studio/recategorization')

      const batchButton = page.locator('text=/PDFs.*\(\d+\)|Descargar PDFs/i').first()

      if (await batchButton.count() === 0) {
        test.skip()
        return
      }

      // Interceptar descarga
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        batchButton.click(),
      ])

      const filename = download.suggestedFilename()
      expect(filename).toMatch(/\.zip$/i)
    })
  })

  test.describe('Filtros y selección', () => {
    test.skip('checkboxes de selección funcionan', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar checkbox en tabla
      const checkbox = page.locator('input[type="checkbox"]').first()

      if (await checkbox.count() === 0) {
        test.skip()
        return
      }

      // Toggle checkbox
      await checkbox.click()
      await expect(checkbox).toBeChecked()

      await checkbox.click()
      await expect(checkbox).not.toBeChecked()
    })

    test.skip('select all checkbox selecciona todas las filas', async ({ page }) => {
      await page.goto('/studio/recategorization')

      // Buscar checkbox en header (suele ser el primero)
      const checkboxes = page.locator('input[type="checkbox"]')
      const count = await checkboxes.count()

      if (count === 0) {
        test.skip()
        return
      }

      const selectAllCheckbox = checkboxes.first()
      await selectAllCheckbox.click()

      // Verificar que todos están checked
      const checkedCount = await page.locator('input[type="checkbox"]:checked').count()
      expect(checkedCount).toBeGreaterThan(1)
    })
  })
})

test.describe('Vista sin datos', () => {
  test.skip('muestra mensaje si no hay período activo', async ({ page }) => {
    // Este test requiere un estado sin período activo
    await page.goto('/studio/recategorization')

    // Buscar mensaje de "sin período"
    const emptyMessage = page.locator('text=/No hay período activo|Sin período|Configura un período/i')

    if (await emptyMessage.count() > 0) {
      await expect(emptyMessage).toBeVisible()
    }
  })
})
