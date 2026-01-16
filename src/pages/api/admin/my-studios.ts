import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

/**
 * API: /api/admin/my-studios
 *
 * GET - Lista todos los estudios donde el superadmin es miembro (owner/admin)
 * Incluye conteo de clientes y miembros por estudio
 */

interface StudioWithCounts {
  id: string
  name: string
  slug: string
  schema_name: string
  member_count: number
  client_count: number
  role: 'owner' | 'admin' | 'collaborator' | 'client'
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const session = await getStudioFromSession(cookies, request)
    if (!session?.is_superadmin) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Service key no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener user_id desde la sesión autenticada
    const supabase = createSupabaseServerClient(cookies, request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No hay sesión activa' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener todos los estudios donde el usuario es miembro
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('studio_members')
      .select(`
        role,
        studios!inner (
          id,
          name,
          slug,
          schema_name
        )
      `)
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin']) // Solo estudios donde tiene permisos de gestión
      .order('created_at', { ascending: false })

    if (membershipError) throw membershipError

    // Obtener conteos para cada estudio
    const studiosWithCounts: StudioWithCounts[] = []

    for (const membership of memberships || []) {
      const studioInfo = Array.isArray(membership.studios)
        ? membership.studios[0]
        : membership.studios

      if (!studioInfo) continue

      // Contar miembros del estudio
      const { count: memberCount } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioInfo.id)

      // Contar clientes del estudio (solo recablix)
      // Nota: Los clientes están en tenant schema, usamos una función RPC o contamos desde tabla pública
      let clientCount = 0

      // Intentar contar clientes si hay schema_name
      if (studioInfo.schema_name) {
        try {
          // Usamos RPC para contar clientes en tenant schema
          const { count } = await supabaseAdmin
            .rpc('count_tenant_clients', {
              p_schema_name: studioInfo.schema_name,
              p_app: 'recablix'
            })
            .single()

          clientCount = count || 0
        } catch {
          // Si falla la RPC, dejamos clientCount en 0
          // Esto puede pasar si la función RPC no existe
        }
      }

      studiosWithCounts.push({
        id: studioInfo.id,
        name: studioInfo.name,
        slug: studioInfo.slug,
        schema_name: studioInfo.schema_name,
        member_count: memberCount || 0,
        client_count: clientCount,
        role: membership.role as 'owner' | 'admin' | 'collaborator' | 'client',
      })
    }

    return new Response(
      JSON.stringify({
        studios: studiosWithCounts,
        total: studiosWithCounts.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('My-Studios GET error:', err)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
