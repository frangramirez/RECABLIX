/**
 * API de Impersonación - Superadmin
 *
 * Permite a superadmin "entrar" a un studio como owner para debugging/soporte
 *
 * POST /api/admin/impersonate - Iniciar impersonación
 * DELETE /api/admin/impersonate - Salir de impersonación
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/impersonate
 * Inicia impersonación de un studio
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    // Solo superadmin puede impersonar
    if (!session?.is_superadmin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { studio_id } = await request.json()

    if (!studio_id) {
      return new Response(JSON.stringify({ error: 'studio_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ error: 'Configuración incorrecta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar que el studio existe
    const { data: studio, error: studioError } = await supabaseAdmin
      .from('studios')
      .select('id, name, slug')
      .eq('id', studio_id)
      .single()

    if (studioError || !studio) {
      return new Response(JSON.stringify({ error: 'Studio no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Setear cookie de impersonación (8 horas)
    cookies.set('impersonating_studio', studio_id, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 horas
    })

    // Log en audit (tabla opcional, puede no existir aún)
    try {
      await supabaseAdmin.from('superadmin_audit_log').insert({
        superadmin_user_id: session.user.id,
        action: 'impersonate_start',
        target_studio_id: studio_id,
        metadata: { studio_name: studio.name },
        created_at: new Date().toISOString(),
      })
    } catch (auditError) {
      // Si la tabla no existe, solo log en consola
      console.warn('Audit log failed (table may not exist):', auditError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        studio: {
          id: studio.id,
          name: studio.name,
          slug: studio.slug,
        },
        redirect: '/studio',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in POST /api/admin/impersonate:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * DELETE /api/admin/impersonate
 * Sale de la impersonación
 */
export const DELETE: APIRoute = async ({ cookies }) => {
  try {
    // Eliminar cookie de impersonación
    cookies.delete('impersonating_studio', { path: '/' })

    // Opcional: log de salida en audit
    // (requeriría obtener la sesión para saber quién está saliendo)

    return new Response(
      JSON.stringify({
        success: true,
        redirect: '/admin',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in DELETE /api/admin/impersonate:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
