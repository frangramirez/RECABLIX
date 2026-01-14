/**
 * Motor de Cálculo - Determinación de Categoría
 *
 * La categoría de monotributo se determina tomando el MÁXIMO
 * de las categorías determinadas por cada parámetro:
 * - Ingresos brutos anuales
 * - Superficie afectada (m²)
 * - Energía eléctrica consumida (kW)
 * - Alquileres devengados anualmente
 */

const CATEGORY_ORDER = 'ABCDEFGHIJK'

export interface CategoryInput {
  annualIncome: number
  localM2: number | null
  annualMW: number | null
  annualRent: number | null
}

export interface Scale {
  category: string
  max_annual_income: number
  max_local_m2: number
  max_annual_mw: number
  max_annual_rent: number
}

export interface CategoryResult {
  finalCategory: string
  categoryByIncome: string
  categoryByM2: string
  categoryByMW: string
  categoryByRent: string
  details: {
    income: { value: number; limit: number }
    m2: { value: number; limit: number }
    mw: { value: number; limit: number }
    rent: { value: number; limit: number }
  }
}

/**
 * Determina la categoría para un valor dado según un parámetro específico.
 * Busca la primera categoría cuyo límite sea >= al valor.
 */
function getCategoryForValue(
  scales: Scale[],
  value: number,
  param: 'income' | 'm2' | 'mw' | 'rent'
): string {
  // Si el valor es 0 o negativo, retorna categoría mínima
  if (!value || value <= 0) return 'A'

  // Ordenar escalas por categoría (A -> K)
  const sortedScales = [...scales].sort((a, b) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  )

  for (const scale of sortedScales) {
    const limit = param === 'income' ? scale.max_annual_income
      : param === 'm2' ? scale.max_local_m2
      : param === 'mw' ? scale.max_annual_mw
      : scale.max_annual_rent

    if (value <= limit) return scale.category
  }

  // Si excede todos los límites, retorna K (máxima categoría)
  return 'K'
}

/**
 * Obtiene la categoría máxima de un array de categorías.
 * Ej: ['A', 'C', 'D', 'B'] -> 'D'
 */
function getMaxCategory(categories: string[]): string {
  let maxIndex = 0
  for (const cat of categories) {
    if (cat) {
      const index = CATEGORY_ORDER.indexOf(cat)
      if (index > maxIndex) maxIndex = index
    }
  }
  return CATEGORY_ORDER[maxIndex]
}

/**
 * Calcula la categoría de monotributo basándose en las escalas
 * y los parámetros del contribuyente.
 *
 * Esta es la función PURA que puede usarse sin conexión a BD.
 * Útil para testing y cálculos en frontend.
 */
export function calculateCategoryFromScales(
  scales: Scale[],
  input: CategoryInput
): CategoryResult {
  const categoryByIncome = getCategoryForValue(scales, input.annualIncome, 'income')
  const categoryByM2 = getCategoryForValue(scales, input.localM2 ?? 0, 'm2')
  const categoryByMW = getCategoryForValue(scales, input.annualMW ?? 0, 'mw')
  const categoryByRent = getCategoryForValue(scales, input.annualRent ?? 0, 'rent')

  const finalCategory = getMaxCategory([
    categoryByIncome, categoryByM2, categoryByMW, categoryByRent
  ])

  // Encontrar la escala de la categoría final para los detalles
  const finalScale = scales.find(s => s.category === finalCategory)

  // Fallback a valores por defecto si no se encuentra la escala
  const defaultLimits = {
    max_annual_income: 0,
    max_local_m2: 0,
    max_annual_mw: 0,
    max_annual_rent: 0
  }
  const scaleForDetails = finalScale ?? defaultLimits

  return {
    finalCategory,
    categoryByIncome,
    categoryByM2,
    categoryByMW,
    categoryByRent,
    details: {
      income: {
        value: input.annualIncome,
        limit: scaleForDetails.max_annual_income
      },
      m2: {
        value: input.localM2 ?? 0,
        limit: scaleForDetails.max_local_m2
      },
      mw: {
        value: input.annualMW ?? 0,
        limit: scaleForDetails.max_annual_mw
      },
      rent: {
        value: input.annualRent ?? 0,
        limit: scaleForDetails.max_annual_rent
      },
    }
  }
}

// Re-export del orden de categorías para uso externo
export { CATEGORY_ORDER }
