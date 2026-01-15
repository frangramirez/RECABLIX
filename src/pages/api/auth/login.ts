import type { APIRoute } from 'astro'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export const POST: APIRoute = async ({ request, cookies }) => {
  // Capturar cookies que Supabase setea durante login
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get('cookie')
        if (!cookieHeader) return []
        return parseCookieHeader(cookieHeader).filter(
          (c): c is { name: string; value: string } => typeof c.value === 'string'
        )
      },
      setAll(cookies) {
        // Capturar cookies para incluir en response
        cookiesToSet.push(...cookies)
        // También setear en Astro cookies (por si acaso)
        for (const { name, value, options } of cookies) {
          cookies.set(name, value, {
            path: '/',
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            ...options,
          } as Parameters<typeof cookies.set>[2])
        }
      },
    },
  })

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
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

    // Construir response con cookies que Supabase seteó
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    // Incluir todas las cookies que Supabase generó
    for (const cookie of cookiesToSet) {
      const serialized = serializeCookieHeader(cookie.name, cookie.value, {
        path: '/',
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 días
        ...cookie.options,
      })
      headers.append('Set-Cookie', serialized)
    }

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
