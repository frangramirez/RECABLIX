import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gestión de superadmins
 *
 * POST: Agregar o remover superadmin
 * Body: { user_id: string, action: 'add' | 'remove' }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar que el usuario actual es superadmin
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

    const body = await request.json()
    const { user_id, action } = body

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: 'user_id y action son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (action !== 'add' && action !== 'remove') {
      return new Response(
        JSON.stringify({ error: 'action debe ser "add" o "remove"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // No permitir que un superadmin se quite a sí mismo
    if (action === 'remove' && user_id === session.user_id) {
      return new Response(
        JSON.stringify({ error: 'No podés removerte como superadmin a vos mismo' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'add') {
      // Verificar si ya existe (activo o no)
      const { data: existing } = await supabaseAdmin
        .from('superadmins')
        .select('id, is_active')
        .eq('user_id', user_id)
        .maybeSingle()

      if (existing) {
        if (existing.is_active) {
          return new Response(
            JSON.stringify({ error: 'El usuario ya es superadmin' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Reactivar superadmin existente
        const { error: updateError } = await supabaseAdmin
          .from('superadmins')
          .update({
            is_active: true,
            granted_by: session.user_id,
            granted_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Error reactivating superadmin:', updateError)
          return new Response(
            JSON.stringify({ error: 'Error al reactivar superadmin' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Crear nuevo superadmin
        const { error: insertError } = await supabaseAdmin
          .from('superadmins')
          .insert({
            user_id,
            granted_by: session.user_id,
            is_active: true,
          })

        if (insertError) {
          console.error('Error creating superadmin:', insertError)
          return new Response(
            JSON.stringify({ error: 'Error al crear superadmin' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuario agregado como superadmin' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )

    } else {
      // action === 'remove'
      const { error: removeError } = await supabaseAdmin
        .from('superadmins')
        .update({ is_active: false })
        .eq('user_id', user_id)

      if (removeError) {
        console.error('Error removing superadmin:', removeError)
        return new Response(
          JSON.stringify({ error: 'Error al remover superadmin' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Superadmin removido' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

  } catch (err) {
    console.error('Superadmins API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
