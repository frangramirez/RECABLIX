import { atom } from 'nanostores'

/**
 * Estudio donde el superadmin es miembro (para navegación Mis Estudios)
 */
export interface MyStudio {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin'
}

/**
 * Store para cachear la lista de estudios del superadmin
 */
export const $myStudios = atom<MyStudio[]>([])

export function setMyStudios(studios: MyStudio[]) {
  $myStudios.set(studios)
}

export interface UserPermissions {
  can_view_billing: boolean
  can_manage_subscriptions: boolean
  can_delete_members: boolean
  can_delete_clients: boolean
  can_export_data: boolean
  can_import_data: boolean
  can_generate_reports: boolean
}

export interface StudioSession {
  id: string
  name: string
  slug: string
  is_superadmin: boolean
  /** Nombre del tenant schema (tenant_xxxx_xxxx...) */
  schema_name: string
}

export interface SessionStore {
  studio: StudioSession | null
  role?: 'owner' | 'admin' | 'collaborator' | 'client'
  is_superadmin?: boolean
  permissions?: UserPermissions
  isLoading: boolean
}

export const $session = atom<SessionStore>({
  studio: null,
  isLoading: true,
})

export function setSession(
  studio: StudioSession | null,
  role?: 'owner' | 'admin' | 'collaborator' | 'client',
  is_superadmin?: boolean,
  permissions?: UserPermissions
) {
  $session.set({ studio, role, is_superadmin, permissions, isLoading: false })
}

export function clearSession() {
  $session.set({ studio: null, isLoading: false })
}
