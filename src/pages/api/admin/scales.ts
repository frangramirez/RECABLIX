import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface ScaleInput {
  id?: string
  reca_id: string
  category: string
  max_annual_income: number | null
  max_local_m2: number | null
  max_annual_mw: number | null
  max_annual_rent: number | null
  max_unit_sale: number | null
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

    const body = await request.json()
    const scales: ScaleInput[] = body.scales

    if (!scales || !Array.isArray(scales) || scales.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Datos de escalas inválidos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validar que todas las escalas tienen reca_id
    const recaId = scales[0].reca_id
    if (!recaId || !scales.every(s => s.reca_id === recaId)) {
      return new Response(
        JSON.stringify({ error: 'Todas las escalas deben tener el mismo período' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Upsert de escalas usando supabaseAdmin (bypassa RLS)
    const { data, error } = await supabaseAdmin.from('reca_scales').upsert(
      scales.map((s) => ({
        id: s.id,
        reca_id: s.reca_id,
        category: s.category,
        max_annual_income: s.max_annual_income,
        max_local_m2: s.max_local_m2,
        max_annual_mw: s.max_annual_mw,
        max_annual_rent: s.max_annual_rent,
        max_unit_sale: s.max_unit_sale,
      })),
      {
        onConflict: 'reca_id,category',
      }
    ).select()

    if (error) {
      console.error('Error saving scales:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, scales: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Scales API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
