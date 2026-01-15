/**
 * Sistema de Permisos Granulares
 *
 * Helpers para verificar permisos en API routes y componentes
 */

import type { SessionWithPermissions, UserPermissions } from './auth'

/**
 * Verifica si la sesión tiene un permiso específico
 *
 * @param session - Sesión del usuario (puede ser null)
 * @param permission - Nombre del permiso a verificar
 * @returns true si tiene el permiso, false caso contrario
 *
 * @example
 * ```ts
 * if (checkPermission(session, 'can_delete_clients')) {
 *   // permitir eliminar cliente
 * }
 * ```
 */
export function checkPermission(
  session: SessionWithPermissions | null,
  permission: keyof UserPermissions
): boolean {
  // Sin sesión, sin permisos
  if (!session) return false

  // Superadmin tiene todos los permisos
  if (session.is_superadmin) return true

  // Owner tiene todos los permisos
  if (session.role === 'owner') return true

  // Verificar permiso específico
  return session.permissions[permission] ?? false
}

/**
 * Requiere que la sesión tenga un permiso específico
 * Lanza error si no tiene el permiso
 *
 * @param session - Sesión del usuario (puede ser null)
 * @param permission - Nombre del permiso requerido
 * @throws Error si no tiene el permiso
 *
 * @example
 * ```ts
 * export const DELETE: APIRoute = async ({ cookies }) => {
 *   const session = await getStudioFromSession(cookies)
 *   requirePermission(session, 'can_delete_clients')
 *   // continuar con la eliminación
 * }
 * ```
 */
export function requirePermission(
  session: SessionWithPermissions | null,
  permission: keyof UserPermissions
): void {
  if (!checkPermission(session, permission)) {
    const permissionLabel = permission
      .replace('can_', '')
      .replace(/_/g, ' ')
      .toLowerCase()

    throw new Error(`Permiso denegado: ${permissionLabel}`)
  }
}

/**
 * Verifica múltiples permisos (requiere TODOS)
 *
 * @param session - Sesión del usuario
 * @param permissions - Array de permisos requeridos
 * @returns true si tiene todos los permisos
 */
export function checkAllPermissions(
  session: SessionWithPermissions | null,
  permissions: (keyof UserPermissions)[]
): boolean {
  return permissions.every(p => checkPermission(session, p))
}

/**
 * Verifica múltiples permisos (requiere AL MENOS UNO)
 *
 * @param session - Sesión del usuario
 * @param permissions - Array de permisos a verificar
 * @returns true si tiene al menos uno de los permisos
 */
export function checkAnyPermission(
  session: SessionWithPermissions | null,
  permissions: (keyof UserPermissions)[]
): boolean {
  return permissions.some(p => checkPermission(session, p))
}

/**
 * Obtiene lista de permisos que el usuario tiene
 *
 * @param session - Sesión del usuario
 * @returns Array con los nombres de permisos que tiene
 */
export function getGrantedPermissions(
  session: SessionWithPermissions | null
): (keyof UserPermissions)[] {
  if (!session) return []

  const allPermissions: (keyof UserPermissions)[] = [
    'can_view_billing',
    'can_manage_subscriptions',
    'can_delete_members',
    'can_delete_clients',
    'can_export_data',
    'can_import_data',
    'can_generate_reports',
  ]

  return allPermissions.filter(p => checkPermission(session, p))
}

/**
 * Verifica si es superadmin o owner (acceso completo)
 */
export function hasFullAccess(session: SessionWithPermissions | null): boolean {
  if (!session) return false
  return session.is_superadmin || session.role === 'owner'
}
