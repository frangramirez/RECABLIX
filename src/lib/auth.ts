import type { AstroCookies } from 'astro'
import { createSupabaseServerClient } from './supabase'

export { createSupabaseServerClient }

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
 */
export async function getStudioFromSession(cookies: AstroCookies, request?: Request) {
  const supabase = createSupabaseServerClient(cookies, request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Verificar si es superadmin
  const { data: superadmin } = await supabase
    .from('superadmins')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Obtener studio desde studio_members
  const { data: membership } = await supabase
    .from('studio_members')
    .select('studio_id, role, studios(*)')
    .eq('user_id', user.id)
    .single()

  if (!membership?.studios) return null

  // Agregar flag de superadmin al studio
  return {
    ...membership.studios,
    is_superadmin: !!superadmin,
    role: membership.role,
  }
}

/**
 * Verifica si un email corresponde al SuperAdmin
 */
export function isSuperAdminEmail(email: string): boolean {
  const superAdminEmail = import.meta.env.SUPERADMIN_EMAIL || 'framirez@contablix.ar'
  return email.toLowerCase() === superAdminEmail.toLowerCase()
}
