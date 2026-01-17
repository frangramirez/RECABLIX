import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Search, Shield, Building2, User, Pencil, Trash2, Settings, ChevronDown, ChevronRight, Key, Eye, EyeOff, Mail, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { UserWithRoles } from '@/pages/api/admin/users'

type FilterType = 'all' | 'superadmins' | 'studio'

interface MembershipPermissions {
  can_view_billing?: boolean
  can_manage_subscriptions?: boolean
  can_delete_members?: boolean
  can_delete_clients?: boolean
  can_export_data?: boolean
  can_import_data?: boolean
  can_generate_reports?: boolean
}

interface EditingMembership {
  membership_id: string
  studio_name: string
  role: string
  permissions: MembershipPermissions
}

const PERMISSION_CONFIGS = [
  { key: 'can_view_billing' as const, label: 'Ver Facturación' },
  { key: 'can_manage_subscriptions' as const, label: 'Gestionar Suscripciones' },
  { key: 'can_delete_members' as const, label: 'Eliminar Miembros' },
  { key: 'can_delete_clients' as const, label: 'Eliminar Clientes' },
  { key: 'can_export_data' as const, label: 'Exportar Datos' },
  { key: 'can_import_data' as const, label: 'Importar Datos' },
  { key: 'can_generate_reports' as const, label: 'Generar Reportes' },
]

export function UsersTab() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedStudio, setSelectedStudio] = useState<string>('')
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([])
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)

  // Estado para fila expandida inline
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Estado para edición de permisos
  const [editingMembership, setEditingMembership] = useState<EditingMembership | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<MembershipPermissions>({})
  const [isSaving, setIsSaving] = useState(false)
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)

  // Estado para contraseña
  const [passwordForUserId, setPasswordForUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSettingPassword, setIsSettingPassword] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [users, searchTerm, filterType, selectedStudio])

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('Error al cargar usuarios')
      }
      const data = await response.json()
      setUsers(data.users)

      // Extraer lista de estudios únicos
      const studioMap = new Map<string, string>()
      for (const user of data.users) {
        for (const studio of user.studios) {
          studioMap.set(studio.studio_id, studio.studio_name)
        }
      }
      setStudios(
        Array.from(studioMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar usuarios'
      console.error('Error fetching users:', error)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  function applyFilters() {
    let result = [...users]

    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (user) =>
          user.email.toLowerCase().includes(term) ||
          (user.name && user.name.toLowerCase().includes(term))
      )
    }

    // Filtro por tipo
    if (filterType === 'superadmins') {
      result = result.filter((user) => user.is_superadmin)
    } else if (filterType === 'studio' && selectedStudio) {
      result = result.filter((user) =>
        user.studios.some((s) => s.studio_id === selectedStudio)
      )
    }

    setFilteredUsers(result)
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

  function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
    switch (role) {
      case 'owner':
        return 'default'
      case 'admin':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  function openEditPermissions(studio: UserWithRoles['studios'][0]) {
    setEditingMembership({
      membership_id: studio.membership_id,
      studio_name: studio.studio_name,
      role: studio.role,
      permissions: studio.permissions || {},
    })
    setEditedPermissions(studio.permissions || {})
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
      setSelectedUser(null)
      fetchUsers() // Recargar lista
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
      setSelectedUser(null)
      fetchUsers() // Recargar lista
    } catch (error) {
      console.error('Error deleting membership:', error)
      toast.error('Error al eliminar membresía')
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    setChangingRoleFor(membershipId)
    try {
      const response = await fetch(`/api/studio/members/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Rol actualizado')
      fetchUsers() // Recargar lista
    } catch (error) {
      console.error('Error changing role:', error)
      toast.error('Error al cambiar rol')
    } finally {
      setChangingRoleFor(null)
    }
  }

  async function handleSetPassword(userId: string) {
    if (!newPassword || newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsSettingPassword(true)
    try {
      const response = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password: newPassword }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al establecer contraseña')
      }

      toast.success('Contraseña actualizada')
      setNewPassword('')
      setShowPassword(false)
      setPasswordForUserId(null)
    } catch (error) {
      console.error('Error setting password:', error)
      const message = error instanceof Error ? error.message : 'Error al establecer contraseña'
      toast.error(message)
    } finally {
      setIsSettingPassword(false)
    }
  }

  async function handleToggleSuperadmin(userId: string, currentStatus: boolean) {
    const action = currentStatus ? 'remove' : 'add'
    if (!confirm(`¿${action === 'add' ? 'Hacer' : 'Quitar'} SuperAdmin a este usuario?`)) return

    try {
      const response = await fetch('/api/admin/superadmins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      })

      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(action === 'add' ? 'Usuario ahora es SuperAdmin' : 'SuperAdmin removido')
      fetchUsers()
    } catch (error) {
      console.error('Error toggling superadmin:', error)
      toast.error('Error al cambiar estado de SuperAdmin')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterType}
          onValueChange={(value: FilterType) => {
            setFilterType(value)
            if (value !== 'studio') setSelectedStudio('')
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            <SelectItem value="superadmins">Solo SuperAdmins</SelectItem>
            <SelectItem value="studio">Por Estudio</SelectItem>
          </SelectContent>
        </Select>

        {filterType === 'studio' && (
          <Select value={selectedStudio} onValueChange={setSelectedStudio}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar estudio..." />
            </SelectTrigger>
            <SelectContent>
              {studios.map((studio) => (
                <SelectItem key={studio.id} value={studio.id}>
                  {studio.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Conteo */}
      <p className="text-sm text-muted-foreground">
        {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
        {filterType !== 'all' && ` (de ${users.length} total)`}
      </p>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Estudio</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-center">SuperAdmin</TableHead>
              <TableHead>Ultimo Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchTerm || filterType !== 'all'
                      ? 'No hay usuarios que coincidan con los filtros.'
                      : 'No hay usuarios registrados.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.id
                return (
                  <>
                    <TableRow
                      key={user.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.name || '-'}
                      </TableCell>
                      <TableCell>
                        {user.studios.length === 0 ? (
                          <span className="text-muted-foreground">Sin estudio</span>
                        ) : user.studios.length === 1 ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{user.studios[0].studio_name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">
                            {user.studios.length} estudios
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.studios.length === 0 ? (
                          '-'
                        ) : user.studios.length === 1 ? (
                          <Badge variant={getRoleBadgeVariant(user.studios[0].role)}>
                            {user.studios[0].role}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            (ver detalle)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.is_superadmin && (
                          <Shield className="h-4 w-4 mx-auto text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.last_sign_in_at)}
                      </TableCell>
                    </TableRow>
                    {/* Fila expandida con acordeón */}
                    {isExpanded && (
                      <TableRow key={`${user.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="py-4">
                          <div className="pl-6">
                            <Accordion type="multiple" defaultValue={['info', 'memberships']}>
                              {/* Información */}
                              <AccordionItem value="info">
                                <AccordionTrigger className="text-sm font-medium py-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Información
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 pt-1">
                                    <div className="flex items-center gap-3 text-sm">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <span>{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      <span>Registrado: {formatDate(user.created_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      <span>Último login: {formatDate(user.last_sign_in_at)}</span>
                                    </div>
                                    <div className="border-t pt-3 mt-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Shield className="h-4 w-4 text-amber-500" />
                                          <span className="text-sm">SuperAdmin</span>
                                        </div>
                                        <Switch
                                          checked={user.is_superadmin}
                                          onCheckedChange={() => handleToggleSuperadmin(user.id, user.is_superadmin)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Los SuperAdmin tienen acceso completo al sistema.
                                      </p>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              {/* Contraseña */}
                              <AccordionItem value="password">
                                <AccordionTrigger className="text-sm font-medium py-2">
                                  <div className="flex items-center gap-2">
                                    <Key className="h-4 w-4" />
                                    Contraseña
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 pt-1">
                                    <p className="text-xs text-muted-foreground">
                                      Establece una nueva contraseña. El usuario no recibirá notificación.
                                    </p>
                                    <div className="flex gap-2">
                                      <div className="relative flex-1">
                                        <Input
                                          type={showPassword && passwordForUserId === user.id ? 'text' : 'password'}
                                          placeholder="Mínimo 6 caracteres"
                                          value={passwordForUserId === user.id ? newPassword : ''}
                                          onChange={(e) => {
                                            setPasswordForUserId(user.id)
                                            setNewPassword(e.target.value)
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="pr-10 h-8 text-sm"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setPasswordForUserId(user.id)
                                            setShowPassword(!showPassword)
                                          }}
                                        >
                                          {showPassword && passwordForUserId === user.id ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                          ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                      <Button
                                        size="sm"
                                        className="h-8"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSetPassword(user.id)
                                        }}
                                        disabled={isSettingPassword || (passwordForUserId === user.id ? newPassword.length < 6 : true)}
                                      >
                                        {isSettingPassword && passwordForUserId === user.id ? 'Guardando...' : 'Guardar'}
                                      </Button>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              {/* Membresías */}
                              <AccordionItem value="memberships">
                                <AccordionTrigger className="text-sm font-medium py-2">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Membresías ({user.studios.length})
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 pt-1">
                                    {user.studios.length === 0 ? (
                                      <p className="text-sm text-muted-foreground italic">
                                        Este usuario no pertenece a ningún estudio
                                      </p>
                                    ) : (
                                      <div className="grid gap-2">
                                        {user.studios.map((studio) => (
                                          <div
                                            key={studio.membership_id}
                                            className="flex items-center justify-between p-3 bg-background rounded-md border"
                                          >
                                            <div className="flex items-center gap-3">
                                              <span className="font-medium text-sm">{studio.studio_name}</span>
                                              {studio.role === 'owner' ? (
                                                <Badge variant={getRoleBadgeVariant(studio.role)}>
                                                  {studio.role}
                                                </Badge>
                                              ) : (
                                                <Select
                                                  value={studio.role}
                                                  onValueChange={(newRole) => handleRoleChange(studio.membership_id, newRole)}
                                                  disabled={changingRoleFor === studio.membership_id}
                                                >
                                                  <SelectTrigger
                                                    className="h-7 w-[120px]"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="admin">admin</SelectItem>
                                                    <SelectItem value="collaborator">collaborator</SelectItem>
                                                    <SelectItem value="client">client</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              {studio.role !== 'owner' && (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openEditPermissions(studio)
                                                    }}
                                                  >
                                                    <Settings className="h-3.5 w-3.5 mr-1" />
                                                    Permisos
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      handleDeleteMembership(studio.membership_id, studio.studio_name)
                                                    }}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                </>
                                              )}
                                              {studio.role === 'owner' && (
                                                <span className="text-xs text-muted-foreground">Owner no editable</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog detalle usuario */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalle de Usuario
            </DialogTitle>
            <DialogDescription>
              Informacion del usuario y sus membresías
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="font-medium">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span>{selectedUser.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    SuperAdmin:
                  </span>
                  <span>
                    {selectedUser.is_superadmin ? (
                      <Badge className="bg-amber-500">Si</Badge>
                    ) : (
                      'No'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Ultimo login:
                  </span>
                  <span className="text-sm">
                    {formatDate(selectedUser.last_sign_in_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Registrado:
                  </span>
                  <span className="text-sm">
                    {formatDate(selectedUser.created_at)}
                  </span>
                </div>
              </div>

              {selectedUser.studios.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">
                    Membresías ({selectedUser.studios.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedUser.studios.map((studio) => (
                      <div
                        key={studio.studio_id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{studio.studio_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(studio.role)}>
                            {studio.role}
                          </Badge>
                          {studio.role !== 'owner' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => openEditPermissions(studio)}
                                title="Editar permisos"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteMembership(studio.membership_id, studio.studio_name)}
                                title="Eliminar membresía"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de edición de permisos */}
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
    </div>
  )
}
