import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $session, setSession, type StudioSession, type UserPermissions } from '@/stores/session'

interface SessionInitProps {
  studio: StudioSession | null
  role?: 'owner' | 'admin' | 'collaborator' | 'client'
  is_superadmin?: boolean
  permissions?: UserPermissions
}

/**
 * Componente de inicialización de sesión para Astro islands
 * Se monta una vez para hidratar el store con datos del servidor
 */
export function SessionInit({ studio, role, is_superadmin, permissions }: SessionInitProps) {
  useEffect(() => {
    setSession(studio, role, is_superadmin, permissions)
  }, [studio, role, is_superadmin, permissions])

  return null
}

/**
 * Hook para acceder a la sesión desde componentes React
 */
export function useSession() {
  return useStore($session)
}
