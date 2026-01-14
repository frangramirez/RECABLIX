import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '@/lib/auth'

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const supabase = createSupabaseServerClient(cookies)

    const { error } = await supabase.auth.signOut()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, redirectTo: '/login' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Logout error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
