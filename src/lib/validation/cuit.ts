/**
 * Validación y formateo de CUIT argentino
 *
 * Formato: XX-XXXXXXXX-X
 * Dígito verificador calculado con algoritmo módulo 11
 */

/**
 * Valida formato y dígito verificador de un CUIT
 */
export function validateCUIT(cuit: string): { valid: boolean; error?: string } {
  if (!cuit || cuit.trim() === '') {
    return { valid: true } // CUIT es opcional
  }

  const trimmed = cuit.trim()

  // Validar formato XX-XXXXXXXX-X
  const formatRegex = /^\d{2}-\d{8}-\d{1}$/
  if (!formatRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Formato inválido. Debe ser XX-XXXXXXXX-X (11 dígitos)',
    }
  }

  // Extraer solo dígitos
  const digits = trimmed.replace(/-/g, '')

  // Validar dígito verificador (algoritmo módulo 11)
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0

  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * multipliers[i]
  }

  let remainder = sum % 11
  let expectedCheckDigit = 11 - remainder

  // Casos especiales del algoritmo
  if (expectedCheckDigit === 11) expectedCheckDigit = 0
  if (expectedCheckDigit === 10) expectedCheckDigit = 9

  const actualCheckDigit = parseInt(digits[10])

  if (expectedCheckDigit !== actualCheckDigit) {
    return {
      valid: false,
      error: `Dígito verificador inválido (esperado: ${expectedCheckDigit})`,
    }
  }

  return { valid: true }
}

/**
 * Formatea un string de dígitos como CUIT mientras se escribe
 * Input: "20123456789" → Output: "20-12345678-9"
 */
export function formatCUITInput(value: string): string {
  // Remover todo excepto dígitos
  const digits = value.replace(/\D/g, '')

  // Limitar a 11 dígitos
  const limited = digits.slice(0, 11)

  // Aplicar formato XX-XXXXXXXX-X
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 10) {
    return `${limited.slice(0, 2)}-${limited.slice(2)}`
  } else {
    return `${limited.slice(0, 2)}-${limited.slice(2, 10)}-${limited.slice(10, 11)}`
  }
}

/**
 * Valida si un CUIT es válido (formato + dígito verificador)
 * Versión simple que retorna boolean
 */
export function isValidCUIT(cuit: string): boolean {
  return validateCUIT(cuit).valid
}
