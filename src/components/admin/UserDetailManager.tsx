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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Card,
  CardContent,
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
  Key,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SetPasswordRequest, SetPasswordResponse } from '@/types/subscription'

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

  // Dialog de editar membresía (rol + permisos)
  const [editingMembership, setEditingMembership] = useState<UserData['studios'][0] | null>(null)
  const [editedRole, setEditedRole] = useState<string>('')
  const [editedPermissions, setEditedPermissions] = useState<Record<string, boolean>>({})

  // Dialog de agregar a studio
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newStudioId, setNewStudioId] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'collaborator' | 'client'>('collaborator')

  // Sección de contraseña (inline en accordion)
  const [newPassword, setNewPassword] = useState('')
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  async function handleSaveMembership() {
    if (!editingMembership) return

    setIsSaving(true)
    try {
      const updatePayload: { role?: string; permissions?: Record<string, boolean> } = {}

      // Solo enviar rol si cambió y no es owner
      if (editedRole && editedRole !== editingMembership.role) {
        updatePayload.role = editedRole
      }

      // Solo enviar permisos si el rol no es admin
      if (editedRole !== 'admin') {
        updatePayload.permissions = editedPermissions
      }

      const response = await fetch(`/api/studio/members/${editingMembership.membership_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Membresía actualizada')
      setEditingMembership(null)
      setEditedRole('')
      fetchUser()
    } catch (error) {
      console.error('Error updating membership:', error)
      toast.error('Error al actualizar membresía')
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

  async function handleSetPassword() {
    if (!user || !newPassword) return

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsSettingPassword(true)

    try {
      const request: SetPasswordRequest = {
        user_id: user.id,
        password: newPassword,
      }

      const response = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data: SetPasswordResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al establecer contraseña')
      }

      toast.success('Contraseña actualizada exitosamente')
      setNewPassword('')
      setShowPassword(false)
    } catch (error) {
      console.error('Error setting password:', error)
      const message = error instanceof Error ? error.message : 'Error al establecer contraseña'
      toast.error(message)
    } finally {
      setIsSettingPassword(false)
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

      {/* Accordion Content */}
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={['info', 'memberships']}>
            {/* Información */}
            <AccordionItem value="info">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
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
                    <p className="text-xs text-muted-foreground mt-2">
                      Los SuperAdmin tienen acceso completo al sistema.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contraseña */}
            <AccordionItem value="password">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Contraseña
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Establece una nueva contraseña para este usuario. El usuario no recibirá notificación.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva Contraseña</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        onClick={handleSetPassword}
                        disabled={isSettingPassword || newPassword.length < 6}
                      >
                        {isSettingPassword ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      La contraseña debe tener al menos 6 caracteres.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Membresías */}
            <AccordionItem value="memberships">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Membresías ({user.studios.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {availableStudios.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar a Studio
                    </Button>
                  )}

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
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-medium">{studio.studio_name}</div>
                              <Badge variant="outline" className={getRoleBadgeColor(studio.role)}>
                                {studio.role}
                              </Badge>
                            </div>
                          </div>
                          {studio.role !== 'owner' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMembership(studio)
                                  setEditedRole(studio.role)
                                  setEditedPermissions(studio.permissions || {})
                                }}
                                title="Editar membresía"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteMembership(studio.membership_id, studio.studio_name)}
                                title="Eliminar membresía"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {studio.role === 'owner' && (
                            <span className="text-xs text-muted-foreground">Owner no editable</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Dialog de editar membresía (rol + permisos) */}
      <Dialog
        open={!!editingMembership}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMembership(null)
            setEditedRole('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editar Membresía
            </DialogTitle>
            <DialogDescription>
              {editingMembership?.studio_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selector de Rol */}
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={editedRole}
                onValueChange={setEditedRole}
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
              <p className="text-xs text-muted-foreground">
                Los administradores tienen todos los permisos automáticamente.
              </p>
            </div>

            {/* Permisos (solo si no es admin) */}
            {editedRole !== 'admin' && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Permisos</Label>
                {PERMISSION_CONFIGS.map((config) => (
                  <div key={config.key} className="flex items-center justify-between">
                    <Label htmlFor={config.key} className="cursor-pointer font-normal">
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
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingMembership(null)
                setEditedRole('')
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveMembership} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
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
