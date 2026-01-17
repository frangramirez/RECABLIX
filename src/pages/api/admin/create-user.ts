import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  CreateUserRequest,
  CreateUserResponse,
  StudioMemberRole,
  SubscriptionLimits,
} from '@/types/subscription'

/**
 * API: /api/admin/create-user
 *
 * POST - Crear usuario directamente con contraseña (superadmin only)
 * - NO envía email de invitación
 * - Marca el email como verificado automáticamente
 * - Opcionalmente crea membresías a estudios
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

    const body: CreateUserRequest = await request.json()
    const { email, password, name, studios } = body

    // Validaciones básicas
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el email no exista
    const { data: existingUsers, error: searchError } = await supabaseAdmin.auth.admin.listUsers()
    if (searchError) throw searchError

    const existingUser = existingUsers.users.find((u) => u.email === email)
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Ya existe un usuario con ese email' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Nota: El tipo CreateUserRequest ya excluye 'owner' como rol válido (Exclude<StudioMemberRole, 'owner'>)
    // TypeScript previene esto en tiempo de compilación

    // Validar límites de subscripción para cada studio
    if (studios && studios.length > 0) {
      for (const studioMembership of studios) {
        const { data: studio, error: studioError } = await supabaseAdmin
          .from('studios')
          .select('subscription_limits')
          .eq('id', studioMembership.studio_id)
          .single()

        if (studioError) {
          return new Response(
            JSON.stringify({ error: `Studio no encontrado: ${studioMembership.studio_id}` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        }

        const limits: SubscriptionLimits = studio.subscription_limits || {
          max_admins: null,
          max_collaborators: null,
          max_clients: null,
        }

        // Contar miembros actuales del rol específico
        const { count } = await supabaseAdmin
          .from('studio_members')
          .select('id', { count: 'exact', head: true })
          .eq('studio_id', studioMembership.studio_id)
          .eq('role', studioMembership.role)

        const currentCount = count || 0

        // Validar límites según el rol
        if (studioMembership.role === 'admin' && limits.max_admins !== null && currentCount >= limits.max_admins) {
          return new Response(
            JSON.stringify({
              error: `Límite de admins alcanzado en studio: ${currentCount}/${limits.max_admins}`,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (
          studioMembership.role === 'collaborator' &&
          limits.max_collaborators !== null &&
          currentCount >= limits.max_collaborators
        ) {
          return new Response(
            JSON.stringify({
              error: `Límite de collaborators alcanzado en studio: ${currentCount}/${limits.max_collaborators}`,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (
          studioMembership.role === 'client' &&
          limits.max_clients !== null &&
          currentCount >= limits.max_clients
        ) {
          return new Response(
            JSON.stringify({
              error: `Límite de clients alcanzado en studio: ${currentCount}/${limits.max_clients}`,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Crear usuario directamente con contraseña
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Marcar email como verificado
      user_metadata: name ? { name } : undefined,
    })

    if (createError) throw createError

    if (!newUser.user) {
      throw new Error('No se pudo crear el usuario')
    }

    const userId = newUser.user.id
    let membershipsCreated = 0

    // Crear membresías a studios
    if (studios && studios.length > 0) {
      for (const studioMembership of studios) {
        const { error: memberError } = await supabaseAdmin.from('studio_members').insert({
          studio_id: studioMembership.studio_id,
          user_id: userId,
          role: studioMembership.role as StudioMemberRole,
        })

        if (memberError) {
          console.error('Error creating membership:', memberError)
          // Continuar con los demás studios
        } else {
          membershipsCreated++
        }
      }
    }

    const response: CreateUserResponse = {
      success: true,
      user_id: userId,
      memberships_created: membershipsCreated,
      message: studios && studios.length > 0
        ? `Usuario creado y agregado a ${membershipsCreated} studio(s)`
        : 'Usuario creado exitosamente',
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Create user error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
