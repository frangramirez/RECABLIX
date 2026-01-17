import { useState, useEffect, useRef } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Users, FileText, Building2, Download, Upload, UserCog, Pencil, Settings, Trash2, AlertTriangle, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { UsersTab } from './UsersTab'
import * as XLSX from 'xlsx'

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

interface SubscriptionLimits {
  max_admins: number | null
  max_collaborators: number | null
  max_clients: number | null
}

interface EditingStudio extends Studio {
  subscription_limits: SubscriptionLimits
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

export function StudiosManager() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [formData, setFormData] = useState<StudioFormData>({
    name: '',
    slug: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para edición
  const [editingStudio, setEditingStudio] = useState<EditingStudio | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editActiveTab, setEditActiveTab] = useState('general')

  // Estado para eliminación
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Estado para miembros del estudio
  interface StudioMember {
    id: string
    user_id: string
    email: string
    role: 'owner' | 'admin' | 'collaborator' | 'client'
    permissions: Record<string, boolean>
    created_at: string
  }
  const [studioMembers, setStudioMembers] = useState<StudioMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [savingMember, setSavingMember] = useState(false)

  useEffect(() => {
    fetchStudios()
  }, [])

  // Cargar miembros cuando se abre el tab "members"
  useEffect(() => {
    if (editActiveTab === 'members' && editingStudio) {
      fetchStudioMembers(editingStudio.id)
    }
  }, [editActiveTab, editingStudio?.id])

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
      // Usar endpoint API que crea studio + membership como owner
      const response = await fetch('/api/admin/my-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: formData.name,
          slug: formData.slug,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear estudio')
      }

      toast.success('Estudio creado correctamente')
      setIsDialogOpen(false)
      fetchStudios()
    } catch (error: any) {
      console.error('Error creating studio:', error)
      toast.error(error.message || 'Error al crear estudio')
    }
  }

  function handleExportStudios() {
    const exportData = studios.map((s) => ({
      ID: s.id,
      Nombre: s.name,
      Slug: s.slug,
      'Clientes RECA': s.client_count,
      Miembros: s.member_count,
      'Es SuperAdmin': s.has_superadmin_owner ? 'Sí' : 'No',
      Creado: new Date(s.created_at).toLocaleDateString('es-AR'),
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estudios')

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 36 }, // ID
      { wch: 30 }, // Nombre
      { wch: 25 }, // Slug
      { wch: 14 }, // Clientes RECA
      { wch: 10 }, // Miembros
      { wch: 14 }, // Es SuperAdmin
      { wch: 12 }, // Creado
    ]

    const timestamp = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `estudios_${timestamp}.xlsx`)
    toast.success('Estudios exportados correctamente')
  }

  async function openEditDialog(studio: Studio) {
    try {
      // Obtener datos completos del estudio incluyendo subscription_limits
      const { data, error } = await supabase
        .from('studios')
        .select('subscription_limits')
        .eq('id', studio.id)
        .single()

      if (error) throw error

      const limits = (data?.subscription_limits as SubscriptionLimits) || {
        max_admins: null,
        max_collaborators: null,
        max_clients: null,
      }

      setEditingStudio({
        ...studio,
        subscription_limits: limits,
      })
      setEditActiveTab('general')
      setIsEditDialogOpen(true)
    } catch (error: any) {
      console.error('Error loading studio:', error)
      toast.error('Error al cargar datos del estudio')
    }
  }

  async function handleSaveEdit() {
    if (!editingStudio) return

    setIsSavingEdit(true)
    try {
      const response = await fetch(`/api/admin/studios/${editingStudio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingStudio.name,
          slug: editingStudio.slug,
          subscription_limits: editingStudio.subscription_limits,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar estudio')
      }

      toast.success('Estudio actualizado correctamente')
      setIsEditDialogOpen(false)
      setEditingStudio(null)
      fetchStudios()
    } catch (error: any) {
      console.error('Error updating studio:', error)
      toast.error(error.message || 'Error al actualizar estudio')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDeleteStudio() {
    if (!editingStudio) return
    if (deleteConfirmName !== editingStudio.name) {
      toast.error('El nombre ingresado no coincide')
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/studios/${editingStudio.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar estudio')
      }

      toast.success(data.message || 'Estudio eliminado correctamente')
      setIsEditDialogOpen(false)
      setEditingStudio(null)
      setDeleteConfirmName('')
      fetchStudios()
    } catch (error: any) {
      console.error('Error deleting studio:', error)
      toast.error(error.message || 'Error al eliminar estudio')
    } finally {
      setIsDeleting(false)
    }
  }

  async function fetchStudioMembers(studioId: string) {
    setMembersLoading(true)
    try {
      const response = await fetch(`/api/studio/members?studio_id=${studioId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setStudioMembers(data.members || [])
    } catch (error: any) {
      console.error('Error fetching members:', error)
      toast.error(error.message || 'Error al cargar miembros')
    } finally {
      setMembersLoading(false)
    }
  }

  async function handleUpdateMemberRole(member: StudioMember, newRole: string) {
    if (member.role === 'owner') {
      toast.error('No se puede cambiar el rol del owner')
      return
    }

    setSavingMember(true)
    try {
      const response = await fetch('/api/studio/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studio_id: editingStudio?.id,
          membership_id: member.id,
          role: newRole,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Rol actualizado')
      if (editingStudio) fetchStudioMembers(editingStudio.id)
    } catch (error: any) {
      console.error('Error updating member:', error)
      toast.error(error.message || 'Error al actualizar miembro')
    } finally {
      setSavingMember(false)
    }
  }

  async function handleRemoveMember(member: StudioMember) {
    if (member.role === 'owner') {
      toast.error('No se puede eliminar al owner')
      return
    }

    if (!confirm(`¿Eliminar a ${member.email} del estudio?`)) return

    try {
      const response = await fetch('/api/studio/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studio_id: editingStudio?.id,
          membership_id: member.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Miembro eliminado')
      if (editingStudio) fetchStudioMembers(editingStudio.id)
      // También actualizamos el contador general
      fetchStudios()
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast.error(error.message || 'Error al eliminar miembro')
    }
  }

  async function handleImpersonate(studioId: string, studioName: string) {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio_id: studioId }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(`Impersonando estudio: ${studioName}`)

      // Redirigir al panel de studio
      window.location.href = data.redirect || '/studio'
    } catch (error) {
      console.error('Error al impersonar:', error)
      toast.error('Error al iniciar impersonación')
    }
  }

  async function handleImportStudios(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Obtener slugs existentes para validar duplicados
      const existingSlugs = new Set(studios.map((s) => s.slug.toLowerCase()))

      const errors: string[] = []
      let created = 0
      let skipped = 0

      for (const row of jsonData as Record<string, unknown>[]) {
        const name = String(row['Nombre'] || '').trim()
        if (!name) {
          errors.push('Fila sin nombre - ignorada')
          continue
        }

        // Generar o usar slug del archivo
        let slug = String(row['Slug'] || '').trim().toLowerCase()
        if (!slug) {
          slug = generateSlug(name)
        }

        // Validar slug
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
          errors.push(`"${name}": slug inválido "${slug}"`)
          continue
        }

        // Si ya existe el slug, ignorar (no modificar)
        if (existingSlugs.has(slug)) {
          skipped++
          continue
        }

        // Crear nuevo estudio
        const { error } = await supabase.from('studios').insert({
          name,
          slug,
        })

        if (error) {
          if (error.code === '23505') {
            errors.push(`"${name}": slug "${slug}" ya existe`)
          } else {
            errors.push(`"${name}": ${error.message}`)
          }
        } else {
          created++
          existingSlugs.add(slug) // Prevenir duplicados en el mismo archivo
        }
      }

      // Mostrar resultado
      if (created > 0) {
        toast.success(`${created} estudio${created !== 1 ? 's' : ''} creado${created !== 1 ? 's' : ''}`)
        fetchStudios() // Recargar lista
      }

      if (skipped > 0) {
        toast.info(`${skipped} estudio${skipped !== 1 ? 's' : ''} ignorado${skipped !== 1 ? 's' : ''} (ya existían)`)
      }

      if (errors.length > 0) {
        toast.error(
          `Errores:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...y ${errors.length - 3} más` : ''}`
        )
      }

      if (created === 0 && skipped === 0 && errors.length === 0) {
        toast.info('No se encontraron datos válidos en el archivo')
      }
    } catch (error: unknown) {
      console.error('Import error:', error)
      toast.error('Error al leer el archivo Excel')
    } finally {
      setIsImporting(false)
      // Reset input para permitir reimportar mismo archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Tabs defaultValue="studios" className="space-y-4">
      <TabsList>
        <TabsTrigger value="studios" className="gap-2">
          <Building2 className="h-4 w-4" />
          Estudios
        </TabsTrigger>
        <TabsTrigger value="users" className="gap-2">
          <Users className="h-4 w-4" />
          Usuarios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="studios">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Cargando estudios...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {studios.length} estudio{studios.length !== 1 ? 's' : ''} registrado
                {studios.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isImporting ? 'Importando...' : 'Importar'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportStudios}
                  className="hidden"
                />
                <Button variant="outline" onClick={handleExportStudios} disabled={studios.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Estudio
                </Button>
              </div>
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
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(studio)}
                              title="Editar estudio"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(studio.id, studio.name)}
                              title="Acceder como owner de este estudio"
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Impersonar
                            </Button>
                          </div>
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

            {/* Dialog para editar */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) {
                setEditingStudio(null)
                setDeleteConfirmName('')
                setEditActiveTab('general')
              }
            }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Editar Estudio
                  </DialogTitle>
                  <DialogDescription>
                    Modifica los datos y límites del estudio.
                  </DialogDescription>
                </DialogHeader>

                {editingStudio && (
                  <Tabs value={editActiveTab} onValueChange={setEditActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="limits">Límites</TabsTrigger>
                      <TabsTrigger value="members">
                        <Users className="h-4 w-4 mr-1" />
                        Miembros
                      </TabsTrigger>
                      <TabsTrigger value="danger" className="text-red-600 data-[state=active]:text-red-600">
                        Eliminar
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Nombre del Estudio</Label>
                        <Input
                          id="edit-name"
                          value={editingStudio.name}
                          onChange={(e) =>
                            setEditingStudio({
                              ...editingStudio,
                              name: e.target.value,
                              slug: generateSlug(e.target.value),
                            })
                          }
                          placeholder="Nombre del estudio"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-slug">Slug</Label>
                        <Input
                          id="edit-slug"
                          value={editingStudio.slug}
                          onChange={(e) =>
                            setEditingStudio({
                              ...editingStudio,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                            })
                          }
                          placeholder="nombre-del-estudio"
                        />
                        <p className="text-xs text-muted-foreground">
                          Solo minúsculas, números y guiones. Se usa para URLs.
                        </p>
                      </div>

                      <div className="pt-2 space-y-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Miembros:</span>
                          <span className="font-medium">{editingStudio.member_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Clientes RECABLIX:</span>
                          <span className="font-medium">{editingStudio.client_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Creado:</span>
                          <span>{new Date(editingStudio.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="limits" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Define límites de usuarios por rol. Dejar en blanco para ilimitado.
                      </p>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="limit-admins">Máximo de Admins</Label>
                          <Input
                            id="limit-admins"
                            type="number"
                            min="0"
                            value={editingStudio.subscription_limits.max_admins ?? ''}
                            onChange={(e) =>
                              setEditingStudio({
                                ...editingStudio,
                                subscription_limits: {
                                  ...editingStudio.subscription_limits,
                                  max_admins: e.target.value ? parseInt(e.target.value) : null,
                                },
                              })
                            }
                            placeholder="Ilimitado"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="limit-collaborators">Máximo de Colaboradores</Label>
                          <Input
                            id="limit-collaborators"
                            type="number"
                            min="0"
                            value={editingStudio.subscription_limits.max_collaborators ?? ''}
                            onChange={(e) =>
                              setEditingStudio({
                                ...editingStudio,
                                subscription_limits: {
                                  ...editingStudio.subscription_limits,
                                  max_collaborators: e.target.value ? parseInt(e.target.value) : null,
                                },
                              })
                            }
                            placeholder="Ilimitado"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="limit-clients">Máximo de Clientes (portal externo)</Label>
                          <Input
                            id="limit-clients"
                            type="number"
                            min="0"
                            value={editingStudio.subscription_limits.max_clients ?? ''}
                            onChange={(e) =>
                              setEditingStudio({
                                ...editingStudio,
                                subscription_limits: {
                                  ...editingStudio.subscription_limits,
                                  max_clients: e.target.value ? parseInt(e.target.value) : null,
                                },
                              })
                            }
                            placeholder="Ilimitado"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="members" className="space-y-4 mt-4">
                      {membersLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Cargando miembros...
                        </div>
                      ) : studioMembers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No hay miembros en este estudio
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {studioMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm">
                                  <p className="font-medium">{member.email}</p>
                                  <p className="text-muted-foreground text-xs">
                                    Desde {new Date(member.created_at).toLocaleDateString('es-AR')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {member.role === 'owner' ? (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Owner
                                  </Badge>
                                ) : (
                                  <>
                                    <Select
                                      value={member.role}
                                      onValueChange={(value) => handleUpdateMemberRole(member, value)}
                                      disabled={savingMember}
                                    >
                                      <SelectTrigger className="w-32 h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="collaborator">Colaborador</SelectItem>
                                        <SelectItem value="client">Cliente</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleRemoveMember(member)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="danger" className="space-y-4 mt-4">
                      <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-red-800">Zona de Peligro</h4>
                            <p className="text-sm text-red-700 mt-1">
                              Esta acción es irreversible. Se eliminarán todos los datos del estudio,
                              incluyendo miembros y sus permisos asociados.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirm-delete" className="text-red-700">
                            Escribí "<span className="font-mono font-bold">{editingStudio.name}</span>" para confirmar
                          </Label>
                          <Input
                            id="confirm-delete"
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                            placeholder="Nombre del estudio"
                            className="border-red-300 focus:border-red-500"
                          />
                        </div>

                        <Button
                          variant="destructive"
                          onClick={handleDeleteStudio}
                          disabled={isDeleting || deleteConfirmName !== editingStudio.name}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {isDeleting ? 'Eliminando...' : 'Eliminar Estudio Permanentemente'}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false)
                      setEditingStudio(null)
                    }}
                    disabled={isSavingEdit}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                    {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </TabsContent>

      <TabsContent value="users">
        <UsersTab />
      </TabsContent>
    </Tabs>
  )
}
