import type { AstroCookies } from 'astro'
import { createSupabaseServerClient, supabaseAdmin } from './supabase'
import { getTenantSchemaName } from './config'

export { createSupabaseServerClient, getTenantSchemaName }

/**
 * Obtiene la sesión actual de Supabase
 */
export async function getSession(cookies: AstroCookies) {
  const supabase = createSupabaseServerClient(cookies)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/**
 * Obtiene el studio asociado al usuario autenticado
 * Retorna null si no hay sesión o no existe el studio
 *
 * NOTA: Usamos supabaseAdmin para las queries de DB porque las políticas RLS
 * en superadmins y studio_members tienen recursión infinita. Esto es seguro
 * porque getUser() ya validó el JWT del usuario.
 */
export async function getStudioFromSession(cookies: AstroCookies, request?: Request) {
  const supabase = createSupabaseServerClient(cookies, request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Usar admin client para bypasear RLS (las políticas tienen recursión infinita)
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured')
    return null
  }

  // Verificar si es superadmin
  const { data: superadmin } = await supabaseAdmin
    .from('superadmins')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Obtener studio desde studio_members (limit 1 en caso de múltiples membresías)
  const { data: memberships } = await supabaseAdmin
    .from('studio_members')
    .select('studio_id, role, studios(*)')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]
  if (!membership?.studios) return null

  // membership.studios puede ser array u objeto dependiendo del query
  // Lo tratamos como unknown y extraemos los campos necesarios
  const studios = membership.studios as unknown
  const studioData = (Array.isArray(studios) ? studios[0] : studios) as {
    id: string
    name: string
    slug: string
    created_at: string
    updated_at: string
  } | undefined

  if (!studioData) return null

  return {
    id: studioData.id,
    name: studioData.name,
    slug: studioData.slug,
    is_superadmin: !!superadmin,
    role: membership.role,
    schema_name: getTenantSchemaName(studioData.id),
  }
}

/**
 * Verifica si un email corresponde al SuperAdmin
 */
export function isSuperAdminEmail(email: string): boolean {
  const superAdminEmail = import.meta.env.SUPERADMIN_EMAIL || 'framirez@contablix.ar'
  return email.toLowerCase() === superAdminEmail.toLowerCase()
}
