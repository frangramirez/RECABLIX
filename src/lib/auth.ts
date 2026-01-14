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
export async function getStudioFromSession(cookies: AstroCookies) {
  const supabase = createSupabaseServerClient(cookies)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: studio } = await supabase
    .from('studios')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return studio
}

/**
 * Verifica si un email corresponde al SuperAdmin
 */
export function isSuperAdminEmail(email: string): boolean {
  const superAdminEmail = import.meta.env.SUPERADMIN_EMAIL || 'framirez@contablix.ar'
  return email.toLowerCase() === superAdminEmail.toLowerCase()
}
