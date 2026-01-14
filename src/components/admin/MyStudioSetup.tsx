import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2, Link2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface Studio {
  id: string
  name: string
  slug: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function MyStudioSetup() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAssociateDialogOpen, setIsAssociateDialogOpen] = useState(false)
  const [studios, setStudios] = useState<Studio[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingStudios, setIsLoadingStudios] = useState(false)

  // Form states
  const [newStudioName, setNewStudioName] = useState('')
  const [newStudioSlug, setNewStudioSlug] = useState('')
  const [selectedStudioId, setSelectedStudioId] = useState('')

  // Fetch studios for association
  useEffect(() => {
    if (isAssociateDialogOpen) {
      fetchStudios()
    }
  }, [isAssociateDialogOpen])

  async function fetchStudios() {
    setIsLoadingStudios(true)
    try {
      const { data, error } = await supabase
        .from('studios')
        .select('id, name, slug')
        .order('name')

      if (error) throw error
      setStudios(data || [])
    } catch (error: unknown) {
      console.error('Error fetching studios:', error)
      toast.error('Error al cargar estudios')
    } finally {
      setIsLoadingStudios(false)
    }
  }

  function handleNameChange(name: string) {
    setNewStudioName(name)
    setNewStudioSlug(generateSlug(name))
  }

  async function handleCreateStudio(e: React.FormEvent) {
    e.preventDefault()

    if (!newStudioName.trim() || !newStudioSlug.trim()) {
      toast.error('Nombre y slug son requeridos')
      return
    }

    setIsLoading(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')

      // Create studio
      const { data: newStudio, error: studioError } = await supabase
        .from('studios')
        .insert({
          name: newStudioName.trim(),
          slug: newStudioSlug.trim(),
        })
        .select('id')
        .single()

      if (studioError) {
        if (studioError.code === '23505') {
          toast.error('Ya existe un estudio con ese slug')
          return
        }
        throw studioError
      }

      // Create membership as owner
      const { error: memberError } = await supabase
        .from('studio_members')
        .insert({
          studio_id: newStudio.id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) throw memberError

      toast.success('Estudio creado correctamente')
      setIsCreateDialogOpen(false)

      // Redirect to my-studio clients
      window.location.href = '/admin/my-studio/clients'
    } catch (error: unknown) {
      console.error('Error creating studio:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al crear estudio'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAssociateStudio(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedStudioId) {
      toast.error('Selecciona un estudio')
      return
    }

    setIsLoading(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('studio_members')
        .select('id')
        .eq('studio_id', selectedStudioId)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        toast.error('Ya eres miembro de este estudio')
        return
      }

      // Create membership as owner (superadmin gets owner role)
      const { error: memberError } = await supabase
        .from('studio_members')
        .insert({
          studio_id: selectedStudioId,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) throw memberError

      toast.success('Te has asociado al estudio correctamente')
      setIsAssociateDialogOpen(false)

      // Redirect to my-studio clients
      window.location.href = '/admin/my-studio/clients'
    } catch (error: unknown) {
      console.error('Error associating studio:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al asociarse al estudio'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Create New Studio */}
      <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setIsCreateDialogOpen(true)}>
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Crear Mi Estudio</CardTitle>
          <CardDescription>
            Crea un nuevo estudio contable para gestionar tus propios clientes desde el panel de administración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">
            <Building2 className="h-4 w-4 mr-2" />
            Crear Estudio
          </Button>
        </CardContent>
      </Card>

      {/* Associate to Existing */}
      <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setIsAssociateDialogOpen(true)}>
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
            <Link2 className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle>Asociarme a Existente</CardTitle>
          <CardDescription>
            Asociate a un estudio ya existente para acceder a sus clientes y funcionalidades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            <Link2 className="h-4 w-4 mr-2" />
            Seleccionar Estudio
          </Button>
        </CardContent>
      </Card>

      {/* Dialog: Create Studio */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Mi Estudio</DialogTitle>
            <DialogDescription>
              Crea un nuevo estudio contable. El slug se genera automáticamente y se usa para URLs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStudio} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studio-name">Nombre del Estudio</Label>
              <Input
                id="studio-name"
                value={newStudioName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Mi Estudio Contable"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-slug">Slug (generado automáticamente)</Label>
              <Input
                id="studio-slug"
                value={newStudioSlug}
                onChange={(e) => setNewStudioSlug(e.target.value)}
                placeholder="mi-estudio-contable"
                required
                disabled={isLoading}
                pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$"
                title="Solo minúsculas, números y guiones"
              />
              <p className="text-xs text-muted-foreground">
                Solo minúsculas, números y guiones. No puede comenzar ni terminar con guión.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creando...' : 'Crear Estudio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Associate to Studio */}
      <Dialog open={isAssociateDialogOpen} onOpenChange={setIsAssociateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asociarme a un Estudio</DialogTitle>
            <DialogDescription>
              Selecciona un estudio existente para asociarte como owner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssociateStudio} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="select-studio">Estudio</Label>
              {isLoadingStudios ? (
                <p className="text-sm text-muted-foreground py-2">Cargando estudios...</p>
              ) : studios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay estudios disponibles. Crea uno nuevo.
                </p>
              ) : (
                <Select value={selectedStudioId} onValueChange={setSelectedStudioId}>
                  <SelectTrigger id="select-studio">
                    <SelectValue placeholder="Selecciona un estudio" />
                  </SelectTrigger>
                  <SelectContent>
                    {studios.map((studio) => (
                      <SelectItem key={studio.id} value={studio.id}>
                        {studio.name} ({studio.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Te asociarás con rol de <span className="text-foreground font-medium">owner</span>,
                lo que te da control total sobre el estudio seleccionado.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssociateDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || studios.length === 0}>
                {isLoading ? 'Asociando...' : 'Asociarme'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
