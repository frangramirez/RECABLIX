import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import type { AstroCookies } from 'astro'
import { config, isTenantTable } from './config'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_KEY

// Cliente para uso en el browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente de servicio (bypassa RLS) - solo usar en server
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Cliente para uso en el servidor (con cookies)
export function createSupabaseServerClient(cookies: AstroCookies, request?: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll(): { name: string; value: string }[] {
        // Si tenemos request, parsear todas las cookies del header usando utilidad de Supabase
        if (request) {
          const cookieHeader = request.headers.get('cookie')
          if (!cookieHeader) return []

          // parseCookieHeader maneja correctamente el encoding de Supabase (base64-, etc)
          const parsed = parseCookieHeader(cookieHeader)
          return parsed.filter((c): c is { name: string; value: string } => typeof c.value === 'string')
        }

        // Fallback: Astro no expone getAll, leer cookies conocidas
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || ''
        const cookieNames = [
          'sb-access-token',
          'sb-refresh-token',
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token.0`,
          `sb-${projectRef}-auth-token.1`,
        ]
        const result: { name: string; value: string }[] = []
        for (const name of cookieNames) {
          const cookie = cookies.get(name)
          if (cookie?.value) {
            result.push({ name, value: cookie.value })
          }
        }
        return result
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, {
            path: '/',
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            ...options,
          })
        }
      },
    },
  })
}

// Helper para obtener los Set-Cookie headers de cookies que fueron set
export function getCookieHeaders(_cookies: AstroCookies): string[] {
  // Astro no expone una forma de obtener las cookies que fueron set
  // Como workaround, retornamos un array vacío y confiamos en que
  // Astro serializará las cookies automáticamente si no retornamos Response manual
  return []
}

// ============================================================================
// TENANT SCHEMA HELPERS
// ============================================================================

/**
 * Crea una query que usa el schema correcto basado en la tabla
 * Si USE_TENANT_SCHEMAS está activo y la tabla es de tenant, usa el tenant schema
 * De lo contrario, usa el schema public (comportamiento default)
 *
 * @param client - Cliente Supabase a usar
 * @param schemaName - Nombre del tenant schema (tenant_xxxx_xxxx...)
 * @param tableName - Nombre de la tabla a consultar
 */
export function createTenantQuery<T extends SupabaseClient>(
  client: T,
  schemaName: string,
  tableName: string
) {
  if (config.USE_TENANT_SCHEMAS && isTenantTable(tableName)) {
    return client.schema(schemaName).from(tableName)
  }
  return client.from(tableName)
}

/**
 * Helper factory que crea una función query para un schema específico
 * Útil para evitar pasar schemaName en cada llamada
 *
 * @example
 * const query = createTenantQueryFactory(supabase, 'tenant_xxx')
 * const { data } = await query('clients').select('*')
 */
export function createTenantQueryFactory(
  client: SupabaseClient,
  schemaName: string
) {
  return (tableName: string) => createTenantQuery(client, schemaName, tableName)
}
