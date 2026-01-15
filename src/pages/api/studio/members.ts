/**
 * API Route: Lista de Miembros del Studio
 *
 * GET /api/studio/members?studio_id=xxx
 * Retorna lista de miembros con sus permisos
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase'

export const GET: APIRoute = async ({ url, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar permiso (owner/admin/superadmin pueden listar)
    const canView =
      session.is_superadmin || session.role === 'owner' || session.role === 'admin'

    if (!canView) {
      return new Response(
        JSON.stringify({ error: 'No tiene permiso para ver miembros' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const studioId = url.searchParams.get('studio_id') || session.studio.id

    const supabase = createSupabaseServerClient(cookies, request)

    // Obtener miembros con información del usuario
    const { data: members, error } = await supabase
      .from('studio_members')
      .select(
        `
        id,
        user_id,
        role,
        permissions,
        created_at,
        users (email)
      `
      )
      .eq('studio_id', studioId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ members }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in GET /api/studio/members:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
