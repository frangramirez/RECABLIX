/**
 * Configuración de la aplicación
 *
 * USE_TENANT_SCHEMAS: Cuando está activo, las queries van al tenant schema
 * en lugar del schema public. Esto permite aislamiento físico de datos por studio.
 */

export const config = {
  /** Feature flag para activar/desactivar tenant schemas */
  USE_TENANT_SCHEMAS: import.meta.env.PUBLIC_USE_TENANT_SCHEMAS === 'true',

  /** Tablas que viven en el tenant schema (aisladas por studio) */
  TENANT_TABLES: [
    'clients',
    'client_users',
    'vouchers',
    'reca_client_data',
    'reca_transactions'
  ] as const,

  /** Tablas que siempre viven en public (compartidas) */
  PUBLIC_TABLES: [
    'reca_periods',
    'reca_scales',
    'reca_fee_components',
    'studios',
    'studio_members',
    'superadmins'
  ] as const,
} as const

export type TenantTable = typeof config.TENANT_TABLES[number]
export type PublicTable = typeof config.PUBLIC_TABLES[number]

/**
 * Verifica si una tabla pertenece al tenant schema
 */
export function isTenantTable(tableName: string): boolean {
  return (config.TENANT_TABLES as readonly string[]).includes(tableName)
}

/**
 * Genera el nombre del tenant schema a partir del studio_id
 * Formato: tenant_{studio_id_with_underscores}
 */
export function getTenantSchemaName(studioId: string): string {
  return `tenant_${studioId.replace(/-/g, '_')}`
}
