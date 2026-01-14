import type { APIRoute } from 'astro'
import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseServerClient } from '@/lib/auth'
import {
  calculateRecategorization,
  type ClientData,
  type ClientActivity
} from '@/lib/calculations'
import { ReportTemplate } from '@/lib/pdf/ReportTemplate'

export const GET: APIRoute = async ({ params, cookies, locals, url }) => {
  const studio = locals.studio
  if (!studio) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { clientId } = params
  if (!clientId) {
    return new Response('Client ID required', { status: 400 })
  }

  const supabase = createSupabaseServerClient(cookies)

  // Obtener cliente con datos de reca
  const { data: clientWithData, error: clientError } = await supabase
    .from('clients')
    .select(`
      id, name, cuit, studio_id,
      reca_client_data (
        activity, province_code, works_in_rd, is_retired,
        dependents, local_m2, annual_rent, annual_mw,
        previous_category, previous_fee
      )
    `)
    .eq('id', clientId)
    .eq('studio_id', studio.id)
    .single()

  if (clientError || !clientWithData) {
    return new Response('Client not found', { status: 404 })
  }

  // Obtener periodo activo
  const { data: period } = await supabase
    .from('reca_periods')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!period) {
    return new Response('No active period', { status: 400 })
  }

  // Obtener escalas
  const { data: scales } = await supabase
    .from('scales')
    .select('category, max_annual_income, max_local_m2, max_annual_mw, max_annual_rent')
    .eq('reca_id', period.id)
    .order('category')

  if (!scales) {
    return new Response('No scales found', { status: 400 })
  }

  // Obtener transacciones del periodo (tabla reca_transactions)
  const { data: txData } = await supabase
    .from('reca_transactions')
    .select('transaction_type, amount')
    .eq('client_id', clientId)
    .gte('period', period.sales_period_start)
    .lte('period', period.sales_period_end)

  const periodSales = txData?.reduce((acc, tx) =>
    tx.transaction_type === 'SALE' ? acc + Number(tx.amount) : acc, 0) || 0

  // Extraer datos de reca_client_data (es un array por el join)
  const reca = (clientWithData.reca_client_data as any)?.[0] || {}

  // Calcular recategorizacion
  const clientData: ClientData = {
    id: clientWithData.id,
    name: clientWithData.name,
    activity: (reca.activity as ClientActivity) || 'SERVICIOS',
    provinceCode: reca.province_code || '901',
    worksInRD: reca.works_in_rd || false,
    isRetired: reca.is_retired || false,
    dependents: reca.dependents || 0,
    localM2: reca.local_m2 || null,
    annualRent: reca.annual_rent || null,
    annualMW: reca.annual_mw || null,
    periodSales,
    previousCategory: reca.previous_category || null,
    previousFee: reca.previous_fee || null,
  }

  const result = await calculateRecategorization(supabase, period.id, clientData)

  // Generar PDF
  const pdfBuffer = await renderToBuffer(
    ReportTemplate({
      client: {
        name: clientWithData.name,
        cuit: clientWithData.cuit,
        activity: reca.activity || 'SERVICIOS',
        provinceCode: reca.province_code || '901',
        worksInRD: reca.works_in_rd || false,
        isRetired: reca.is_retired || false,
        localM2: reca.local_m2 || null,
        annualRent: reca.annual_rent || null,
        annualMW: reca.annual_mw || null,
      },
      result,
      scales,
      recaCode: period.code,
      recaYear: period.year,
      recaSemester: period.semester,
      studioName: studio.name,
      periodSales,
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
}
