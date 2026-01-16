import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface FeeComponentInput {
  id?: string
  reca_id: string
  component_code: string
  description: string | null
  component_type: 'IMP' | 'JUB' | 'OS' | 'IBP'
  category: string
  value: number | null
  province_code: string | null
  has_municipal: boolean
  has_integrated_iibb: boolean
}

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

    const body = await request.json()
    const components: FeeComponentInput[] = body.components

    if (!components || !Array.isArray(components)) {
      return new Response(
        JSON.stringify({ error: 'Datos de componentes inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validación defensiva: filtrar componentes con value válido
    // Frontend envía 0 para componentes sin valor pero con checkboxes activos
    const recordsToUpsert = components
      .filter((c) => typeof c.value === 'number' && !isNaN(c.value))
      .map((c) => ({
        reca_id: c.reca_id,
        component_code: c.component_code,
        description: c.description,
        component_type: c.component_type,
        category: c.category,
        value: c.value,
        province_code: c.province_code,
        has_municipal: c.has_municipal ?? false,
        has_integrated_iibb: c.has_integrated_iibb ?? false,
      }))

    if (recordsToUpsert.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No hay componentes para guardar', components: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('reca_fee_components')
      .upsert(recordsToUpsert, {
        onConflict: 'reca_id,component_code,category',
      })
      .select()

    if (error) {
      console.error('Error saving fee components:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, components: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor'
    console.error('Fees API error:', err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
