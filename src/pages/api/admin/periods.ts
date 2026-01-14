import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface PeriodInput {
  id?: string
  code: string
  year: number
  semester: number
  sales_period_start: string | null
  sales_period_end: string | null
  fee_period_start: string | null
  fee_period_end: string | null
  is_active?: boolean
}

// POST - Create or Update period
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
    const period: PeriodInput = body.period
    const isUpdate = !!period.id

    if (isUpdate) {
      const { data, error } = await supabaseAdmin
        .from('reca_periods')
        .update({
          code: period.code,
          year: period.year,
          semester: period.semester,
          sales_period_start: period.sales_period_start,
          sales_period_end: period.sales_period_end,
          fee_period_start: period.fee_period_start,
          fee_period_end: period.fee_period_end,
        })
        .eq('id', period.id)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ success: true, period: data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      const { data, error } = await supabaseAdmin
        .from('reca_periods')
        .insert({
          code: period.code,
          year: period.year,
          semester: period.semester,
          sales_period_start: period.sales_period_start,
          sales_period_end: period.sales_period_end,
          fee_period_start: period.fee_period_start,
          fee_period_end: period.fee_period_end,
          is_active: false,
        })
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ success: true, period: data }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (err: any) {
    console.error('Periods API error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// PATCH - Toggle active status
export const PATCH: APIRoute = async ({ request, cookies }) => {
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
    const { id, is_active } = body

    // Si se está activando, desactivar todos los demás primero
    if (is_active) {
      await supabaseAdmin
        .from('reca_periods')
        .update({ is_active: false })
        .neq('id', id)
    }

    const { data, error } = await supabaseAdmin
      .from('reca_periods')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return new Response(
      JSON.stringify({ success: true, period: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Periods PATCH error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// DELETE - Delete period
export const DELETE: APIRoute = async ({ request, cookies }) => {
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
    const { id } = body

    const { error } = await supabaseAdmin
      .from('reca_periods')
      .delete()
      .eq('id', id)

    if (error) throw error
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Periods DELETE error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
