import type { APIRoute } from 'astro'
import { renderToBuffer } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { createSupabaseServerClient } from '@/lib/auth'
import {
  calculateRecategorization,
  type ClientData,
  type ClientActivity
} from '@/lib/calculations'
import { ReportTemplate } from '@/lib/pdf/ReportTemplate'

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const studio = locals.studio
  if (!studio) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { clientIds } = await request.json() as { clientIds: string[] }
  if (!clientIds || clientIds.length === 0) {
    return new Response('No clients specified', { status: 400 })
  }

  const supabase = createSupabaseServerClient(cookies)

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

  // Generar PDFs
  const zip = new JSZip()

  for (const clientId of clientIds) {
    // Obtener cliente con datos de reca
    const { data: clientWithData } = await supabase
      .from('clients')
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
      .eq('studio_id', studio.id)
      .single()

    if (!clientWithData) continue

    // Obtener transacciones del periodo
    const { data: txData } = await supabase
      .from('reca_transactions')
      .select('transaction_type, amount')
      .eq('client_id', clientId)
      .gte('period', period.sales_period_start)
      .lte('period', period.sales_period_end)

    const periodSales = txData?.reduce((acc, tx) =>
      tx.transaction_type === 'SALE' ? acc + Number(tx.amount) : acc, 0) || 0

    // Extraer datos de reca_client_data
    const reca = (clientWithData.reca_client_data as any)?.[0] || {}

    // Preparar datos del cliente
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

    try {
      const result = await calculateRecategorization(supabase, period.id, clientData)

      // Consultar si la provincia tiene IIBB integrado
      const { data: ibpComponent } = await supabase
        .from('reca_fee_components')
        .select('has_integrated_iibb')
        .eq('reca_id', period.id)
        .eq('component_type', 'IBP')
        .eq('province_code', reca.province_code || '901')
        .limit(1)
        .single()

      const hasIntegratedIIBB = ibpComponent?.has_integrated_iibb || false

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
            isExempt: reca.is_exempt || false,
            hasMultilateral: reca.has_multilateral || false,
          },
          result,
          scales,
          recaCode: period.code,
          recaYear: period.year,
          recaSemester: period.semester,
          studioName: studio.name,
          periodSales,
          hasIntegratedIIBB,
        })
      )

      const filename = `${clientWithData.name.replace(/\s+/g, '-')}-RECA-${period.code}.pdf`
      zip.file(filename, pdfBuffer)
    } catch (err) {
      console.error(`Error generating PDF for ${clientWithData.name}:`, err)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

  return new Response(zipBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="RECA-${period.code}-${new Date().toISOString().split('T')[0]}.zip"`,
    },
  })
}
