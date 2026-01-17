/**
 * UserDetailManager - Gestión completa de un usuario
 *
 * Funcionalidades:
 * - Ver/editar información básica
 * - Gestionar membresías (agregar, editar permisos, eliminar)
 * - Toggle de superadmin
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  ArrowLeft,
  User,
  Shield,
  Building2,
  Pencil,
  Trash2,
  Plus,
  Settings,
  RefreshCw,
  Mail,
  Calendar,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface UserData {
  id: string
  email: string
  name: string | null
  last_sign_in_at: string | null
  created_at: string
  is_superadmin: boolean
  studios: {
    membership_id: string
    studio_id: string
    studio_name: string
    role: string
    permissions: Record<string, boolean>
  }[]
}

interface Studio {
  id: string
  name: string
}

const PERMISSION_CONFIGS = [
  { key: 'can_view_billing', label: 'Ver Facturación' },
  { key: 'can_manage_subscriptions', label: 'Gestionar Suscripciones' },
  { key: 'can_delete_members', label: 'Eliminar Miembros' },
  { key: 'can_delete_clients', label: 'Eliminar Clientes' },
  { key: 'can_export_data', label: 'Exportar Datos' },
  { key: 'can_import_data', label: 'Importar Datos' },
  { key: 'can_generate_reports', label: 'Generar Reportes' },
] as const

interface Props {
  userId: string
}

export function UserDetailManager({ userId }: Props) {
  const [user, setUser] = useState<UserData | null>(null)
  const [allStudios, setAllStudios] = useState<Studio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog de editar permisos
  const [editingMembership, setEditingMembership] = useState<UserData['studios'][0] | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Record<string, boolean>>({})

  // Dialog de agregar a studio
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newStudioId, setNewStudioId] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'collaborator' | 'client'>('collaborator')

  useEffect(() => {
    fetchUser()
    fetchStudios()
  }, [userId])

  async function fetchUser() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Error al cargar usuarios')

      const data = await response.json()
      const foundUser = data.users.find((u: UserData) => u.id === userId)

      if (!foundUser) {
        toast.error('Usuario no encontrado')
        window.location.href = '/admin/settings'
        return
      }

      setUser(foundUser)
    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Error al cargar usuario')
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchStudios() {
    try {
      const response = await fetch('/api/admin/my-studios')
      if (response.ok) {
        const data = await response.json()
        setAllStudios(data.studios || [])
      }
    } catch (error) {
      console.error('Error fetching studios:', error)
    }
  }

  async function handleSavePermissions() {
    if (!editingMembership) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/studio/members/${editingMembership.membership_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editedPermissions }),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Permisos actualizados')
      setEditingMembership(null)
      fetchUser()
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Error al actualizar permisos')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteMembership(membershipId: string, studioName: string) {
    if (!confirm(`¿Eliminar membresía de "${studioName}"?`)) return

    try {
      const response = await fetch(`/api/studio/members/${membershipId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Membresía eliminada')
      fetchUser()
    } catch (error) {
      console.error('Error deleting membership:', error)
      toast.error('Error al eliminar membresía')
    }
  }

  async function handleAddToStudio() {
    if (!newStudioId || !user) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/studio/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studio_id: newStudioId,
          email: user.email,
          role: newRole,
        }),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Usuario agregado al studio')
      setShowAddDialog(false)
      setNewStudioId('')
      setNewRole('collaborator')
      fetchUser()
    } catch (error) {
      console.error('Error adding to studio:', error)
      toast.error('Error al agregar al studio')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleSuperadmin() {
    if (!user) return

    const action = user.is_superadmin ? 'remove' : 'add'
    if (!confirm(`¿${action === 'add' ? 'Hacer' : 'Quitar'} SuperAdmin a este usuario?`)) return

    try {
      const response = await fetch('/api/admin/superadmins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, action }),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(action === 'add' ? 'Usuario ahora es SuperAdmin' : 'SuperAdmin removido')
      fetchUser()
    } catch (error) {
      console.error('Error toggling superadmin:', error)
      toast.error('Error al cambiar estado de SuperAdmin')
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Nunca'
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'admin': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'collaborator': return 'bg-green-100 text-green-700 border-green-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  // Studios donde el usuario NO es miembro aún
  const availableStudios = allStudios.filter(
    s => !user?.studios.some(us => us.studio_id === s.id)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Cargando usuario...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Usuario no encontrado</p>
        <Button variant="link" onClick={() => window.location.href = '/admin/settings'}>
          Volver a configuración
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin/settings'}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            {user.name || user.email}
            {user.is_superadmin && (
              <Badge className="bg-amber-500 ml-2">SuperAdmin</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Registrado: {formatDate(user.created_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Último login: {formatDate(user.last_sign_in_at)}</span>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span>SuperAdmin</span>
                </div>
                <Switch
                  checked={user.is_superadmin}
                  onCheckedChange={handleToggleSuperadmin}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Los SuperAdmin tienen acceso completo al sistema.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Membresías */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Membresías ({user.studios.length})
              </div>
              {availableStudios.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Estudios a los que pertenece este usuario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.studios.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Sin membresías
              </p>
            ) : (
              <div className="space-y-3">
                {user.studios.map((studio) => (
                  <div
                    key={studio.studio_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <div className="font-medium">{studio.studio_name}</div>
                      <Badge variant="outline" className={getRoleBadgeColor(studio.role)}>
                        {studio.role}
                      </Badge>
                    </div>
                    {studio.role !== 'owner' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMembership(studio)
                            setEditedPermissions(studio.permissions || {})
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMembership(studio.membership_id, studio.studio_name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de editar permisos */}
      <Dialog open={!!editingMembership} onOpenChange={() => setEditingMembership(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editar Permisos
            </DialogTitle>
            <DialogDescription>
              {editingMembership?.studio_name} - {editingMembership?.role}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {editingMembership?.role === 'admin' ? (
              <p className="text-sm text-muted-foreground">
                Los administradores tienen todos los permisos automáticamente.
              </p>
            ) : (
              PERMISSION_CONFIGS.map((config) => (
                <div key={config.key} className="flex items-center justify-between">
                  <Label htmlFor={config.key} className="cursor-pointer">
                    {config.label}
                  </Label>
                  <Switch
                    id={config.key}
                    checked={editedPermissions[config.key] || false}
                    onCheckedChange={(checked) =>
                      setEditedPermissions((prev) => ({ ...prev, [config.key]: checked }))
                    }
                  />
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMembership(null)} disabled={isSaving}>
              Cancelar
            </Button>
            {editingMembership?.role !== 'admin' && (
              <Button onClick={handleSavePermissions} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de agregar a studio */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar a Studio</DialogTitle>
            <DialogDescription>
              Agregar a {user.email} a un nuevo studio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Studio</Label>
              <Select value={newStudioId} onValueChange={setNewStudioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar studio..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStudios.map((studio) => (
                    <SelectItem key={studio.id} value={studio.id}>
                      {studio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={newRole}
                onValueChange={(v: 'admin' | 'collaborator' | 'client') => setNewRole(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleAddToStudio} disabled={isSaving || !newStudioId}>
              {isSaving ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
