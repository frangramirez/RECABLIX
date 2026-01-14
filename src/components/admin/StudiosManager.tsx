import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Users, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface Studio {
  id: string
  name: string
  slug: string
  created_at: string
  member_count: number
  client_count: number
  has_superadmin_owner: boolean
}

interface StudioFormData {
  name: string
  slug: string
}

export function StudiosManager() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState<StudioFormData>({
    name: '',
    slug: '',
  })

  useEffect(() => {
    fetchStudios()
  }, [])

  async function fetchStudios() {
    try {
      // Fetch studios
      const { data: studiosData, error: studiosError } = await supabase
        .from('studios')
        .select('id, name, slug, created_at')
        .order('name')

      if (studiosError) throw studiosError

      // Para cada estudio, obtener conteos y verificar superadmin
      const studiosWithCounts = await Promise.all(
        (studiosData || []).map(async (studio) => {
          // Contar miembros
          const { count: memberCount } = await supabase
            .from('studio_members')
            .select('*', { count: 'exact', head: true })
            .eq('studio_id', studio.id)

          // Contar clientes RECABLIX
          const { count: clientCount } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('studio_id', studio.id)
            .contains('apps', ['recablix'])

          // Verificar si tiene owner que sea superadmin
          const { data: members } = await supabase
            .from('studio_members')
            .select('user_id')
            .eq('studio_id', studio.id)
            .eq('role', 'owner')

          let hasSuperadminOwner = false
          if (members && members.length > 0) {
            const ownerIds = members.map((m) => m.user_id)
            const { data: superadmins } = await supabase
              .from('superadmins')
              .select('user_id')
              .in('user_id', ownerIds)
              .eq('is_active', true)

            hasSuperadminOwner = (superadmins?.length || 0) > 0
          }

          return {
            ...studio,
            member_count: memberCount || 0,
            client_count: clientCount || 0,
            has_superadmin_owner: hasSuperadminOwner,
          }
        })
      )

      setStudios(studiosWithCounts)
    } catch (error: any) {
      console.error('Error fetching studios:', error)
      toast.error(error.message || 'Error al cargar estudios')
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setFormData({ name: '', slug: '' })
    setIsDialogOpen(true)
  }

  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    setFormData({ name, slug })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name || !formData.slug) {
      toast.error('Nombre y slug son requeridos')
      return
    }

    try {
      const { error } = await supabase.from('studios').insert({
        name: formData.name,
        slug: formData.slug,
      })

      if (error) throw error
      toast.success('Estudio creado correctamente')
      setIsDialogOpen(false)
      fetchStudios()
    } catch (error: any) {
      console.error('Error creating studio:', error)
      if (error.code === '23505') {
        toast.error('Ya existe un estudio con ese slug')
      } else {
        toast.error(error.message || 'Error al crear estudio')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando estudios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {studios.length} estudio{studios.length !== 1 ? 's' : ''} registrado
          {studios.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Estudio
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-center">Miembros</TableHead>
              <TableHead className="text-center">Clientes RECABLIX</TableHead>
              <TableHead>Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <p className="text-muted-foreground">
                    No hay estudios registrados. Crea uno nuevo.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              studios.map((studio) => (
                <TableRow key={studio.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{studio.name}</span>
                      {studio.has_superadmin_owner && (
                        <Badge variant="secondary" className="text-xs">
                          SuperAdmin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {studio.slug}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {studio.member_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {studio.client_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(studio.created_at).toLocaleDateString('es-AR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog para crear */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Estudio</DialogTitle>
            <DialogDescription>
              Crea un nuevo estudio contable. El slug se genera automáticamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Estudio</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Estudio Contable ABC"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (generado automáticamente)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="estudio-contable-abc"
                required
                pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$"
                title="Solo minúsculas, números y guiones. No puede comenzar ni terminar con guión."
              />
              <p className="text-xs text-muted-foreground">
                Solo minúsculas, números y guiones. Se usa para URLs.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Crear Estudio</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
