import type { APIRoute } from 'astro'
import { createSupabaseServerClient, isSuperAdminEmail } from '@/lib/auth'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createSupabaseServerClient(cookies)

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

    // Verificar si existe studio para este usuario
    const { data: existingStudio } = await supabase
      .from('studios')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single()

    let studio = existingStudio

    if (!existingStudio) {
      // Crear studio para nuevo usuario
      const isSuperAdmin = isSuperAdminEmail(email)

      const { data: newStudio, error: studioError } = await supabase
        .from('studios')
        .insert({
          auth_user_id: data.user.id,
          email: data.user.email,
          name: data.user.email?.split('@')[0] || 'Studio',
          is_superadmin: isSuperAdmin,
          is_active: true,
        })
        .select()
        .single()

      if (studioError) {
        console.error('Error creating studio:', studioError)
      }

      studio = newStudio
    }

    // Determinar redirect según rol
    const redirectTo = studio?.is_superadmin ? '/admin' : '/studio'

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
