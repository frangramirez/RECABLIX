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
  // Fee components (se guardan en reca_fee_components)
  fee_s20?: number | null  // Imp. Servicios
  fee_b20?: number | null  // Imp. Vta.Bienes
  fee_021?: number | null  // Aporte SIPA
  fee_024?: number | null  // Aporte OS
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

    // ────────────────────────────────────────────────────────────
    // Guardar componentes de cuota (IMP, JUB, OS)
    // ────────────────────────────────────────────────────────────
    const feeComponents: Array<{
      reca_id: string
      component_code: string
      description: string
      component_type: 'IMP' | 'JUB' | 'OS'
      category: string
      value: number
    }> = []

    // Obtener valor de 021 Cat. A para usarlo en 21J
    const scale021CatA = scales.find(s => s.category === 'A')
    const value021CatA = scale021CatA?.fee_021 ?? null

    for (const scale of scales) {
      const { category } = scale

      // S20 - Imp. Servicios
      if (scale.fee_s20 !== null && scale.fee_s20 !== undefined) {
        feeComponents.push({
          reca_id: recaId,
          component_code: 'S20',
          description: 'Impuesto Integrado',
          component_type: 'IMP',
          category,
          value: scale.fee_s20,
        })
      }

      // B20 - Imp. Vta.Bienes
      if (scale.fee_b20 !== null && scale.fee_b20 !== undefined) {
        feeComponents.push({
          reca_id: recaId,
          component_code: 'B20',
          description: 'Impuesto Integrado',
          component_type: 'IMP',
          category,
          value: scale.fee_b20,
        })
      }

      // 021 - Aporte SIPA
      if (scale.fee_021 !== null && scale.fee_021 !== undefined) {
        feeComponents.push({
          reca_id: recaId,
          component_code: '021',
          description: 'Aporte SIPA',
          component_type: 'JUB',
          category,
          value: scale.fee_021,
        })
      }

      // 21J - Jubilatorio Jubilado (SIEMPRE usa valor de 021 Cat. A)
      if (value021CatA !== null) {
        feeComponents.push({
          reca_id: recaId,
          component_code: '21J',
          description: 'Jubilatorio (aporte mínimo)',
          component_type: 'JUB',
          category,
          value: value021CatA,
        })
      }

      // 024 - Aporte OS
      if (scale.fee_024 !== null && scale.fee_024 !== undefined) {
        feeComponents.push({
          reca_id: recaId,
          component_code: '024',
          description: 'Aporte Obra Social',
          component_type: 'OS',
          category,
          value: scale.fee_024,
        })
      }
    }

    // Upsert de fee components (si hay alguno)
    if (feeComponents.length > 0) {
      const { error: feeError } = await supabaseAdmin
        .from('reca_fee_components')
        .upsert(feeComponents, {
          onConflict: 'reca_id,component_code,category',
        })

      if (feeError) {
        console.error('Error saving fee components:', feeError)
        return new Response(
          JSON.stringify({ error: feeError.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
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
