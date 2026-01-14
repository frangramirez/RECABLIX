import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $session, setSession, type StudioSession } from '@/stores/session'

interface SessionInitProps {
  studio: StudioSession | null
}

/**
 * Componente de inicialización de sesión para Astro islands
 * Se monta una vez para hidratar el store con datos del servidor
 */
export function SessionInit({ studio }: SessionInitProps) {
  useEffect(() => {
    setSession(studio)
  }, [studio])

  return null
}

/**
 * Hook para acceder a la sesión desde componentes React
 */
export function useSession() {
  return useStore($session)
}
