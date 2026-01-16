import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantSchemaName } from '@/lib/config'

interface ClientImportRow {
  name: string
  cuit: string | null
  activity: string
  province_code: string
  works_in_rd: boolean
  is_retired: boolean
  dependents: number
  local_m2: number | null
  annual_rent: number | null
  annual_mw: number | null
  previous_category: string | null
  previous_fee: number | null
}

interface ImportRequest {
  studioId: string
  clients: ClientImportRow[]
}

export const POST: APIRoute = async ({ request, cookies }) => {
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

    const body: ImportRequest = await request.json()
    const { studioId, clients } = body

    if (!studioId || !clients || !Array.isArray(clients)) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos: se requiere studioId y array de clients' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que el usuario es miembro del estudio
    const { data: membership } = await supabaseAdmin
      .from('studio_members')
      .select('role')
      .eq('studio_id', studioId)
      .eq('user_id', session.user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: 'No tienes permisos en este estudio' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener el nombre del schema del tenant
    const schemaName = getTenantSchemaName(studioId)

    let success = 0
    let errors: { row: number; error: string }[] = []

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i]

      try {
        // 1. Insert into clients (tenant schema)
        const { data: newClient, error: clientError } = await supabaseAdmin
          .from(`${schemaName}.clients`)
          .insert({
            name: client.name,
            cuit: client.cuit || null,
            apps: ['recablix'],
            fiscal_year: new Date().getFullYear(),
          })
          .select()
          .single()

        if (clientError) {
          errors.push({ row: i + 1, error: `Error creando cliente: ${clientError.message}` })
          continue
        }

        // 2. Insert into reca_client_data (tenant schema)
        const { error: recaError } = await supabaseAdmin
          .from(`${schemaName}.reca_client_data`)
          .insert({
            client_id: newClient.id,
            activity: client.activity || 'SERVICIOS',
            province_code: client.province_code || '901',
            works_in_rd: client.works_in_rd || false,
            is_retired: client.is_retired || false,
            dependents: client.dependents || 0,
            local_m2: client.local_m2,
            annual_rent: client.annual_rent,
            annual_mw: client.annual_mw,
            previous_category: client.previous_category,
            previous_fee: client.previous_fee,
          })

        if (recaError) {
          // Rollback: delete the client
          await supabaseAdmin.from(`${schemaName}.clients`).delete().eq('id', newClient.id)
          errors.push({ row: i + 1, error: `Error guardando datos RECA: ${recaError.message}` })
        } else {
          success++
        }
      } catch (err) {
        errors.push({ row: i + 1, error: `Error inesperado: ${(err as Error).message}` })
      }
    }

    return new Response(
      JSON.stringify({
        success,
        errors,
        total: clients.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (err) {
    console.error('Import API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
