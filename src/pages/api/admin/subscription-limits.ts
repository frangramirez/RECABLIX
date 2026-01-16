import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { SubscriptionLimits, SubscriptionLimitsResponse } from '@/types/subscription'

/**
 * API: /api/admin/subscription-limits
 *
 * GET ?studio_id=xxx - Obtener límites y uso actual del studio
 * PATCH - Actualizar límites (solo superadmin)
 */

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const session = await getStudioFromSession(cookies, request)
    if (!session?.is_superadmin) {
      return new Response(
        JSON.stringify({ error: 'No autorizado. Solo superadmins.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Service key no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const studioId = url.searchParams.get('studio_id')

    if (!studioId) {
      return new Response(
        JSON.stringify({ error: 'studio_id es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener límites del studio
    const { data: studio, error: studioError } = await supabaseAdmin
      .from('studios')
      .select('subscription_limits')
      .eq('id', studioId)
      .single()

    if (studioError) throw studioError

    const limits: SubscriptionLimits = studio.subscription_limits || {
      max_admins: null,
      max_collaborators: null,
      max_clients: null,
    }

    // Contar miembros actuales por rol
    const { count: adminCount } = await supabaseAdmin
      .from('studio_members')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', studioId)
      .eq('role', 'admin')

    const { count: collaboratorCount } = await supabaseAdmin
      .from('studio_members')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', studioId)
      .eq('role', 'collaborator')

    const { count: clientCount } = await supabaseAdmin
      .from('studio_members')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', studioId)
      .eq('role', 'client')

    const response: SubscriptionLimitsResponse = {
      limits,
      usage: {
        admins: adminCount || 0,
        collaborators: collaboratorCount || 0,
        clients: clientCount || 0,
      },
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Subscription limits GET error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const session = await getStudioFromSession(cookies, request)
    if (!session?.is_superadmin) {
      return new Response(
        JSON.stringify({ error: 'No autorizado. Solo superadmins.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Service key no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { studio_id, limits } = body

    if (!studio_id) {
      return new Response(
        JSON.stringify({ error: 'studio_id es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!limits) {
      return new Response(
        JSON.stringify({ error: 'limits es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validar que los valores sean numbers o null
    const validatedLimits: SubscriptionLimits = {
      max_admins: limits.max_admins === null ? null : Number(limits.max_admins),
      max_collaborators: limits.max_collaborators === null ? null : Number(limits.max_collaborators),
      max_clients: limits.max_clients === null ? null : Number(limits.max_clients),
    }

    // Verificar que los números sean válidos
    if (
      (validatedLimits.max_admins !== null && (isNaN(validatedLimits.max_admins) || validatedLimits.max_admins < 0)) ||
      (validatedLimits.max_collaborators !== null &&
        (isNaN(validatedLimits.max_collaborators) || validatedLimits.max_collaborators < 0)) ||
      (validatedLimits.max_clients !== null && (isNaN(validatedLimits.max_clients) || validatedLimits.max_clients < 0))
    ) {
      return new Response(
        JSON.stringify({ error: 'Los límites deben ser números positivos o null' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar límites
    const { error: updateError } = await supabaseAdmin
      .from('studios')
      .update({ subscription_limits: validatedLimits })
      .eq('id', studio_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Límites actualizados',
        limits: validatedLimits,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Subscription limits PATCH error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
