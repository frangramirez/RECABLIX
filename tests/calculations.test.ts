/**
 * Tests unitarios del Motor de Cálculo - RECABLIX
 *
 * Estos tests verifican la lógica de determinación de categoría
 * y cálculo de componentes sin necesidad de conexión a BD.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCategoryFromScales,
  calculateFeeComponentsFromData,
  calculateRecategorizationFromData,
  formatARS,
  compareCategories,
  type Scale,
  type FeeComponentData,
  type ClientData
} from '../src/lib/calculations'

// ════════════════════════════════════════════════════════════════
// DATOS DE PRUEBA - ESCALAS RECA 261 (valores reales enero 2026)
// ════════════════════════════════════════════════════════════════

const SCALES: Scale[] = [
  { category: 'A', max_annual_income: 10206600, max_local_m2: 30, max_annual_mw: 3330, max_annual_rent: 2373628 },
  { category: 'B', max_annual_income: 14953850, max_local_m2: 45, max_annual_mw: 5000, max_annual_rent: 2373628 },
  { category: 'C', max_annual_income: 20967040, max_local_m2: 60, max_annual_mw: 6700, max_annual_rent: 3243958 },
  { category: 'D', max_annual_income: 26030780, max_local_m2: 85, max_annual_mw: 10000, max_annual_rent: 3243958 },
  { category: 'E', max_annual_income: 30619800, max_local_m2: 110, max_annual_mw: 13000, max_annual_rent: 4114288 },
  { category: 'F', max_annual_income: 38373650, max_local_m2: 150, max_annual_mw: 16500, max_annual_rent: 4114288 },
  { category: 'G', max_annual_income: 45890130, max_local_m2: 200, max_annual_mw: 20000, max_annual_rent: 4905497 },
  { category: 'H', max_annual_income: 69626410, max_local_m2: 200, max_annual_mw: 20000, max_annual_rent: 7120883 },
  { category: 'I', max_annual_income: 77934110, max_local_m2: 200, max_annual_mw: 20000, max_annual_rent: 7120883 },
  { category: 'J', max_annual_income: 89248400, max_local_m2: 200, max_annual_mw: 20000, max_annual_rent: 7120883 },
  { category: 'K', max_annual_income: 107604500, max_local_m2: 200, max_annual_mw: 20000, max_annual_rent: 7120883 },
]

// ════════════════════════════════════════════════════════════════
// DATOS DE PRUEBA - COMPONENTES DE CUOTA
// ════════════════════════════════════════════════════════════════

const FEE_COMPONENTS: FeeComponentData[] = [
  // Componente Impositivo BIENES (B20)
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'A', value: 4747.251 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'B', value: 9019.788 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'C', value: 14241.764 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'D', value: 23578.036 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'E', value: 37661.559 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'F', value: 49054.972 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'G', value: 60764.858 },
  { component_code: 'B20', description: 'IMP-Bienes', component_type: 'IMP', category: 'H', value: 174066.018 },

  // Componente Impositivo SERVICIOS (S20)
  { component_code: 'S20', description: 'IMP-Servicios', component_type: 'IMP', category: 'A', value: 7596.402 },
  { component_code: 'S20', description: 'IMP-Servicios', component_type: 'IMP', category: 'B', value: 14431.658 },
  { component_code: 'S20', description: 'IMP-Servicios', component_type: 'IMP', category: 'C', value: 22786.841 },
  { component_code: 'S20', description: 'IMP-Servicios', component_type: 'IMP', category: 'D', value: 35673.656 },
  { component_code: 'S20', description: 'IMP-Servicios', component_type: 'IMP', category: 'H', value: 278505.646 },

  // Componente Jubilatorio NO jubilado (021)
  { component_code: '021', description: 'JUB-Aporta', component_type: 'JUB', category: 'A', value: 13663.17 },
  { component_code: '021', description: 'JUB-Aporta', component_type: 'JUB', category: 'B', value: 15029.48 },
  { component_code: '021', description: 'JUB-Aporta', component_type: 'JUB', category: 'C', value: 16804.54 },
  { component_code: '021', description: 'JUB-Aporta', component_type: 'JUB', category: 'D', value: 19398.11 },
  { component_code: '021', description: 'JUB-Aporta', component_type: 'JUB', category: 'H', value: 36845.97 },

  // Componente Jubilatorio JUBILADO (21J) - Siempre mínimo
  { component_code: '21J', description: 'JUB-Jubilado', component_type: 'JUB', category: 'A', value: 13663.17 },
  { component_code: '21J', description: 'JUB-Jubilado', component_type: 'JUB', category: 'B', value: 13663.17 },
  { component_code: '21J', description: 'JUB-Jubilado', component_type: 'JUB', category: 'C', value: 13663.17 },
  { component_code: '21J', description: 'JUB-Jubilado', component_type: 'JUB', category: 'D', value: 13663.17 },
  { component_code: '21J', description: 'JUB-Jubilado', component_type: 'JUB', category: 'H', value: 13663.17 },

  // Obra Social (024)
  { component_code: '024', description: 'Obra Social', component_type: 'OS', category: 'A', value: 31437.374 },
  { component_code: '024', description: 'Obra Social', component_type: 'OS', category: 'B', value: 31437.374 },
  { component_code: '024', description: 'Obra Social', component_type: 'OS', category: 'C', value: 31437.374 },
  { component_code: '024', description: 'Obra Social', component_type: 'OS', category: 'D', value: 31437.374 },
  { component_code: '024', description: 'Obra Social', component_type: 'OS', category: 'H', value: 31437.374 },

  // IIBB CABA (901)
  { component_code: '901', description: 'IIBB CABA', component_type: 'IBP', category: 'A', value: 0, province_code: '901', has_municipal: false },
  { component_code: '901', description: 'IIBB CABA', component_type: 'IBP', category: 'H', value: 0, province_code: '901', has_municipal: false },

  // IIBB Córdoba (904) con municipal
  { component_code: '904', description: 'IIBB Córdoba', component_type: 'IBP', category: 'A', value: 4500, province_code: '904', has_municipal: true },
  { component_code: '904', description: 'IIBB Córdoba', component_type: 'IBP', category: 'H', value: 12000, province_code: '904', has_municipal: true },
  { component_code: '904M', description: 'Municipal Córdoba', component_type: 'IBP', category: 'A', value: 1500 },
  { component_code: '904M', description: 'Municipal Córdoba', component_type: 'IBP', category: 'H', value: 4000 },
]

// ════════════════════════════════════════════════════════════════
// TESTS: DETERMINACIÓN DE CATEGORÍA
// ════════════════════════════════════════════════════════════════

describe('calculateCategoryFromScales', () => {
  it('retorna A para valores mínimos o cero', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 0,
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('A')
    expect(result.categoryByIncome).toBe('A')
  })

  it('retorna A para ingresos dentro del límite A', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 5000000, // < 10.206.600
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('A')
    expect(result.categoryByIncome).toBe('A')
  })

  it('retorna C para ingresos de 18M (entre B y C)', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 18000000, // > 14.953.850 (B) pero < 20.967.040 (C)
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.categoryByIncome).toBe('C')
    expect(result.finalCategory).toBe('C')
  })

  it('retorna K si excede todos los límites', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 200000000, // > 107.604.500 (K)
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('K')
  })

  it('retorna la máxima categoría entre todos los parámetros', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 5000000,  // A
      localM2: 65,            // D (> 60 de C)
      annualMW: null,
      annualRent: null,
    })
    expect(result.categoryByIncome).toBe('A')
    expect(result.categoryByM2).toBe('D')
    expect(result.finalCategory).toBe('D') // Máxima
  })

  // ─────────────────────────────────────────────────────────────
  // CASO REAL: Agustina Ollivier
  // ─────────────────────────────────────────────────────────────
  it('caso Agustina Ollivier: 18M ventas, 65m², 2500mw, 7M alquiler = H', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 18080000,   // Ventas → C
      localM2: 65,              // Superficie → D
      annualMW: 2500,           // Energía → A
      annualRent: 7000000,      // Alquileres → H (> 4.905.497 de G)
    })

    expect(result.categoryByIncome).toBe('C')
    expect(result.categoryByM2).toBe('D')
    expect(result.categoryByMW).toBe('A')
    expect(result.categoryByRent).toBe('H')
    expect(result.finalCategory).toBe('H') // Máxima = alquileres
  })

  it('los details contienen los valores correctos', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 18080000,
      localM2: 65,
      annualMW: 2500,
      annualRent: 7000000,
    })

    expect(result.details.income.value).toBe(18080000)
    expect(result.details.m2.value).toBe(65)
    expect(result.details.mw.value).toBe(2500)
    expect(result.details.rent.value).toBe(7000000)
    // Los límites corresponden a categoría H
    expect(result.details.income.limit).toBe(69626410)
  })
})

// ════════════════════════════════════════════════════════════════
// TESTS: COMPONENTES DE CUOTA
// ════════════════════════════════════════════════════════════════

describe('calculateFeeComponentsFromData', () => {
  it('calcula componentes básicos para categoría A, servicios, CABA', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'A',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 0,
    })

    expect(result.subtotals.impositivo).toBe(7596.402) // S20 cat A
    expect(result.subtotals.jubilatorio).toBe(13663.17) // 021 cat A
    expect(result.subtotals.obraSocial).toBe(31437.374) // 024 cat A
    expect(result.subtotals.provincial).toBe(0) // CABA sin IIBB
    expect(result.subtotals.municipal).toBe(0)
  })

  it('no cobra jubilatorio ni OS si trabaja en RD', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'A',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: true,  // ← Relación de dependencia
      isRetired: false,
      dependents: 0,
    })

    expect(result.subtotals.impositivo).toBe(7596.402) // Sí paga
    expect(result.subtotals.jubilatorio).toBe(0)       // No paga
    expect(result.subtotals.obraSocial).toBe(0)        // No paga

    // Verificar razones
    const jubComp = result.components.find(c => c.type === 'JUB')
    expect(jubComp?.applied).toBe(false)
    expect(jubComp?.reason).toContain('Relación de Dependencia')
  })

  it('cobra jubilatorio mínimo (21J) si es jubilado', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'D',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: true,  // ← Jubilado
      dependents: 0,
    })

    // Jubilado paga 21J (mínimo) en vez de 021
    expect(result.subtotals.jubilatorio).toBe(13663.17) // Mínimo cat A
    const jubComp = result.components.find(c => c.code === '21J')
    expect(jubComp?.applied).toBe(true)
  })

  it('multiplica OS por adherentes', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'A',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 2,  // ← 2 adherentes
    })

    // OS × (1 + 2) = 31437.374 × 3
    expect(result.subtotals.obraSocial).toBe(31437.374 * 3)
  })

  it('no cobra nada si es SOLO_LOC_2_INM', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'A',
      activity: 'SOLO_LOC_2_INM',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 0,
    })

    expect(result.subtotals.impositivo).toBe(0)
    expect(result.subtotals.jubilatorio).toBe(0)
    expect(result.subtotals.obraSocial).toBe(0)
  })

  it('cobra IIBB provincial y municipal para Córdoba', () => {
    const result = calculateFeeComponentsFromData(FEE_COMPONENTS, {
      category: 'H',
      activity: 'BIENES',
      provinceCode: '904',  // ← Córdoba
      worksInRD: false,
      isRetired: false,
      dependents: 0,
    })

    expect(result.subtotals.provincial).toBe(12000)  // 904 cat H
    expect(result.subtotals.municipal).toBe(4000)    // 904M cat H
  })
})

// ════════════════════════════════════════════════════════════════
// TESTS: RECATEGORIZACIÓN COMPLETA
// ════════════════════════════════════════════════════════════════

describe('calculateRecategorizationFromData', () => {
  it('calcula recategorización completa con comparación', () => {
    const client: ClientData = {
      id: 'test-1',
      name: 'Juan Pérez',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 1,
      localM2: null,
      annualRent: null,
      annualMW: null,
      periodSales: 8000000,
      previousCategory: 'A',
      previousFee: 50000,
    }

    const result = calculateRecategorizationFromData(SCALES, FEE_COMPONENTS, client)

    expect(result.client.name).toBe('Juan Pérez')
    expect(result.category.finalCategory).toBe('A')
    expect(result.comparison.categoryChange).toBe('SAME')
    expect(result.comparison.previousCategory).toBe('A')
    expect(result.totalFee).toBeGreaterThan(0)
    expect(result.comparison.feeChange).toBe(result.totalFee - 50000)
  })

  it('detecta subida de categoría', () => {
    const client: ClientData = {
      id: 'test-2',
      name: 'María García',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 0,
      localM2: null,
      annualRent: null,
      annualMW: null,
      periodSales: 25000000, // → D
      previousCategory: 'B',
      previousFee: 60000,
    }

    const result = calculateRecategorizationFromData(SCALES, FEE_COMPONENTS, client)

    expect(result.category.finalCategory).toBe('D')
    expect(result.comparison.categoryChange).toBe('UP')
  })

  it('detecta bajada de categoría', () => {
    const client: ClientData = {
      id: 'test-3',
      name: 'Carlos López',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 0,
      localM2: null,
      annualRent: null,
      annualMW: null,
      periodSales: 5000000, // → A
      previousCategory: 'C',
      previousFee: 80000,
    }

    const result = calculateRecategorizationFromData(SCALES, FEE_COMPONENTS, client)

    expect(result.category.finalCategory).toBe('A')
    expect(result.comparison.categoryChange).toBe('DOWN')
  })

  it('marca NEW si no tiene categoría anterior', () => {
    const client: ClientData = {
      id: 'test-4',
      name: 'Ana Nuevo',
      activity: 'SERVICIOS',
      provinceCode: '901',
      worksInRD: false,
      isRetired: false,
      dependents: 0,
      localM2: null,
      annualRent: null,
      annualMW: null,
      periodSales: 5000000,
      previousCategory: null,
      previousFee: null,
    }

    const result = calculateRecategorizationFromData(SCALES, FEE_COMPONENTS, client)

    expect(result.comparison.categoryChange).toBe('NEW')
    expect(result.comparison.feeChangePercent).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════
// TESTS: UTILIDADES
// ════════════════════════════════════════════════════════════════

describe('formatARS', () => {
  it('formatea números como pesos argentinos', () => {
    expect(formatARS(1234.56)).toMatch(/\$.*1.*234.*56/)
    expect(formatARS(1000000)).toMatch(/\$.*1.*000.*000/)
  })
})

describe('compareCategories', () => {
  it('retorna positivo si sube de categoría', () => {
    expect(compareCategories('A', 'C')).toBe(2)
    expect(compareCategories('B', 'H')).toBe(6)
  })

  it('retorna negativo si baja de categoría', () => {
    expect(compareCategories('D', 'A')).toBe(-3)
    expect(compareCategories('K', 'G')).toBe(-4)
  })

  it('retorna 0 si mantiene categoría', () => {
    expect(compareCategories('D', 'D')).toBe(0)
  })
})
