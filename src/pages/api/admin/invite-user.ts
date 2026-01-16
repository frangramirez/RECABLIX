import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'
import type {
  InviteUserRequest,
  InviteUserResponse,
  StudioMemberRole,
  SubscriptionLimits,
} from '@/types/subscription'

/**
 * API: /api/admin/invite-user
 *
 * POST - Invitar usuario por email (superadmin only)
 * - Busca si usuario existe en auth.users
 * - Si no existe: crea via inviteUserByEmail (envía email automático)
 * - Si hay studio_id: verifica límites y crea studio_member
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

    const body: InviteUserRequest = await request.json()
    const { email, studio_id, role } = body

    // Validaciones básicas
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (studio_id && !role) {
      return new Response(
        JSON.stringify({ error: 'Debe especificar un rol si agrega a studio' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (role === 'owner') {
      return new Response(
        JSON.stringify({ error: 'No se puede invitar como owner. Solo hay 1 owner por studio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Buscar si el usuario ya existe en auth.users
    const { data: existingUsers, error: searchError } = await supabaseAdmin.auth.admin.listUsers()

    if (searchError) throw searchError

    const existingUser = existingUsers.users.find((u) => u.email === email)

    let userId: string
    let userCreated = false
    let invitationSent = false

    if (existingUser) {
      // Usuario ya existe
      userId = existingUser.id
    } else {
      // Usuario no existe, crear e invitar via email
      const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${new URL(request.url).origin}/auth/confirm`,
      })

      if (inviteError) throw inviteError

      if (!newUser.user) {
        throw new Error('No se pudo crear el usuario')
      }

      userId = newUser.user.id
      userCreated = true
      invitationSent = true
    }

    let studioMemberCreated = false

    // Si se especificó studio_id, agregar como miembro
    if (studio_id && role) {
      // Verificar límites de subscripción
      const { data: studio, error: studioError } = await supabaseAdmin
        .from('studios')
        .select('subscription_limits')
        .eq('id', studio_id)
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
        .eq('studio_id', studio_id)
        .eq('role', 'admin')

      const { count: collaboratorCount } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studio_id)
        .eq('role', 'collaborator')

      const { count: clientCount } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studio_id)
        .eq('role', 'client')

      // Validar límites
      const currentCounts = {
        admin: adminCount || 0,
        collaborator: collaboratorCount || 0,
        client: clientCount || 0,
      }

      if (role === 'admin' && limits.max_admins !== null && currentCounts.admin >= limits.max_admins) {
        return new Response(
          JSON.stringify({
            error: `Límite de admins alcanzado: ${currentCounts.admin}/${limits.max_admins}`,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (
        role === 'collaborator' &&
        limits.max_collaborators !== null &&
        currentCounts.collaborator >= limits.max_collaborators
      ) {
        return new Response(
          JSON.stringify({
            error: `Límite de collaborators alcanzado: ${currentCounts.collaborator}/${limits.max_collaborators}`,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (role === 'client' && limits.max_clients !== null && currentCounts.client >= limits.max_clients) {
        return new Response(
          JSON.stringify({
            error: `Límite de clients alcanzado: ${currentCounts.client}/${limits.max_clients}`,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Verificar si ya es miembro
      const { data: existingMember } = await supabaseAdmin
        .from('studio_members')
        .select('id')
        .eq('studio_id', studio_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existingMember) {
        // Crear studio_member
        const { error: memberError } = await supabaseAdmin.from('studio_members').insert({
          studio_id,
          user_id: userId,
          role: role as StudioMemberRole,
        })

        if (memberError) throw memberError

        studioMemberCreated = true
      }
    }

    const response: InviteUserResponse = {
      success: true,
      user_id: userId,
      user_created: userCreated,
      invitation_sent: invitationSent,
      studio_member_created: studioMemberCreated,
      message: userCreated
        ? 'Usuario creado e invitación enviada por email'
        : studioMemberCreated
          ? 'Usuario agregado al studio'
          : 'Usuario ya existía',
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Invite user error:', err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
