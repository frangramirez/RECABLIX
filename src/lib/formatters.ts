/**
 * Utilidades de formateo numérico para Argentina
 * Formato: miles con punto, decimales con coma (ej: 1.234.567,89)
 */

/**
 * Formatear número con separador de miles para display
 * @example formatDisplayNumber(1234567.89) → "1.234.567,89"
 */
export function formatDisplayNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formatear para edición: sin separador de miles, coma decimal
 * @example formatEditNumber(1234567.89) → "1234567,89"
 */
export function formatEditNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(value).replace('.', ',')
}

/**
 * Parsear string a número (acepta formato argentino con coma)
 * @example parseInputNumber("1.234.567,89") → 1234567.89
 */
export function parseInputNumber(str: string): number | null {
  if (!str.trim()) return null
  // Remover puntos de miles, reemplazar coma decimal por punto
  const normalized = str.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

/**
 * Validar y sanitizar input: solo dígitos, una coma, max 2 decimales
 * @example sanitizeInput("1234,567") → "1234,56"
 */
export function sanitizeInput(value: string): string {
  // Solo permitir dígitos y una coma
  let sanitized = value.replace(/[^\d,]/g, '')

  // Máximo una coma
  const parts = sanitized.split(',')
  if (parts.length > 2) {
    sanitized = parts[0] + ',' + parts.slice(1).join('')
  }

  // Máximo 2 decimales
  if (parts.length === 2 && parts[1].length > 2) {
    sanitized = parts[0] + ',' + parts[1].slice(0, 2)
  }

  return sanitized
}

/**
 * Formatear número para display sin decimales fijos
 * @example formatDisplayInteger(1234567) → "1.234.567"
 */
export function formatDisplayInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return Math.round(value).toLocaleString('es-AR')
}
