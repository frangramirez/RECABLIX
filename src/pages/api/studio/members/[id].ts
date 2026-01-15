/**
 * API Route: Gestión de Miembro Individual
 *
 * PATCH /api/studio/members/[id] - Actualizar permisos
 * DELETE /api/studio/members/[id] - Eliminar miembro
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { checkPermission, hasFullAccess } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase'

/**
 * PATCH /api/studio/members/[id]
 * Actualiza permisos de un miembro
 */
export const PATCH: APIRoute = async ({ params, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Solo owner y superadmin pueden editar permisos
    // Admin puede editar solo collaborator/client
    if (!hasFullAccess(session) && session.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'No tiene permiso para editar miembros' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updates = await request.json()
    const supabase = createSupabaseServerClient(cookies, request)

    // Si es admin, verificar que no está editando owner/admin
    if (session.role === 'admin' && !session.is_superadmin) {
      const { data: member } = await supabase
        .from('studio_members')
        .select('role')
        .eq('id', id)
        .single()

      if (member && ['owner', 'admin'].includes(member.role)) {
        return new Response(
          JSON.stringify({ error: 'No puede editar owners o admins' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Actualizar permisos
    const { data, error } = await supabase
      .from('studio_members')
      .update({ permissions: updates.permissions })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in PATCH /api/studio/members/[id]:', error)
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

/**
 * DELETE /api/studio/members/[id]
 * Elimina un miembro del studio
 */
export const DELETE: APIRoute = async ({ params, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar permiso para eliminar miembros
    if (!checkPermission(session, 'can_delete_members') && !hasFullAccess(session)) {
      return new Response(
        JSON.stringify({ error: 'No tiene permiso para eliminar miembros' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createSupabaseServerClient(cookies, request)

    // Verificar que no es el único owner
    const { data: member } = await supabase
      .from('studio_members')
      .select('role, studio_id')
      .eq('id', id)
      .single()

    if (member?.role === 'owner') {
      // Contar otros owners
      const { count } = await supabase
        .from('studio_members')
        .select('*', { count: 'exact', head: true })
        .eq('studio_id', member.studio_id)
        .eq('role', 'owner')

      if (count && count <= 1) {
        return new Response(
          JSON.stringify({
            error: 'No se puede eliminar el único propietario del studio',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Eliminar miembro
    const { error } = await supabase.from('studio_members').delete().eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in DELETE /api/studio/members/[id]:', error)
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
