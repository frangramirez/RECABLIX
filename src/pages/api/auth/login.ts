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
      // Capturar errores específicos
      if (error.message.includes('database error') || error.message.includes('querying schema')) {
        console.error('Database/Schema error during login:', error)
        return new Response(
          JSON.stringify({ error: 'Error de configuración de base de datos. Contacta al administrador.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (error.message.includes('Invalid login credentials')) {
        return new Response(
          JSON.stringify({ error: 'Email o contraseña incorrectos' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }

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

    // Setear cookies de sesión manualmente en los headers de la Response
    const session = data.session
    const isProduction = import.meta.env.PROD
    const cookieFlags = `Path=/; ${isProduction ? 'Secure; ' : ''}SameSite=Lax; HttpOnly; Max-Age=${60 * 60 * 24 * 7}`

    // Headers permite múltiples Set-Cookie via append()
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.append('Set-Cookie', `sb-access-token=${session.access_token}; ${cookieFlags}`)
    headers.append('Set-Cookie', `sb-refresh-token=${session.refresh_token}; ${cookieFlags}`)

    return new Response(JSON.stringify({ success: true, redirectTo }), {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error('Login error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
