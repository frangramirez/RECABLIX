import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin, createSupabaseServerClient } from '@/lib/supabase'

// GET - Obtener user_id y lista de studios disponibles
export const GET: APIRoute = async ({ request, cookies }) => {
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

    // Obtener user_id desde la sesión autenticada
    const supabase = createSupabaseServerClient(cookies, request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No hay sesión activa' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener lista de studios disponibles
    const { data: studios, error: studiosError } = await supabaseAdmin
      .from('studios')
      .select('id, name, slug')
      .order('name')

    if (studiosError) throw studiosError

    return new Response(
      JSON.stringify({
        user_id: user.id,
        studios: studios || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('My-Studio GET error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// POST - Crear nuevo studio o asociarse a existente
export const POST: APIRoute = async ({ request, cookies }) => {
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

    // Obtener user_id desde la sesión autenticada
    const supabase = createSupabaseServerClient(cookies, request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No hay sesión activa' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { action, name, slug, studio_id } = body

    // ACTION: CREATE - Crear nuevo studio
    if (action === 'create') {
      if (!name?.trim() || !slug?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Nombre y slug son requeridos' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Crear studio
      const { data: newStudio, error: studioError } = await supabaseAdmin
        .from('studios')
        .insert({
          name: name.trim(),
          slug: slug.trim(),
        })
        .select('id')
        .single()

      if (studioError) {
        if (studioError.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'Ya existe un estudio con ese slug' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
        throw studioError
      }

      // Crear membership como owner
      const { error: memberError } = await supabaseAdmin
        .from('studio_members')
        .insert({
          studio_id: newStudio.id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) throw memberError

      return new Response(
        JSON.stringify({ success: true, studio_id: newStudio.id }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ACTION: ASSOCIATE - Asociarse a studio existente
    if (action === 'associate') {
      if (!studio_id) {
        return new Response(
          JSON.stringify({ error: 'Debes seleccionar un estudio' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Verificar si ya es miembro
      const { data: existingMember } = await supabaseAdmin
        .from('studio_members')
        .select('id')
        .eq('studio_id', studio_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'Ya eres miembro de este estudio' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Crear membership como owner (superadmin siempre es owner)
      const { error: memberError } = await supabaseAdmin
        .from('studio_members')
        .insert({
          studio_id: studio_id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) throw memberError

      return new Response(
        JSON.stringify({ success: true, studio_id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('My-Studio POST error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
