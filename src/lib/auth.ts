import type { AstroCookies } from 'astro'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient, supabaseAdmin } from './supabase'
import { getTenantSchemaName } from './config'

export { createSupabaseServerClient, getTenantSchemaName }

/**
 * Permisos granulares del usuario en un studio
 */
export interface UserPermissions {
  can_view_billing: boolean
  can_manage_subscriptions: boolean
  can_delete_members: boolean
  can_delete_clients: boolean
  can_export_data: boolean
  can_import_data: boolean
  can_generate_reports: boolean
}

/**
 * Sesión extendida con permisos y tenant schema
 */
export interface SessionWithPermissions {
  user: User
  studio: {
    id: string
    name: string
    slug: string
  }
  role: 'owner' | 'admin' | 'collaborator' | 'client'
  is_superadmin: boolean
  is_impersonating?: boolean
  permissions: UserPermissions
  tenant_schema: string
}

/**
 * Permisos por defecto según rol
 */
const DEFAULT_PERMISSIONS: Record<string, Partial<UserPermissions>> = {
  owner: {
    can_view_billing: true,
    can_manage_subscriptions: true,
    can_delete_members: true,
    can_delete_clients: true,
    can_export_data: true,
    can_import_data: true,
    can_generate_reports: true,
  },
  admin: {
    can_view_billing: false,
    can_manage_subscriptions: false,
    can_delete_members: false,
    can_delete_clients: true,
    can_export_data: true,
    can_import_data: true,
    can_generate_reports: true,
  },
  collaborator: {
    can_view_billing: false,
    can_manage_subscriptions: false,
    can_delete_members: false,
    can_delete_clients: false,
    can_export_data: true,
    can_import_data: true,
    can_generate_reports: true,
  },
  client: {
    can_view_billing: false,
    can_manage_subscriptions: false,
    can_delete_members: false,
    can_delete_clients: false,
    can_export_data: false,
    can_import_data: false,
    can_generate_reports: true,
  },
}

/**
 * Obtiene la sesión actual de Supabase
 */
export async function getSession(cookies: AstroCookies) {
  const supabase = createSupabaseServerClient(cookies)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/**
 * Obtiene el studio asociado al usuario autenticado con permisos
 * Retorna null si no hay sesión o no existe el studio
 *
 * NOTA: Usamos supabaseAdmin para las queries de DB porque las políticas RLS
 * en superadmins y studio_members tienen recursión infinita. Esto es seguro
 * porque getUser() ya validó el JWT del usuario.
 */
export async function getStudioFromSession(
  cookies: AstroCookies,
  request?: Request
): Promise<SessionWithPermissions | null> {
  const supabase = createSupabaseServerClient(cookies, request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Usar admin client para bypasear RLS (las políticas tienen recursión infinita)
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured')
    return null
  }

  // Verificar si es superadmin
  const { data: superadmin } = await supabaseAdmin
    .from('superadmins')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const is_superadmin = !!superadmin

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IMPERSONACIÓN: Si superadmin tiene cookie, usar ese studio
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const impersonatingStudioId = cookies.get('impersonating_studio')?.value

  if (impersonatingStudioId && is_superadmin) {
    // Cargar studio impersonado
    const { data: impersonatedStudio } = await supabaseAdmin
      .from('studios')
      .select('id, name, slug')
      .eq('id', impersonatingStudioId)
      .single()

    if (impersonatedStudio) {
      const tenant_schema = getTenantSchemaName(impersonatedStudio.id)

      // Superadmin actúa como owner con todos los permisos
      return {
        user,
        studio: {
          id: impersonatedStudio.id,
          name: impersonatedStudio.name,
          slug: impersonatedStudio.slug,
        },
        role: 'owner',
        is_superadmin: true,
        is_impersonating: true,
        permissions: {
          can_view_billing: true,
          can_manage_subscriptions: true,
          can_delete_members: true,
          can_delete_clients: true,
          can_export_data: true,
          can_import_data: true,
          can_generate_reports: true,
        },
        tenant_schema,
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FLUJO NORMAL: Obtener studio desde studio_members
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: memberships } = await supabaseAdmin
    .from('studio_members')
    .select('studio_id, role, permissions, studios(*)')
    .eq('user_id', user.id)
    .limit(1)

  const membership = memberships?.[0]
  if (!membership?.studios) return null

  // membership.studios puede ser array u objeto dependiendo del query
  // Lo tratamos como unknown y extraemos los campos necesarios
  const studios = membership.studios as unknown
  const studioData = (Array.isArray(studios) ? studios[0] : studios) as {
    id: string
    name: string
    slug: string
    created_at: string
    updated_at: string
  } | undefined

  if (!studioData) return null

  const role = membership.role as 'owner' | 'admin' | 'collaborator' | 'client'

  // Calcular permisos
  let permissions: UserPermissions

  if (is_superadmin || role === 'owner') {
    // Superadmin y owner tienen todos los permisos
    permissions = {
      can_view_billing: true,
      can_manage_subscriptions: true,
      can_delete_members: true,
      can_delete_clients: true,
      can_export_data: true,
      can_import_data: true,
      can_generate_reports: true,
    }
  } else {
    // Obtener permisos por defecto del rol
    const defaultPerms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.collaborator

    // Mergear con permisos personalizados del usuario (si existen)
    const customPerms = (membership.permissions as Partial<UserPermissions>) || {}

    permissions = {
      can_view_billing: customPerms.can_view_billing ?? defaultPerms.can_view_billing ?? false,
      can_manage_subscriptions:
        customPerms.can_manage_subscriptions ?? defaultPerms.can_manage_subscriptions ?? false,
      can_delete_members: customPerms.can_delete_members ?? defaultPerms.can_delete_members ?? false,
      can_delete_clients: customPerms.can_delete_clients ?? defaultPerms.can_delete_clients ?? false,
      can_export_data: customPerms.can_export_data ?? defaultPerms.can_export_data ?? true,
      can_import_data: customPerms.can_import_data ?? defaultPerms.can_import_data ?? true,
      can_generate_reports:
        customPerms.can_generate_reports ?? defaultPerms.can_generate_reports ?? true,
    }
  }

  const tenant_schema = getTenantSchemaName(studioData.id)

  return {
    user,
    studio: {
      id: studioData.id,
      name: studioData.name,
      slug: studioData.slug,
    },
    role,
    is_superadmin,
    permissions,
    tenant_schema,
  }
}

/**
 * Verifica si un email corresponde al SuperAdmin
 */
export function isSuperAdminEmail(email: string): boolean {
  const superAdminEmail = import.meta.env.SUPERADMIN_EMAIL || 'framirez@contablix.ar'
  return email.toLowerCase() === superAdminEmail.toLowerCase()
}
