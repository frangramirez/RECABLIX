import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createSupabaseServerClient(cookies, request)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Usar cliente admin para bypasear RLS durante login
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Service key no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar si es superadmin
    const { data: superadmin } = await supabaseAdmin
      .from('superadmins')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('is_active', true)
      .single()

    // Verificar si ya tiene un studio asignado (tomar el primero si tiene varios)
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('studio_members')
      .select('studio_id, role')
      .eq('user_id', data.user.id)
      .limit(1)

    const membership = memberships?.[0]
    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Usuario sin studio asignado. Contactá al administrador.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Determinar redirect según rol
    const redirectTo = superadmin ? '/admin' : '/studio'

    // Setear cookies de sesión manualmente (Astro no las incluye en Response manual)
    const session = data.session
    const cookieOptions = {
      path: '/',
      secure: import.meta.env.PROD,
      sameSite: 'lax' as const,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 días
    }

    // Cookie con el token de acceso
    cookies.set('sb-access-token', session.access_token, cookieOptions)
    cookies.set('sb-refresh-token', session.refresh_token, cookieOptions)

    // Crear response con headers de cookies
    const response = new Response(JSON.stringify({ success: true, redirectTo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
