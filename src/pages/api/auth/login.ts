import type { APIRoute } from 'astro'
import { createSupabaseServerClient, isSuperAdminEmail } from '@/lib/auth'
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

    // Verificar si ya tiene un studio asignado
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('studio_members')
      .select('studio_id, role')
      .eq('user_id', data.user.id)
      .single()

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Usuario sin studio asignado. Contactá al administrador.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Determinar redirect según rol
    const redirectTo = superadmin ? '/admin' : '/studio'

    // Las cookies de Supabase se setean automáticamente via setAll()
    return new Response(JSON.stringify({ success: true, redirectTo }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Login error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
