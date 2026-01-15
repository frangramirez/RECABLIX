/**
 * API Route: Gestión de Clientes
 *
 * Ejemplo de uso del sistema de permisos granulares
 */

import type { APIRoute } from 'astro'
import { getStudioFromSession } from '@/lib/auth'
import { checkPermission, requirePermission } from '@/lib/permissions'
import { tenantFrom, deleteFromTenant, TENANT_TABLES } from '@/lib/tenant'
import { createSupabaseServerClient } from '@/lib/supabase'

/**
 * GET /api/clients/[id]
 * Obtiene un cliente específico
 * Requiere: estar autenticado en el studio
 */
export const GET: APIRoute = async ({ params, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createSupabaseServerClient(cookies, request)

    // Query usando el tenant schema
    const { data: client, error } = await tenantFrom(
      supabase,
      session.tenant_schema,
      TENANT_TABLES.CLIENTS
    )
      .select('*')
      .eq('id', id)
      .single()

    if (error || !client) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data: client }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error en GET /api/clients/[id]:', error)
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
 * DELETE /api/clients/[id]
 * Elimina un cliente
 * Requiere: permiso can_delete_clients
 */
export const DELETE: APIRoute = async ({ params, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verificar permiso para eliminar clientes
    if (!checkPermission(session, 'can_delete_clients')) {
      return new Response(
        JSON.stringify({
          error: 'No tiene permiso para eliminar clientes',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createSupabaseServerClient(cookies, request)

    // Eliminar del tenant schema
    const { error } = await deleteFromTenant(
      supabase,
      session.tenant_schema,
      TENANT_TABLES.CLIENTS
    )
      .eq('id', id)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error en DELETE /api/clients/[id]:', error)
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
 * PATCH /api/clients/[id]
 * Actualiza un cliente
 * Requiere: estar autenticado (todos pueden editar)
 */
export const PATCH: APIRoute = async ({ params, cookies, request }) => {
  try {
    const session = await getStudioFromSession(cookies, request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { id } = params

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updates = await request.json()
    const supabase = createSupabaseServerClient(cookies, request)

    // Actualizar en tenant schema
    const { data, error } = await supabase
      .schema(session.tenant_schema)
      .from(TENANT_TABLES.CLIENTS)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error en PATCH /api/clients/[id]:', error)
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
