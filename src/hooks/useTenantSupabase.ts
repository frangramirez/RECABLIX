import { useMemo } from 'react'
import { supabase, createTenantQuery } from '@/lib/supabase'
import { config } from '@/lib/config'

interface TenantContext {
  studioId: string
  schemaName: string
}

/**
 * Hook que retorna un cliente Supabase configurado para el tenant actual
 *
 * @example
 * const { query, publicQuery } = useTenantSupabase({ studioId, schemaName })
 *
 * // Query a tabla de tenant (clients, reca_transactions, etc)
 * const { data } = await query('clients').select('*')
 *
 * // Query a tabla pública (reca_periods, studios, etc)
 * const { data } = await publicQuery('reca_periods').select('*')
 */
export function useTenantSupabase(context: TenantContext | null) {
  return useMemo(() => {
    if (!context) {
      return {
        /** Query que detecta automáticamente el schema */
        query: (table: string) => supabase.from(table),
        /** Query explícita a schema public */
        publicQuery: (table: string) => supabase.from(table),
        /** Query explícita al tenant schema (fallback a public si no hay context) */
        tenantQuery: (table: string) => supabase.from(table),
        /** Si el hook está listo para usar */
        isReady: false,
        /** Si tenant schemas está activo */
        useTenantSchemas: config.USE_TENANT_SCHEMAS,
      }
    }

    const { schemaName } = context

    return {
      /**
       * Query que detecta automáticamente si la tabla es de tenant o public
       * Si USE_TENANT_SCHEMAS=true y tabla es de tenant → usa tenant schema
       * De lo contrario → usa public schema
       */
      query: (table: string) => createTenantQuery(supabase, schemaName, table),

      /**
       * Query explícita a schema public (para tablas maestras)
       */
      publicQuery: (table: string) => supabase.from(table),

      /**
       * Query explícita al tenant schema
       * Útil cuando querés forzar el uso del tenant schema
       */
      tenantQuery: (table: string) => supabase.schema(schemaName).from(table),

      /** Si el hook está listo para usar */
      isReady: true,

      /** Nombre del schema actual */
      schemaName,

      /** Si tenant schemas está activo */
      useTenantSchemas: config.USE_TENANT_SCHEMAS,
    }
  }, [context?.studioId, context?.schemaName])
}
