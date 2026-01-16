/**
 * API Route: Crear Clientes
 *
 * POST /api/clients - Crea un nuevo cliente usando supabaseAdmin para bypass RLS
 * Necesario porque auth.uid() puede ser NULL en sesiones de superadmin/impersonación
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { config, getTenantSchemaName } from '@/lib/config'

interface ClientInput {
  name: string
  cuit: string | null
  uses_recablix: boolean
  activity: 'BIENES' | 'SERVICIOS' | 'LOCACION' | 'SOLO_LOC_2_INM'
  province_code: string
  works_in_rd: boolean
  is_retired: boolean
  dependents: number
  is_exempt: boolean
  has_multilateral: boolean
  has_local: boolean
  is_rented: boolean
  landlord_cuit: string | null
  local_m2: number | null
  annual_rent: number | null
  annual_mw: number | null
  previous_category: string | null
  previous_fee: number | null
}

/**
 * POST /api/clients
 * Crea un nuevo cliente y su registro reca_client_data
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!session.studio?.id) {
      return new Response(JSON.stringify({ error: 'No hay studio activo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Service key no configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const input: ClientInput = await request.json()
    const studioId = session.studio.id

    // Determinar si usar tenant schema o public
    const useTenantSchemas = config.USE_TENANT_SCHEMAS
    const tenantSchema = useTenantSchemas
      ? getTenantSchemaName(studioId)
      : null

    // Preparar datos del cliente
    const clientData = useTenantSchemas
      ? {
          // En tenant schema no hay studio_id (aislamiento por schema)
          name: input.name,
          cuit: input.cuit?.trim() || null,
          apps: input.uses_recablix ? ['recablix'] : [],
          fiscal_year: new Date().getFullYear(),
        }
      : {
          studio_id: studioId,
          name: input.name,
          cuit: input.cuit?.trim() || null,
          apps: input.uses_recablix ? ['recablix'] : [],
          fiscal_year: new Date().getFullYear(),
        }

    // Insertar cliente
    let newClient: { id: string } | null = null
    let clientError: Error | null = null

    if (tenantSchema) {
      const result = await supabaseAdmin
        .schema(tenantSchema)
        .from('clients')
        .insert(clientData)
        .select('id')
        .single()

      newClient = result.data
      clientError = result.error
    } else {
      const result = await supabaseAdmin
        .from('clients')
        .insert(clientData)
        .select('id')
        .single()

      newClient = result.data
      clientError = result.error
    }

    if (clientError || !newClient) {
      console.error('Error creando cliente:', clientError)
      return new Response(
        JSON.stringify({ error: clientError?.message || 'Error al crear cliente' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Preparar datos de reca_client_data
    const recaData = {
      client_id: newClient.id,
      activity: input.activity,
      province_code: input.province_code,
      works_in_rd: input.works_in_rd,
      is_retired: input.is_retired,
      dependents: input.dependents,
      is_exempt: input.is_exempt,
      has_multilateral: input.has_multilateral,
      has_local: input.has_local,
      is_rented: input.is_rented,
      landlord_cuit: input.landlord_cuit?.trim() || null,
      local_m2: input.local_m2,
      annual_rent: input.annual_rent,
      annual_mw: input.annual_mw,
      previous_category: input.previous_category,
      previous_fee: input.previous_fee,
    }

    // Insertar reca_client_data
    let recaError: Error | null = null

    if (tenantSchema) {
      const result = await supabaseAdmin
        .schema(tenantSchema)
        .from('reca_client_data')
        .insert(recaData)

      recaError = result.error
    } else {
      const result = await supabaseAdmin
        .from('reca_client_data')
        .insert(recaData)

      recaError = result.error
    }

    if (recaError) {
      console.error('Error creando reca_client_data:', recaError)
      // Intentar eliminar el cliente creado para mantener consistencia
      if (tenantSchema) {
        await supabaseAdmin
          .schema(tenantSchema)
          .from('clients')
          .delete()
          .eq('id', newClient.id)
      } else {
        await supabaseAdmin.from('clients').delete().eq('id', newClient.id)
      }

      return new Response(
        JSON.stringify({ error: recaError.message || 'Error al crear datos de recategorización' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ data: { id: newClient.id }, message: 'Cliente creado correctamente' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error en POST /api/clients:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
