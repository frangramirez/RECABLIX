import type { APIRoute } from 'astro'
import { renderToBuffer } from '@react-pdf/renderer'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { config as appConfig } from '@/lib/config'
import { ensureTenantSchema } from '@/lib/tenant'
import {
  calculateRecategorization,
  type ClientData,
  type ClientActivity
} from '@/lib/calculations'
import { ReportTemplate } from '@/lib/pdf/ReportTemplate'

// Configuración de función serverless para Vercel
// @react-pdf/renderer necesita más tiempo y memoria que el default
export const config = {
  maxDuration: 30, // 30 segundos (máximo en Pro)
}

/**
 * Helper para obtener el query builder correcto según el schema
 * @param schemaName - Nombre del schema de tenant (ya validado/creado)
 * @param table - Nombre de la tabla
 */
function getQueryBuilder(schemaName: string, table: string) {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured')

  if (appConfig.USE_TENANT_SCHEMAS && appConfig.TENANT_TABLES.includes(table as any)) {
    return supabaseAdmin.schema(schemaName).from(table)
  }
  return supabaseAdmin.from(table)
}

/**
 * API endpoint para generar PDF de recategorización desde panel Superadmin
 * Permite acceder a cualquier cliente del sistema (no restringido por studio)
 */
export const GET: APIRoute = async ({ params, cookies, request, url }) => {
  // Verificar que es superadmin
  const session = await getStudioFromSession(cookies, request)
  if (!session?.is_superadmin) {
    return new Response('Unauthorized - Solo superadmins', { status: 403 })
  }

  if (!supabaseAdmin) {
    return new Response('Service key no configurada', { status: 500 })
  }

  const { clientId } = params
  if (!clientId) {
    return new Response('Client ID required', { status: 400 })
  }

  // Obtener studioId del query param (requerido para tenant schemas)
  const studioId = url.searchParams.get('studioId')
  if (!studioId) {
    return new Response('studioId query param required', { status: 400 })
  }

  // Asegurar que el tenant schema existe (fallback si el trigger falló)
  const schemaName = await ensureTenantSchema(supabaseAdmin, studioId)

  // Obtener cliente con datos de reca usando tenant schema si está habilitado
  const clientsQuery = getQueryBuilder(schemaName, 'clients')
  const { data: clientWithData, error: clientError } = await clientsQuery
    .select(`
      id, name, cuit, studio_id,
      reca_client_data (
        activity, province_code, works_in_rd, is_retired,
        dependents, local_m2, annual_rent, annual_mw,
        previous_category, previous_fee,
        is_exempt, has_multilateral
      )
    `)
    .eq('id', clientId)
    .single()

  if (clientError || !clientWithData) {
    console.error('[PDF] Client query failed:', { clientError, clientId, schemaName })
    const errorDetail = clientError
      ? `Query error: ${clientError.message}`
      : 'Client not found in tenant schema'
    return new Response(JSON.stringify({
      error: 'Client not found',
      detail: errorDetail,
      hint: 'The tenant schema may not be properly exposed to PostgREST. Try refreshing the page.',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Obtener nombre del studio
  const { data: studio } = await supabaseAdmin
    .from('studios')
    .select('name')
    .eq('id', clientWithData.studio_id)
    .single()

  const studioName = studio?.name || 'Estudio no encontrado'

  // Obtener periodo activo
  const { data: period } = await supabaseAdmin
    .from('reca_periods')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!period) {
    return new Response('No active period', { status: 400 })
  }

  // Obtener escalas
  const { data: scales } = await supabaseAdmin
    .from('reca_scales')
    .select('category, max_annual_income, max_local_m2, max_annual_mw, max_annual_rent')
    .eq('reca_id', period.id)
    .order('category')

  if (!scales) {
    return new Response('No scales found', { status: 400 })
  }

  // Obtener transacciones del periodo (tabla reca_transactions - puede estar en tenant schema)
  const txQuery = getQueryBuilder(schemaName, 'reca_transactions')
  const { data: txData } = await txQuery
    .select('transaction_type, amount')
    .eq('client_id', clientId)
    .gte('period', period.sales_period_start)
    .lte('period', period.sales_period_end)

  const periodSales = txData?.reduce((acc, tx) =>
    tx.transaction_type === 'SALE' ? acc + Number(tx.amount) : acc, 0) || 0

  // Extraer datos de reca_client_data (es un array por el join)
  const reca = (clientWithData.reca_client_data as unknown as Record<string, unknown>[])?.[0] || {}

  // Calcular recategorización
  const clientData: ClientData = {
    id: clientWithData.id,
    name: clientWithData.name,
    activity: (reca.activity as ClientActivity) || 'SERVICIOS',
    provinceCode: (reca.province_code as string) || '901',
    worksInRD: (reca.works_in_rd as boolean) || false,
    isRetired: (reca.is_retired as boolean) || false,
    dependents: (reca.dependents as number) || 0,
    localM2: (reca.local_m2 as number) || null,
    annualRent: (reca.annual_rent as number) || null,
    annualMW: (reca.annual_mw as number) || null,
    periodSales,
    previousCategory: (reca.previous_category as string) || null,
    previousFee: (reca.previous_fee as number) || null,
  }

  const result = await calculateRecategorization(supabaseAdmin, period.id, clientData)

  // Consultar si la provincia tiene IIBB integrado
  // Usar maybeSingle() para evitar error 500 si no existe registro para esta provincia
  const { data: ibpComponent } = await supabaseAdmin
    .from('reca_fee_components')
    .select('has_integrated_iibb')
    .eq('reca_id', period.id)
    .eq('component_type', 'IBP')
    .eq('province_code', (reca.province_code as string) || '901')
    .limit(1)
    .maybeSingle()

  const hasIntegratedIIBB = ibpComponent?.has_integrated_iibb ?? false

  // Generar PDF con manejo de errores
  try {
    const pdfBuffer = await renderToBuffer(
      ReportTemplate({
        client: {
          name: clientWithData.name,
          cuit: clientWithData.cuit,
          activity: (reca.activity as string) || 'SERVICIOS',
          provinceCode: (reca.province_code as string) || '901',
          worksInRD: (reca.works_in_rd as boolean) || false,
          isRetired: (reca.is_retired as boolean) || false,
          localM2: (reca.local_m2 as number) || null,
          annualRent: (reca.annual_rent as number) || null,
          annualMW: (reca.annual_mw as number) || null,
          isExempt: (reca.is_exempt as boolean) || false,
          hasMultilateral: (reca.has_multilateral as boolean) || false,
        },
        result,
        scales,
        recaCode: period.code,
        recaYear: period.year,
        recaSemester: period.semester,
        studioName,
        periodSales,
        hasIntegratedIIBB,
      })
    )

    const filename = `${clientWithData.name.replace(/\s+/g, '-')}-RECA-${period.code}.pdf`

    // Determinar si es descarga o vista inline
    const download = url.searchParams.get('download') === '1'
    const disposition = download ? 'attachment' : 'inline'

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generando PDF:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ error: 'Error generando PDF', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
