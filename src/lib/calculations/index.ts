/**
 * Motor de Cálculo de Recategorización - RECABLIX
 *
 * Este módulo integra el cálculo de categoría y componentes de cuota
 * para determinar la nueva cuota de monotributo de un contribuyente.
 *
 * Exporta tanto funciones PURAS (para testing/frontend) como
 * funciones integradas con Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateCategoryFromScales,
  CATEGORY_ORDER,
  type Scale,
  type CategoryResult
} from './category'
import {
  calculateFeeComponentsFromData,
  type FeeComponentData,
  type FeeComponentsResult,
  type ClientActivity
} from './fee-components'

// Re-exportar tipos y funciones de módulos internos
export * from './category'
export * from './fee-components'

// ════════════════════════════════════════════════════════════════
// TIPOS PRINCIPALES
// ════════════════════════════════════════════════════════════════

export interface ClientData {
  id: string
  name: string
  activity: ClientActivity
  provinceCode: string
  worksInRD: boolean
  isRetired: boolean
  dependents: number
  localM2: number | null
  annualRent: number | null
  annualMW: number | null
  periodSales: number
  previousCategory: string | null
  previousFee: number | null
}

export interface RecategorizationResult {
  client: { id: string; name: string }
  category: CategoryResult
  feeComponents: FeeComponentsResult
  totalFee: number
  comparison: {
    previousCategory: string | null
    previousFee: number | null
    categoryChange: 'UP' | 'DOWN' | 'SAME' | 'NEW'
    feeChange: number
    feeChangePercent: number | null
  }
}

// ════════════════════════════════════════════════════════════════
// FUNCIONES PURAS (sin BD)
// ════════════════════════════════════════════════════════════════

/**
 * Calcula el resultado completo de recategorización usando datos estáticos.
 * Útil para testing y cálculos en frontend sin conexión a BD.
 */
export function calculateRecategorizationFromData(
  scales: Scale[],
  feeComponents: FeeComponentData[],
  client: ClientData
): RecategorizationResult {
  // 1. Calcular categoría
  const categoryResult = calculateCategoryFromScales(scales, {
    annualIncome: client.periodSales,
    localM2: client.localM2,
    annualMW: client.annualMW,
    annualRent: client.annualRent,
  })

  // 2. Calcular componentes de cuota
  const feeResult = calculateFeeComponentsFromData(feeComponents, {
    category: categoryResult.finalCategory,
    activity: client.activity,
    provinceCode: client.provinceCode,
    worksInRD: client.worksInRD,
    isRetired: client.isRetired,
    dependents: client.dependents,
  })

  // 3. Sumar total
  const totalFee = Object.values(feeResult.subtotals).reduce((a, b) => a + b, 0)

  // 4. Comparar con categoría/cuota anterior
  let categoryChange: 'UP' | 'DOWN' | 'SAME' | 'NEW' = 'NEW'
  if (client.previousCategory) {
    const prevIndex = CATEGORY_ORDER.indexOf(client.previousCategory)
    const newIndex = CATEGORY_ORDER.indexOf(categoryResult.finalCategory)
    const diff = newIndex - prevIndex
    categoryChange = diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'SAME'
  }

  const feeChange = totalFee - (client.previousFee ?? 0)
  const feeChangePercent = client.previousFee
    ? ((totalFee - client.previousFee) / client.previousFee) * 100
    : null

  return {
    client: { id: client.id, name: client.name },
    category: categoryResult,
    feeComponents: feeResult,
    totalFee,
    comparison: {
      previousCategory: client.previousCategory,
      previousFee: client.previousFee,
      categoryChange,
      feeChange,
      feeChangePercent,
    },
  }
}

// ════════════════════════════════════════════════════════════════
// FUNCIONES CON SUPABASE
// ════════════════════════════════════════════════════════════════

/**
 * Obtiene las escalas de un período desde Supabase.
 */
export async function getScalesForPeriod(
  supabase: SupabaseClient,
  recaId: string
): Promise<Scale[]> {
  const { data, error } = await supabase
    .from('reca_scales')
    .select('category, max_annual_income, max_local_m2, max_annual_mw, max_annual_rent')
    .eq('reca_id', recaId)
    .order('category')

  if (error || !data?.length) {
    throw new Error(`No se encontraron escalas para el período: ${error?.message || 'Sin datos'}`)
  }

  return data as Scale[]
}

/**
 * Obtiene los componentes de cuota de un período desde Supabase.
 */
export async function getFeeComponentsForPeriod(
  supabase: SupabaseClient,
  recaId: string
): Promise<FeeComponentData[]> {
  const { data, error } = await supabase
    .from('reca_fee_components')
    .select('component_code, description, component_type, category, value, province_code, has_municipal')
    .eq('reca_id', recaId)

  if (error) {
    throw new Error(`Error al obtener componentes: ${error.message}`)
  }

  return (data || []) as FeeComponentData[]
}

/**
 * Calcula la recategorización completa consultando datos de Supabase.
 * Esta es la función principal para uso en producción.
 */
export async function calculateRecategorization(
  supabase: SupabaseClient,
  recaId: string,
  client: ClientData
): Promise<RecategorizationResult> {
  // Obtener datos desde BD
  const [scales, feeComponents] = await Promise.all([
    getScalesForPeriod(supabase, recaId),
    getFeeComponentsForPeriod(supabase, recaId),
  ])

  // Usar función pura con los datos obtenidos
  return calculateRecategorizationFromData(scales, feeComponents, client)
}

// ════════════════════════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════════════════════════

/**
 * Formatea un número como moneda argentina (ARS).
 */
export const formatARS = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n)

/**
 * Formatea un número con separadores de miles.
 */
export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('es-AR').format(n)

/**
 * Compara dos categorías y retorna la diferencia.
 * Positivo = subió, Negativo = bajó, 0 = igual
 */
export function compareCategories(prev: string, next: string): number {
  return CATEGORY_ORDER.indexOf(next) - CATEGORY_ORDER.indexOf(prev)
}
