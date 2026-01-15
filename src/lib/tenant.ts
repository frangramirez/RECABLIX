/**
 * Helpers para trabajar con Tenant Schemas
 *
 * Facilita la ejecución de queries en schemas específicos por tenant
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

/**
 * Ejecuta query en un schema de tenant específico
 *
 * IMPORTANTE: Supabase client requiere que uses .schema() antes de .from()
 *
 * @param supabase - Cliente de Supabase
 * @param schema - Nombre del schema (ej: 'tenant_abc123...')
 * @param table - Nombre de la tabla en el schema del tenant
 * @returns Query builder configurado para el tenant schema
 *
 * @example
 * ```ts
 * const { data } = await tenantFrom(supabase, session.tenant_schema, 'clients')
 *   .select('*')
 *   .eq('is_active', true)
 * ```
 */
export function tenantFrom<T = any>(
  supabase: SupabaseClient,
  schema: string,
  table: string
) {
  return supabase.schema(schema).from<T>(table)
}

/**
 * Alias más semántico para queries en tenant schema
 *
 * @example
 * ```ts
 * const { data } = await queryTenantTable(supabase, session.tenant_schema, 'reca_client_data')
 *   .select('*')
 *   .eq('client_id', clientId)
 *   .single()
 * ```
 */
export function queryTenantTable<T = any>(
  supabase: SupabaseClient,
  tenantSchema: string,
  table: string
) {
  return tenantFrom<T>(supabase, tenantSchema, table)
}

/**
 * Helper para insertar datos en tenant schema
 *
 * @example
 * ```ts
 * const { data, error } = await insertIntoTenant(
 *   supabase,
 *   session.tenant_schema,
 *   'clients',
 *   { name: 'Cliente Nuevo', cuit: '20123456789' }
 * )
 * ```
 */
export async function insertIntoTenant<T = any>(
  supabase: SupabaseClient,
  tenantSchema: string,
  table: string,
  data: Partial<T> | Partial<T>[]
) {
  return supabase.schema(tenantSchema).from(table).insert(data).select()
}

/**
 * Helper para actualizar datos en tenant schema
 *
 * @example
 * ```ts
 * const { data, error } = await updateInTenant(
 *   supabase,
 *   session.tenant_schema,
 *   'clients',
 *   { is_active: false }
 * ).eq('id', clientId)
 * ```
 */
export function updateInTenant<T = any>(
  supabase: SupabaseClient,
  tenantSchema: string,
  table: string,
  updates: Partial<T>
) {
  return supabase.schema(tenantSchema).from(table).update(updates)
}

/**
 * Helper para eliminar datos en tenant schema
 *
 * @example
 * ```ts
 * const { error } = await deleteFromTenant(
 *   supabase,
 *   session.tenant_schema,
 *   'clients'
 * ).eq('id', clientId)
 * ```
 */
export function deleteFromTenant(
  supabase: SupabaseClient,
  tenantSchema: string,
  table: string
) {
  return supabase.schema(tenantSchema).from(table).delete()
}

/**
 * Tablas disponibles en cada tenant schema
 */
export const TENANT_TABLES = {
  // Tabla compartida por todas las apps
  CLIENTS: 'clients',

  // Tablas específicas de RECABLIX
  RECA_CLIENT_DATA: 'reca_client_data',
  RECA_TRANSACTIONS: 'reca_transactions',

  // Tablas específicas de FINBLIX (futuro)
  // FINBLIX_INVESTMENTS: 'finblix_investments',

  // Tablas específicas de PACIOLI (futuro)
  // PACIOLI_JOURNAL_ENTRIES: 'pacioli_journal_entries',
} as const

/**
 * Tipo helper para asegurar que usas tablas válidas
 */
export type TenantTableName = typeof TENANT_TABLES[keyof typeof TENANT_TABLES]

/**
 * Helper type-safe para queries en tenant
 *
 * @example
 * ```ts
 * const { data } = await queryTenant(supabase, session.tenant_schema, TENANT_TABLES.CLIENTS)
 *   .select('*')
 *   .eq('is_active', true)
 * ```
 */
export function queryTenant<T = any>(
  supabase: SupabaseClient,
  tenantSchema: string,
  table: TenantTableName
) {
  return tenantFrom<T>(supabase, tenantSchema, table)
}
