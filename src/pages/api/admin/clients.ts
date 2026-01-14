import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export interface GlobalClient {
  id: string
  name: string
  cuit: string | null
  studio_id: string
  studio_name: string
  activity: string | null
  province_code: string | null
  previous_category: string | null
  new_category: string | null
  period_sales: number | null
  period_purchases: number | null
}

export const GET: APIRoute = async ({ request, cookies, url }) => {
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

    // Obtener filtros de query params
    const studioFilter = url.searchParams.get('studio')
    const categoryFilter = url.searchParams.get('category')
    const searchFilter = url.searchParams.get('search')

    // Obtener período activo
    const { data: activePeriod } = await supabaseAdmin
      .from('reca_periods')
      .select('id, code, sales_period_start, sales_period_end')
      .eq('is_active', true)
      .single()

    if (!activePeriod) {
      return new Response(
        JSON.stringify({ error: 'No hay período activo configurado', clients: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Query principal usando la vista reca_results
    let query = supabaseAdmin
      .from('reca_results')
      .select(`
        client_id,
        name,
        cuit,
        studio_id,
        activity,
        province_code,
        previous_category,
        new_category,
        period_sales
      `)

    // La vista reca_results ya filtra por período activo y apps contiene 'recablix'

    const { data: results, error: resultsError } = await query

    if (resultsError) {
      console.error('Error fetching reca_results:', resultsError)
      return new Response(
        JSON.stringify({ error: 'Error al obtener datos de recategorización' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener nombres de estudios
    const studioIds = [...new Set(results?.map(r => r.studio_id) || [])]
    const { data: studios } = await supabaseAdmin
      .from('studios')
      .select('id, name')
      .in('id', studioIds)

    const studioMap = new Map(studios?.map(s => [s.id, s.name]) || [])

    // Obtener compras del período para cada cliente
    const clientIds = results?.map(r => r.client_id) || []

    let purchasesMap = new Map<string, number>()
    if (clientIds.length > 0 && activePeriod) {
      const { data: purchases } = await supabaseAdmin
        .from('reca_transactions')
        .select('client_id, amount')
        .in('client_id', clientIds)
        .eq('transaction_type', 'PURCHASE')
        .gte('period', activePeriod.sales_period_start)
        .lte('period', activePeriod.sales_period_end)

      // Sumar compras por cliente
      for (const p of purchases || []) {
        const current = purchasesMap.get(p.client_id) || 0
        purchasesMap.set(p.client_id, current + Number(p.amount))
      }
    }

    // Combinar datos
    let clients: GlobalClient[] = (results || []).map(r => ({
      id: r.client_id,
      name: r.name,
      cuit: r.cuit,
      studio_id: r.studio_id,
      studio_name: studioMap.get(r.studio_id) || 'Sin estudio',
      activity: r.activity,
      province_code: r.province_code,
      previous_category: r.previous_category,
      new_category: r.new_category,
      period_sales: r.period_sales ? Number(r.period_sales) : null,
      period_purchases: purchasesMap.get(r.client_id) || null,
    }))

    // Aplicar filtros
    if (studioFilter) {
      clients = clients.filter(c => c.studio_id === studioFilter)
    }

    if (categoryFilter) {
      clients = clients.filter(c => c.new_category === categoryFilter)
    }

    if (searchFilter) {
      const search = searchFilter.toLowerCase()
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(search) ||
        (c.cuit && c.cuit.includes(search))
      )
    }

    // Ordenar por estudio y nombre
    clients.sort((a, b) => {
      const studioCompare = a.studio_name.localeCompare(b.studio_name)
      if (studioCompare !== 0) return studioCompare
      return a.name.localeCompare(b.name)
    })

    // Obtener lista de estudios para filtros
    const studiosForFilter = [...new Set(clients.map(c => c.studio_id))]
      .map(id => ({
        id,
        name: studioMap.get(id) || 'Sin estudio'
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return new Response(JSON.stringify({
      clients,
      studios: studiosForFilter,
      period: {
        code: activePeriod.code,
        sales_start: activePeriod.sales_period_start,
        sales_end: activePeriod.sales_period_end,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Clients API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
