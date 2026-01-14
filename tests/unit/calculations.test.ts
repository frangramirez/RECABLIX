import { describe, it, expect } from 'vitest'
import { calculateCategoryFromScales } from '../../src/lib/calculations/category'

const SCALES = [
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

describe('calculateCategoryFromScales', () => {
  it('retorna A para ingresos minimos', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 5000000,
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('A')
  })

  it('retorna categoria maxima entre parametros', () => {
    // Ingresos: A, M2: D (65 > 60)
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 5000000,
      localM2: 65,
      annualMW: null,
      annualRent: null,
    })
    expect(result.categoryByIncome).toBe('A')
    expect(result.categoryByM2).toBe('D')
    expect(result.finalCategory).toBe('D')
  })

  it('caso Agustina Ollivier: 18M ventas, 65m2, 7M alquiler = H', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 18080000,
      localM2: 65,
      annualMW: 2500,
      annualRent: 7000000,
    })
    expect(result.categoryByIncome).toBe('C')
    expect(result.categoryByM2).toBe('D')
    expect(result.categoryByMW).toBe('A')
    expect(result.categoryByRent).toBe('H')
    expect(result.finalCategory).toBe('H')
  })

  it('ingresos que exceden K retornan K', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 200000000,
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('K')
  })

  it('todos los parametros en null retornan A', () => {
    const result = calculateCategoryFromScales(SCALES, {
      annualIncome: 0,
      localM2: null,
      annualMW: null,
      annualRent: null,
    })
    expect(result.finalCategory).toBe('A')
  })
})

describe('Reglas especiales', () => {
  it('placeholder para tests que requieren DB', () => {
    // Estos tests se implementaran como E2E
    expect(true).toBe(true)
  })
})
