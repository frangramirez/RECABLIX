/**
 * MyStudiosManager - Dashboard de Mis Estudios
 *
 * Muestra todos los estudios donde el superadmin es owner/admin
 * con grid de cards y acciones para navegar o asociar nuevos estudios
 */

import { useState, useEffect } from 'react'
import { Building2, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StudioCard } from './StudioCard'
import { toast } from 'sonner'

interface Studio {
  id: string
  name: string
  slug: string
  schema_name: string
  member_count: number
  client_count: number
  role: 'owner' | 'admin'
}

export function MyStudiosManager() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStudios()
  }, [])

  const fetchStudios = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/my-studios')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar estudios')
      }

      setStudios(data.studios || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Cargando estudios...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium mb-2">Error al cargar estudios</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={fetchStudios}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Estudios</h1>
          <p className="text-muted-foreground text-sm">
            Estudios donde eres propietario o administrador
          </p>
        </div>
        <Button asChild>
          <a href="/admin/my-studio/setup">
            <Plus className="h-4 w-4 mr-2" />
            Asociar Estudio
          </a>
        </Button>
      </div>

      {/* Grid de estudios */}
      {studios.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-2">No tienes estudios</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea un nuevo estudio o asóciate a uno existente
          </p>
          <Button asChild>
            <a href="/admin/my-studio/setup">
              <Plus className="h-4 w-4 mr-2" />
              Crear o Asociar Estudio
            </a>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studios.map((studio) => (
            <StudioCard
              key={studio.id}
              id={studio.id}
              name={studio.name}
              slug={studio.slug}
              role={studio.role}
              clientCount={studio.client_count}
              memberCount={studio.member_count}
            />
          ))}
        </div>
      )}

      {/* Resumen */}
      {studios.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total: {studios.length} {studios.length === 1 ? 'estudio' : 'estudios'}
        </p>
      )}
    </div>
  )
}
