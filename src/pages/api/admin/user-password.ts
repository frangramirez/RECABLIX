import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { SetPasswordRequest, SetPasswordResponse } from '@/types/subscription'

/**
 * API: /api/admin/user-password
 *
 * POST - Establecer/cambiar contraseña de un usuario existente (superadmin only)
 * - Usa updateUserById para cambiar la contraseña directamente
 * - NO envía notificación al usuario
 */

export const POST: APIRoute = async ({ request, cookies }) => {
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

    const body: SetPasswordRequest = await request.json()
    const { user_id, password } = body

    // Validaciones básicas
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id es requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el usuario existe
    const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (getUserError || !existingUser.user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar contraseña
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password,
    })

    if (updateError) throw updateError

    const response: SetPasswordResponse = {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Set password error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
