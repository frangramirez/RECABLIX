/**
 * ImpersonationBanner - Banner de Advertencia de Impersonación
 *
 * Muestra un banner fijo cuando superadmin está impersonando un studio
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface ImpersonationBannerProps {
  studioName: string
}

export function ImpersonationBanner({ studioName }: ImpersonationBannerProps) {
  const [exiting, setExiting] = useState(false)

  const handleExit = async () => {
    if (exiting) return

    try {
      setExiting(true)

      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        setExiting(false)
        return
      }

      toast.success('Impersonación finalizada')

      // Redirigir a admin
      window.location.href = data.redirect || '/admin'
    } catch (error) {
      console.error('Error exiting impersonation:', error)
      toast.error('Error al salir de impersonación')
      setExiting(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-amber-950 py-2.5 px-4 flex justify-between items-center z-50 shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium text-sm">
          Modo Impersonación Activo: <strong>{studioName}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        disabled={exiting}
        className="bg-amber-950 text-amber-50 hover:bg-amber-900 border-amber-900"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {exiting ? 'Saliendo...' : 'Salir de Impersonación'}
      </Button>
    </div>
  )
}
