import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Building2, Edit, Infinity } from 'lucide-react'
import { toast } from 'sonner'
import type { SubscriptionLimits, SubscriptionLimitsResponse } from '@/types/subscription'

interface Studio {
  id: string
  name: string
  slug: string
  schema_name: string
  member_count: number
  client_count: number
  role: 'owner' | 'admin' | 'collaborator' | 'client'
}

interface StudioWithLimits extends Studio {
  limits: SubscriptionLimits
  usage: {
    admins: number
    collaborators: number
    clients: number
  }
}

export function StudiosLimitsManager() {
  const [studios, setStudios] = useState<StudioWithLimits[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStudio, setSelectedStudio] = useState<StudioWithLimits | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Form state
  const [maxAdmins, setMaxAdmins] = useState<string>('')
  const [maxCollaborators, setMaxCollaborators] = useState<string>('')
  const [maxClients, setMaxClients] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchStudios()
  }, [])

  async function fetchStudios() {
    try {
      // Obtener lista de studios
      const studiosResponse = await fetch('/api/admin/my-studios')
      if (!studiosResponse.ok) throw new Error('Error al cargar studios')
      const studiosData = await studiosResponse.json()

      // Para cada studio, obtener límites y uso
      const studiosWithLimits: StudioWithLimits[] = []

      for (const studio of studiosData.studios) {
        try {
          const limitsResponse = await fetch(
            `/api/admin/subscription-limits?studio_id=${studio.id}`
          )
          if (!limitsResponse.ok) continue

          const limitsData: SubscriptionLimitsResponse = await limitsResponse.json()

          studiosWithLimits.push({
            ...studio,
            limits: limitsData.limits,
            usage: limitsData.usage,
          })
        } catch (error) {
          console.error(`Error fetching limits for studio ${studio.id}:`, error)
        }
      }

      setStudios(studiosWithLimits)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar studios'
      console.error('Error fetching studios:', error)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleEditStudio(studio: StudioWithLimits) {
    setSelectedStudio(studio)
    setMaxAdmins(studio.limits.max_admins?.toString() || '')
    setMaxCollaborators(studio.limits.max_collaborators?.toString() || '')
    setMaxClients(studio.limits.max_clients?.toString() || '')
    setShowEditDialog(true)
  }

  async function handleSaveLimits() {
    if (!selectedStudio) return

    setIsSaving(true)

    try {
      const limits: SubscriptionLimits = {
        max_admins: maxAdmins ? Number(maxAdmins) : null,
        max_collaborators: maxCollaborators ? Number(maxCollaborators) : null,
        max_clients: maxClients ? Number(maxClients) : null,
      }

      const response = await fetch('/api/admin/subscription-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studio_id: selectedStudio.id,
          limits,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al actualizar límites')
      }

      toast.success('Límites actualizados correctamente')
      setShowEditDialog(false)
      await fetchStudios()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar límites'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  function formatLimit(value: number | null): string {
    return value === null ? '∞' : value.toString()
  }

  function getLimitColor(usage: number, limit: number | null): string {
    if (limit === null) return 'text-muted-foreground'
    const percentage = (usage / limit) * 100
    if (percentage >= 100) return 'text-red-600 font-semibold'
    if (percentage >= 80) return 'text-amber-600 font-medium'
    return 'text-muted-foreground'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando studios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Límites de Subscripción</h3>
        <p className="text-sm text-muted-foreground">
          Configura los límites de usuarios por rol para cada studio. Dejar vacío = ilimitado.
        </p>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Studio</TableHead>
              <TableHead className="text-center">Admins</TableHead>
              <TableHead className="text-center">Collaborators</TableHead>
              <TableHead className="text-center">Clients</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <p className="text-muted-foreground">No hay studios disponibles.</p>
                </TableCell>
              </TableRow>
            ) : (
              studios.map((studio) => (
                <TableRow key={studio.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{studio.name}</p>
                        <p className="text-xs text-muted-foreground">{studio.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={getLimitColor(studio.usage.admins, studio.limits.max_admins)}>
                        {studio.usage.admins} / {formatLimit(studio.limits.max_admins)}
                      </span>
                      {studio.limits.max_admins !== null &&
                        studio.usage.admins >= studio.limits.max_admins && (
                          <span className="text-xs text-red-600">Límite alcanzado</span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={getLimitColor(
                          studio.usage.collaborators,
                          studio.limits.max_collaborators
                        )}
                      >
                        {studio.usage.collaborators} / {formatLimit(studio.limits.max_collaborators)}
                      </span>
                      {studio.limits.max_collaborators !== null &&
                        studio.usage.collaborators >= studio.limits.max_collaborators && (
                          <span className="text-xs text-red-600">Límite alcanzado</span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={getLimitColor(studio.usage.clients, studio.limits.max_clients)}>
                        {studio.usage.clients} / {formatLimit(studio.limits.max_clients)}
                      </span>
                      {studio.limits.max_clients !== null &&
                        studio.usage.clients >= studio.limits.max_clients && (
                          <span className="text-xs text-red-600">Límite alcanzado</span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditStudio(studio)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog editar límites */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Editar Límites - {selectedStudio?.name}
            </DialogTitle>
            <DialogDescription>
              Configura los límites de usuarios por rol. Dejar vacío = ilimitado (∞).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-admins">
                Máximo de Admins
                <span className="ml-2 text-xs text-muted-foreground">
                  (Actual: {selectedStudio?.usage.admins})
                </span>
              </Label>
              <Input
                id="max-admins"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={maxAdmins}
                onChange={(e) => setMaxAdmins(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-collaborators">
                Máximo de Collaborators
                <span className="ml-2 text-xs text-muted-foreground">
                  (Actual: {selectedStudio?.usage.collaborators})
                </span>
              </Label>
              <Input
                id="max-collaborators"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={maxCollaborators}
                onChange={(e) => setMaxCollaborators(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-clients">
                Máximo de Clients
                <span className="ml-2 text-xs text-muted-foreground">
                  (Actual: {selectedStudio?.usage.clients})
                </span>
              </Label>
              <Input
                id="max-clients"
                type="number"
                min="0"
                placeholder="Ilimitado"
                value={maxClients}
                onChange={(e) => setMaxClients(e.target.value)}
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
              <p className="font-medium">Nota:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Dejar un campo vacío = ilimitado (∞)</li>
                <li>El límite NO puede ser menor al uso actual</li>
                <li>Los cambios se aplican inmediatamente</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLimits} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar Límites'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
