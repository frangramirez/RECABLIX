/**
 * API Route: Gestión de Miembros del Studio
 *
 * GET /api/studio/members?studio_id=xxx
 * Retorna lista de miembros con sus permisos
 *
 * POST /api/studio/members
 * Agrega un nuevo miembro al studio
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { SubscriptionLimits } from '@/types/subscription'

export const GET: APIRoute = async ({ url, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Service key no configurada' }), {
        status: 500,
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

    // Superadmin puede ver cualquier studio, usuarios normales solo el suyo
    if (!session.is_superadmin && studioId !== session.studio.id) {
      return new Response(
        JSON.stringify({ error: 'No tiene acceso a este studio' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Usar supabaseAdmin para bypasear RLS (especialmente para superadmins viendo otros studios)
    // No podemos hacer join con auth.users desde PostgREST (diferente schema)
    const { data: members, error } = await supabaseAdmin
      .from('studio_members')
      .select('id, user_id, role, permissions, created_at')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener emails de auth.users usando Admin API
    const userIds = members?.map(m => m.user_id) || []
    let userEmails: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      if (authUsers?.users) {
        userEmails = authUsers.users.reduce((acc, user) => {
          if (user.email && userIds.includes(user.id)) {
            acc[user.id] = user.email
          }
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Combinar miembros con emails
    const membersWithEmails = (members || []).map(member => ({
      ...member,
      users: { email: userEmails[member.user_id] || 'Sin email' },
    }))

    return new Response(JSON.stringify({ members: membersWithEmails }), {
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

/**
 * POST /api/studio/members
 * Agrega un nuevo miembro al studio por email
 *
 * Body: { studio_id: string, email: string, role: string }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    // Debe tener sesión activa
    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Service key no configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Solo owners/admins/superadmins pueden agregar miembros
    const canAdd =
      session.is_superadmin || session.role === 'owner' || session.role === 'admin'

    if (!canAdd) {
      return new Response(
        JSON.stringify({ error: 'No tiene permiso para agregar miembros' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const body = await request.json()
    const { studio_id, email, role } = body

    if (!studio_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'studio_id, email y role son requeridos' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validar rol
    const validRoles = ['admin', 'collaborator', 'client']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({
          error: `Rol inválido. Opciones: ${validRoles.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Buscar usuario por email usando supabaseAdmin (acceso a auth.users)
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()

    if (userError) {
      console.error('Error listing users:', userError)
      return new Response(
        JSON.stringify({ error: 'Error al buscar usuario' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let targetUser = users.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userCreated = false
    let invitationSent = false

    // Si el usuario no existe, crearlo e invitar por email
    if (!targetUser) {
      try {
        const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${new URL(request.url).origin}/auth/confirm`,
        })

        if (inviteError) {
          console.error('Error inviting user:', inviteError)
          return new Response(
            JSON.stringify({ error: `Error al invitar usuario: ${inviteError.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (!newUser.user) {
          return new Response(
            JSON.stringify({ error: 'No se pudo crear el usuario' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        targetUser = newUser.user
        userCreated = true
        invitationSent = true
      } catch (err) {
        console.error('Error creating user:', err)
        return new Response(
          JSON.stringify({ error: 'Error al crear usuario' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verificar que no sea ya miembro del studio
    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('studio_members')
      .select('id, role')
      .eq('studio_id', studio_id)
      .eq('user_id', targetUser.id)
      .maybeSingle()

    if (memberCheckError) {
      console.error('Error checking existing member:', memberCheckError)
      return new Response(
        JSON.stringify({ error: 'Error al verificar membresía existente' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (existingMember) {
      return new Response(
        JSON.stringify({
          error: `El usuario ya es miembro de este studio con rol: ${existingMember.role}`,
        }),
        {
          status: 409, // Conflict
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Verificar límites de subscripción antes de agregar
    const { data: studio, error: studioError } = await supabaseAdmin
      .from('studios')
      .select('subscription_limits')
      .eq('id', studio_id)
      .single()

    if (studioError) {
      console.error('Error fetching studio limits:', studioError)
      return new Response(
        JSON.stringify({ error: 'Error al verificar límites del studio' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const limits: SubscriptionLimits = studio.subscription_limits || {
      max_admins: null,
      max_collaborators: null,
      max_clients: null,
    }

    // Contar miembros actuales por rol solo si hay límite configurado
    let currentCount = 0
    let limitReached = false
    let limitMessage = ''

    if (role === 'admin' && limits.max_admins !== null) {
      const { count } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studio_id)
        .eq('role', 'admin')

      currentCount = count || 0
      if (currentCount >= limits.max_admins) {
        limitReached = true
        limitMessage = `Límite de admins alcanzado: ${currentCount}/${limits.max_admins}`
      }
    } else if (role === 'collaborator' && limits.max_collaborators !== null) {
      const { count } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studio_id)
        .eq('role', 'collaborator')

      currentCount = count || 0
      if (currentCount >= limits.max_collaborators) {
        limitReached = true
        limitMessage = `Límite de collaborators alcanzado: ${currentCount}/${limits.max_collaborators}`
      }
    } else if (role === 'client' && limits.max_clients !== null) {
      const { count } = await supabaseAdmin
        .from('studio_members')
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studio_id)
        .eq('role', 'client')

      currentCount = count || 0
      if (currentCount >= limits.max_clients) {
        limitReached = true
        limitMessage = `Límite de clients alcanzado: ${currentCount}/${limits.max_clients}`
      }
    }

    if (limitReached) {
      return new Response(
        JSON.stringify({ error: limitMessage }),
        {
          status: 403, // Forbidden
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Crear el nuevo miembro
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('studio_members')
      .insert({
        studio_id,
        user_id: targetUser.id,
        role,
        permissions: {},
      })
      .select('id, role, created_at')
      .single()

    if (insertError) {
      console.error('Error inserting member:', insertError)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Construir mensaje apropiado
    let message = 'Miembro agregado correctamente'
    if (userCreated && invitationSent) {
      message = 'Usuario creado e invitación enviada por email. Se agregó como miembro.'
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          ...newMember,
          email: targetUser.email,
        },
        user_created: userCreated,
        invitation_sent: invitationSent,
        message,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in POST /api/studio/members:', error)
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
