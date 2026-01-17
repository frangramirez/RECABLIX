import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export interface UserWithRoles {
  id: string
  email: string
  name: string | null
  last_sign_in_at: string | null
  created_at: string
  is_superadmin: boolean
  studios: {
    membership_id: string
    studio_id: string
    studio_name: string
    role: string
    permissions: Record<string, boolean>
  }[]
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar que el usuario es superadmin
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

    // Obtener usuarios de auth.users usando Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000, // Obtener todos (ajustar si hay más usuarios)
    })

    if (authError) {
      console.error('Error fetching auth users:', authError)
      return new Response(
        JSON.stringify({ error: 'Error al obtener usuarios' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const users = authData.users

    // Obtener membresías de studios (incluyendo id y permissions)
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('studio_members')
      .select(`
        id,
        user_id,
        role,
        permissions,
        studio_id,
        studios:studio_id (
          id,
          name
        )
      `)

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError)
    }

    // Obtener superadmins
    const { data: superadmins, error: superadminsError } = await supabaseAdmin
      .from('superadmins')
      .select('user_id')
      .eq('is_active', true)

    if (superadminsError) {
      console.error('Error fetching superadmins:', superadminsError)
    }

    const superadminIds = new Set(superadmins?.map(sa => sa.user_id) || [])

    // Agrupar membresías por usuario
    const membershipsByUser = new Map<string, Array<{
      membership_id: string
      studio_id: string
      studio_name: string
      role: string
      permissions: Record<string, boolean>
    }>>()

    for (const m of memberships || []) {
      // studios puede ser array u objeto dependiendo de la relación
      const studios = m.studios as unknown
      const studioData = (Array.isArray(studios) ? studios[0] : studios) as { id: string; name: string } | null
      if (!studioData) continue

      const userMemberships = membershipsByUser.get(m.user_id) || []
      userMemberships.push({
        membership_id: m.id,
        studio_id: studioData.id,
        studio_name: studioData.name,
        role: m.role,
        permissions: (m.permissions as Record<string, boolean>) || {},
      })
      membershipsByUser.set(m.user_id, userMemberships)
    }

    // Combinar datos
    const usersWithRoles: UserWithRoles[] = users.map(user => ({
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      last_sign_in_at: user.last_sign_in_at || null,
      created_at: user.created_at,
      is_superadmin: superadminIds.has(user.id),
      studios: membershipsByUser.get(user.id) || [],
    }))

    // Ordenar por email
    usersWithRoles.sort((a, b) => a.email.localeCompare(b.email))

    return new Response(JSON.stringify({ users: usersWithRoles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Users API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
