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

// ============================================================================
// Schema Creation Utilities
// ============================================================================

import { getTenantSchemaName } from './config'

/**
 * Ensures a tenant schema exists for a given studio.
 *
 * This function implements a defensive pattern:
 * 1. First checks if schema_name is already set in the studios table
 * 2. If not, calls the create_reca_tenant RPC to create the schema
 * 3. Updates the studios.schema_name field
 *
 * This is useful as a fallback when the on_studio_created trigger fails
 * (e.g., due to RLS policy conflicts).
 *
 * @param supabaseAdmin - Admin client (bypasses RLS)
 * @param studioId - UUID of the studio
 * @returns The tenant schema name (e.g., 'tenant_xxx_xxx')
 * @throws Error if schema creation fails with a non-ignorable error
 *
 * @example
 * ```ts
 * const schemaName = await ensureTenantSchema(supabaseAdmin, studioId)
 * const { data } = await supabaseAdmin.schema(schemaName).from('clients').select('*')
 * ```
 */
export async function ensureTenantSchema(
  supabaseAdmin: SupabaseClient,
  studioId: string
): Promise<string> {
  // 1. Check if schema_name is already set
  const { data: studioRecord } = await supabaseAdmin
    .from('studios')
    .select('schema_name')
    .eq('id', studioId)
    .single()

  // 2. If schema_name exists, return it
  if (studioRecord?.schema_name) {
    return studioRecord.schema_name
  }

  // 3. Generate expected schema name
  const expectedSchema = getTenantSchemaName(studioId)

  // 4. Try to create the tenant schema via RPC
  const { error: createError } = await supabaseAdmin
    .rpc('create_reca_tenant', { p_studio_id: studioId })

  // Ignore "already exists" errors - they indicate the schema was created
  // by another process (race condition) or a previous partial attempt
  if (createError && !createError.message.includes('already exists')) {
    console.error('[ensureTenantSchema] Error creating tenant schema:', createError)
    throw new Error(`Error creating tenant schema: ${createError.message}`)
  }

  // 5. Update schema_name in studios table (defensive, RPC should do this too)
  await supabaseAdmin
    .from('studios')
    .update({ schema_name: expectedSchema })
    .eq('id', studioId)

  // 6. PRD4: Expose schema in PostgREST (defensive, trigger should do this too)
  try {
    await supabaseAdmin.rpc('expose_tenant_schema', { p_studio_id: studioId })
    console.log(`[ensureTenantSchema] Schema exposed in PostgREST: ${expectedSchema}`)
  } catch (exposeError) {
    // Non-fatal: log warning but don't throw
    // The schema works, PostgREST just might not see it until next NOTIFY
    console.warn('[ensureTenantSchema] expose_tenant_schema failed (non-fatal):', exposeError)
  }

  console.log(`[ensureTenantSchema] Created/ensured schema: ${expectedSchema}`)

  return expectedSchema
}

/**
 * Gets the tenant schema name for a studio, creating it if necessary.
 *
 * Convenience wrapper around ensureTenantSchema that handles the common
 * pattern of needing a schema name for queries.
 *
 * @param supabaseAdmin - Admin client (bypasses RLS)
 * @param studioId - UUID of the studio
 * @returns Object with schemaName and a flag indicating if it was created
 */
export async function getOrCreateTenantSchema(
  supabaseAdmin: SupabaseClient,
  studioId: string
): Promise<{ schemaName: string; wasCreated: boolean }> {
  // Check current state
  const { data: studioRecord } = await supabaseAdmin
    .from('studios')
    .select('schema_name')
    .eq('id', studioId)
    .single()

  const existed = !!studioRecord?.schema_name
  const schemaName = await ensureTenantSchema(supabaseAdmin, studioId)

  return {
    schemaName,
    wasCreated: !existed
  }
}
