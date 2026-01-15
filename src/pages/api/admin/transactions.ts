import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { config, getTenantSchemaName } from '@/lib/config'

export interface TransactionWithClient {
  id: string
  client_id: string
  client_name: string
  client_cuit: string | null
  transaction_type: 'SALE' | 'PURCHASE'
  period: string
  amount: number
  transaction_date: string | null
  description: string | null
}

/**
 * Helper para obtener el query builder correcto según el schema
 */
function getQueryBuilder(studioId: string, table: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured')

  if (config.USE_TENANT_SCHEMAS && config.TENANT_TABLES.includes(table as any)) {
    const schemaName = getTenantSchemaName(studioId)
    return supabaseAdmin.schema(schemaName).from(table)
  }
  return supabaseAdmin.from(table)
}

export const GET: APIRoute = async ({ request, cookies, url }) => {
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

    const studioId = url.searchParams.get('studioId')
    if (!studioId) {
      return new Response(
        JSON.stringify({ error: 'studioId requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener período activo (siempre en public)
    const { data: activePeriod } = await supabaseAdmin
      .from('reca_periods')
      .select('sales_period_start, sales_period_end')
      .eq('is_active', true)
      .single()

    // Obtener clientes del estudio con recablix (puede estar en tenant schema)
    const clientsQuery = getQueryBuilder(studioId, 'clients')
    const { data: clients } = await clientsQuery
      .select('id, name, cuit')
      .contains('apps', ['recablix'])
      .order('name')

    const clientIds = clients?.map(c => c.id) || []
    const clientMap = new Map(clients?.map(c => [c.id, { name: c.name, cuit: c.cuit }]) || [])

    if (clientIds.length === 0) {
      return new Response(JSON.stringify({
        transactions: [],
        clients: [],
        activePeriod,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Obtener transacciones (puede estar en tenant schema)
    const txQuery = getQueryBuilder(studioId, 'reca_transactions')
    const { data: transactions, error } = await txQuery
      .select('*')
      .in('client_id', clientIds)
      .order('period', { ascending: false })
      .order('transaction_date', { ascending: false })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const transactionsWithClient: TransactionWithClient[] = (transactions || []).map(tx => ({
      ...tx,
      client_name: clientMap.get(tx.client_id)?.name || 'Desconocido',
      client_cuit: clientMap.get(tx.client_id)?.cuit || null,
    }))

    return new Response(JSON.stringify({
      transactions: transactionsWithClient,
      clients: clients || [],
      activePeriod,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Transactions API error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
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
    const { action, data, id, transactions: bulkTransactions, studioId } = body

    // Para operaciones que necesiten tenant schema, necesitamos el studioId
    // Lo obtenemos del client_id de la transacción si no viene directo
    let effectiveStudioId = studioId

    if (!effectiveStudioId && data?.client_id) {
      // Buscar el studio del cliente
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('studio_id')
        .eq('id', data.client_id)
        .single()
      effectiveStudioId = client?.studio_id
    }

    if (!effectiveStudioId && bulkTransactions?.[0]?.client_id) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('studio_id')
        .eq('id', bulkTransactions[0].client_id)
        .single()
      effectiveStudioId = client?.studio_id
    }

    if (!effectiveStudioId && id) {
      // Para update/delete, buscar el studio de la transacción existente
      const { data: tx } = await supabaseAdmin
        .from('reca_transactions')
        .select('client_id')
        .eq('id', id)
        .single()
      if (tx) {
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('studio_id')
          .eq('id', tx.client_id)
          .single()
        effectiveStudioId = client?.studio_id
      }
    }

    // Fallback: usar public schema si no tenemos studioId
    const getQuery = (table: string) => {
      if (effectiveStudioId && config.USE_TENANT_SCHEMAS && config.TENANT_TABLES.includes(table as any)) {
        const schemaName = getTenantSchemaName(effectiveStudioId)
        return supabaseAdmin!.schema(schemaName).from(table)
      }
      return supabaseAdmin!.from(table)
    }

    if (action === 'create') {
      const { error } = await getQuery('reca_transactions').insert(data)
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else if (action === 'update') {
      const { error } = await getQuery('reca_transactions').update(data).eq('id', id)
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else if (action === 'delete') {
      const { error } = await getQuery('reca_transactions').delete().eq('id', id)
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else if (action === 'bulk_create') {
      const { error } = await getQuery('reca_transactions').insert(bulkTransactions)
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Transactions API POST error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
