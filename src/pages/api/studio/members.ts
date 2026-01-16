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
    const { data: members, error } = await supabaseAdmin
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

    const targetUser = users.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!targetUser) {
      return new Response(
        JSON.stringify({
          error: 'Usuario no encontrado. El email debe corresponder a una cuenta registrada.',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
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

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          ...newMember,
          email: targetUser.email,
        },
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
