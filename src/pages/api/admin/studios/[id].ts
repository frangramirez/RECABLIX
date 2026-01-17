import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface SubscriptionLimits {
  max_admins: number | null
  max_collaborators: number | null
  max_clients: number | null
}

/**
 * PATCH /api/admin/studios/[id]
 * Update a studio's name, slug, or subscription_limits
 */
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
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

    const studioId = params.id
    if (!studioId) {
      return new Response(
        JSON.stringify({ error: 'ID de estudio requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json() as {
      name?: string
      slug?: string
      subscription_limits?: SubscriptionLimits
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.slug !== undefined) updateData.slug = body.slug
    if (body.subscription_limits !== undefined) updateData.subscription_limits = body.subscription_limits

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay datos para actualizar' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabaseAdmin
      .from('studios')
      .update(updateData)
      .eq('id', studioId)

    if (error) {
      console.error('Error updating studio:', error)
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'El slug ya está en uso por otro estudio' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Studios PATCH error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * DELETE /api/admin/studios/[id]
 * Delete a studio and cascade delete its memberships
 */
export const DELETE: APIRoute = async ({ params, request, cookies }) => {
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

    const studioId = params.id
    if (!studioId) {
      return new Response(
        JSON.stringify({ error: 'ID de estudio requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the studio name for confirmation (optional, for logging)
    const { data: studio, error: fetchError } = await supabaseAdmin
      .from('studios')
      .select('name')
      .eq('id', studioId)
      .single()

    if (fetchError || !studio) {
      return new Response(
        JSON.stringify({ error: 'Estudio no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Delete memberships first (cascade should handle this, but explicit is safer)
    const { error: membersError } = await supabaseAdmin
      .from('studio_members')
      .delete()
      .eq('studio_id', studioId)

    if (membersError) {
      console.error('Error deleting studio members:', membersError)
      return new Response(
        JSON.stringify({ error: 'Error al eliminar miembros del estudio' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Delete the studio
    const { error: deleteError } = await supabaseAdmin
      .from('studios')
      .delete()
      .eq('id', studioId)

    if (deleteError) {
      console.error('Error deleting studio:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[StudiosAPI] Studio deleted: ${studio.name} (${studioId})`)

    return new Response(
      JSON.stringify({ success: true, message: `Estudio "${studio.name}" eliminado` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Studios DELETE error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
