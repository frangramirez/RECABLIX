import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Search, Shield, Building2, User, UserPlus, Mail, Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronRight, Key, Calendar, Clock, Settings, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { UserWithRoles } from '@/pages/api/admin/users'
import type {
  InviteUserRequest,
  InviteUserResponse,
  CreateUserRequest,
  CreateUserResponse,
  StudioMemberRole,
} from '@/types/subscription'

type FilterType = 'all' | 'superadmins' | 'studio'

interface Studio {
  id: string
  name: string
}

export function AdminUsersManager() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedStudio, setSelectedStudio] = useState<string>('')
  const [studios, setStudios] = useState<Studio[]>([])
  const [studiosError, setStudiosError] = useState<string | null>(null)
  const [studiosLoading, setStudiosLoading] = useState(false)

  // Estado para fila expandida con acordeón
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Estado para contraseña inline
  const [passwordForUserId, setPasswordForUserId] = useState<string | null>(null)
  const [userPassword, setUserPassword] = useState('')
  const [showUserPassword, setShowUserPassword] = useState(false)
  const [isSettingUserPassword, setIsSettingUserPassword] = useState(false)

  // Estado para cambio de rol
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)

  // Estado para edición de permisos
  const [editingMembership, setEditingMembership] = useState<{
    membership_id: string
    studio_name: string
    role: string
    permissions: Record<string, boolean>
  } | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Record<string, boolean>>({})
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)

  // Dialog de invitación
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStudioId, setInviteStudioId] = useState<string>('')
  const [inviteRole, setInviteRole] = useState<StudioMemberRole>('collaborator')
  const [isInviting, setIsInviting] = useState(false)

  // Dialog de crear usuario (sin invitación por email)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createName, setCreateName] = useState('')
  const [createStudios, setCreateStudios] = useState<Array<{ studio_id: string; role: Exclude<StudioMemberRole, 'owner'> }>>([])
  const [isCreating, setIsCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchStudios()
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

  async function fetchStudios() {
    setStudiosLoading(true)
    setStudiosError(null)
    try {
      const response = await fetch('/api/admin/my-studios')
      if (!response.ok) throw new Error('Error al cargar studios')
      const data = await response.json()
      // Combinar con studios ya extraídos de usuarios
      const allStudios = data.studios.map((s: { id: string; name: string }) => ({
        id: s.id,
        name: s.name,
      }))
      setStudios((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]))
        for (const studio of allStudios) {
          map.set(studio.id, studio)
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
      })
      setStudiosError(null)
    } catch (error: unknown) {
      console.error('Error fetching studios:', error)
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los estudios'
      setStudiosError(message)
    } finally {
      setStudiosLoading(false)
    }
  }

  function applyFilters() {
    let result = [...users]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (user) =>
          user.email.toLowerCase().includes(term) || (user.name && user.name.toLowerCase().includes(term))
      )
    }

    if (filterType === 'superadmins') {
      result = result.filter((user) => user.is_superadmin)
    } else if (filterType === 'studio' && selectedStudio) {
      result = result.filter((user) => user.studios.some((s) => s.studio_id === selectedStudio))
    }

    setFilteredUsers(result)
  }

  async function handleInviteUser() {
    if (!inviteEmail) {
      toast.error('Debe ingresar un email')
      return
    }

    if (inviteStudioId && !inviteRole) {
      toast.error('Debe seleccionar un rol')
      return
    }

    setIsInviting(true)

    try {
      const request: InviteUserRequest = {
        email: inviteEmail,
        studio_id: inviteStudioId || undefined,
        role: inviteStudioId ? inviteRole : undefined,
      }

      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data: InviteUserResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al invitar usuario')
      }

      // Mostrar link de invitación si está disponible
      if (data.invitation_link) {
        toast.success(data.message, {
          description: 'Link de backup copiado al portapapeles',
          duration: 8000,
        })
        navigator.clipboard.writeText(data.invitation_link)
      } else {
        toast.success(data.message)
      }

      // Refrescar lista de usuarios
      await fetchUsers()

      // Cerrar dialog y limpiar
      setShowInviteDialog(false)
      setInviteEmail('')
      setInviteStudioId('')
      setInviteRole('collaborator')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al invitar usuario'
      toast.error(message)
    } finally {
      setIsInviting(false)
    }
  }

  async function handleCreateUser() {
    if (!createEmail) {
      toast.error('Debe ingresar un email')
      return
    }

    if (!createPassword || createPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsCreating(true)

    try {
      const request: CreateUserRequest = {
        email: createEmail,
        password: createPassword,
        name: createName || undefined,
        studios: createStudios.length > 0 ? createStudios : undefined,
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data: CreateUserResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear usuario')
      }

      toast.success(data.message || 'Usuario creado exitosamente')

      // Refrescar lista de usuarios
      await fetchUsers()

      // Cerrar dialog y limpiar
      setShowCreateDialog(false)
      setCreateEmail('')
      setCreatePassword('')
      setCreateName('')
      setCreateStudios([])
      setShowPassword(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al crear usuario'
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }

  function handleAddStudioToCreate() {
    if (studios.length === 0) return
    // Agregar primer studio disponible que no esté ya seleccionado
    const availableStudio = studios.find((s) => !createStudios.some((cs) => cs.studio_id === s.id))
    if (availableStudio) {
      setCreateStudios([...createStudios, { studio_id: availableStudio.id, role: 'collaborator' }])
    }
  }

  function handleRemoveStudioFromCreate(studioId: string) {
    setCreateStudios(createStudios.filter((s) => s.studio_id !== studioId))
  }

  function handleUpdateStudioRole(studioId: string, role: Exclude<StudioMemberRole, 'owner'>) {
    setCreateStudios(createStudios.map((s) => (s.studio_id === studioId ? { ...s, role } : s)))
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

  // Handlers para acordeón expandido
  async function handleSetUserPassword(userId: string) {
    if (!userPassword || userPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsSettingUserPassword(true)
    try {
      const response = await fetch('/api/admin/user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password: userPassword }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al establecer contraseña')
      }

      toast.success('Contraseña actualizada')
      setUserPassword('')
      setShowUserPassword(false)
      setPasswordForUserId(null)
    } catch (error) {
      console.error('Error setting password:', error)
      const message = error instanceof Error ? error.message : 'Error al establecer contraseña'
      toast.error(message)
    } finally {
      setIsSettingUserPassword(false)
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
      fetchUsers()
    } catch (error) {
      console.error('Error changing role:', error)
      toast.error('Error al cambiar rol')
    } finally {
      setChangingRoleFor(null)
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
      fetchUsers()
    } catch (error) {
      console.error('Error deleting membership:', error)
      toast.error('Error al eliminar membresía')
    }
  }

  async function handleSavePermissions() {
    if (!editingMembership) return

    setIsSavingPermissions(true)
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
      fetchUsers()
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Error al actualizar permisos')
    } finally {
      setIsSavingPermissions(false)
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con botones */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestión de Usuarios</h3>
          <p className="text-sm text-muted-foreground">Crea, invita y gestiona usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInviteDialog(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invitar
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Crear Usuario
          </Button>
        </div>
      </div>

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

      {/* Tabla con filas expandibles */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
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
                <TableCell colSpan={7} className="text-center py-8">
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    >
                      <TableCell className="w-8">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground">{user.name || '-'}</TableCell>
                      <TableCell>
                        {user.studios.length === 0 ? (
                          <span className="text-muted-foreground">Sin estudio</span>
                        ) : user.studios.length === 1 ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{user.studios[0].studio_name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">{user.studios.length} estudios</Badge>
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
                          <span className="text-xs text-muted-foreground">(ver detalle)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.is_superadmin && <Shield className="h-4 w-4 mx-auto text-amber-500" />}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.last_sign_in_at)}
                      </TableCell>
                    </TableRow>

                    {/* Fila expandida con acordeón */}
                    {isExpanded && (
                      <TableRow key={`${user.id}-expanded`}>
                        <TableCell colSpan={7} className="p-0 bg-muted/30">
                          <div className="p-4">
                            <Accordion type="multiple" defaultValue={["info", "memberships"]} className="w-full">
                              {/* Información del usuario */}
                              <AccordionItem value="info" className="border-b-0">
                                <AccordionTrigger className="py-2 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>Información</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 pt-2">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-medium">{user.email}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Registrado:</span>
                                        <span>{formatDate(user.created_at)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Último login:</span>
                                        <span>{formatDate(user.last_sign_in_at)}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                      <Shield className="h-4 w-4 text-amber-500" />
                                      <span className="text-sm">SuperAdmin</span>
                                      <Switch
                                        checked={user.is_superadmin}
                                        onCheckedChange={() => handleToggleSuperadmin(user.id, user.is_superadmin)}
                                      />
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              {/* Contraseña */}
                              <AccordionItem value="password" className="border-b-0">
                                <AccordionTrigger className="py-2 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Key className="h-4 w-4" />
                                    <span>Contraseña</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="pt-2">
                                    {passwordForUserId === user.id ? (
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex-1 max-w-xs">
                                          <Input
                                            type={showUserPassword ? 'text' : 'password'}
                                            placeholder="Nueva contraseña (min 6 caracteres)"
                                            value={userPassword}
                                            onChange={(e) => setUserPassword(e.target.value)}
                                            className="pr-10"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3"
                                            onClick={() => setShowUserPassword(!showUserPassword)}
                                          >
                                            {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                        <Button
                                          size="sm"
                                          onClick={() => handleSetUserPassword(user.id)}
                                          disabled={isSettingUserPassword || userPassword.length < 6}
                                        >
                                          {isSettingUserPassword ? 'Guardando...' : 'Guardar'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setPasswordForUserId(null)
                                            setUserPassword('')
                                            setShowUserPassword(false)
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPasswordForUserId(user.id)}
                                      >
                                        <Key className="h-4 w-4 mr-2" />
                                        Asignar nueva contraseña
                                      </Button>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              {/* Membresías */}
                              <AccordionItem value="memberships" className="border-b-0">
                                <AccordionTrigger className="py-2 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    <span>Membresías ({user.studios.length})</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-2 pt-2">
                                    {user.studios.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">Sin membresías</p>
                                    ) : (
                                      user.studios.map((studio) => (
                                        <div
                                          key={studio.membership_id}
                                          className="flex items-center justify-between p-3 rounded-md border bg-background"
                                        >
                                          <div className="flex items-center gap-3">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{studio.studio_name}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {studio.role === 'owner' ? (
                                              <Badge variant="default">owner</Badge>
                                            ) : (
                                              <Select
                                                value={studio.role}
                                                onValueChange={(value) => handleRoleChange(studio.membership_id, value)}
                                                disabled={changingRoleFor === studio.membership_id}
                                              >
                                                <SelectTrigger className="w-[130px] h-8">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="admin">admin</SelectItem>
                                                  <SelectItem value="collaborator">collaborator</SelectItem>
                                                  <SelectItem value="client">client</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            )}
                                            {studio.role !== 'owner' && studio.role !== 'admin' && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setEditingMembership({
                                                    membership_id: studio.membership_id,
                                                    studio_name: studio.studio_name,
                                                    role: studio.role,
                                                    permissions: studio.permissions || {}
                                                  })
                                                  setEditedPermissions(studio.permissions || {})
                                                }}
                                              >
                                                <Settings className="h-3 w-3" />
                                              </Button>
                                            )}
                                            {studio.role !== 'owner' && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleDeleteMembership(studio.membership_id, studio.studio_name)
                                                }}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))
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

      {/* Dialog editar permisos */}
      <Dialog open={!!editingMembership} onOpenChange={() => setEditingMembership(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editar Permisos
            </DialogTitle>
            <DialogDescription>
              {editingMembership?.studio_name} - Rol: {editingMembership?.role}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {PERMISSION_CONFIGS.map((perm) => (
              <div key={perm.key} className="flex items-center justify-between">
                <Label htmlFor={perm.key}>{perm.label}</Label>
                <Switch
                  id={perm.key}
                  checked={editedPermissions[perm.key] || false}
                  onCheckedChange={(checked) =>
                    setEditedPermissions({ ...editedPermissions, [perm.key]: checked })
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMembership(null)} disabled={isSavingPermissions}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
              {isSavingPermissions ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog invitar usuario */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitar Usuario
            </DialogTitle>
            <DialogDescription>
              Invita a un nuevo usuario por email. Si no existe, recibirá un email de confirmación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-studio">Estudio (opcional)</Label>
              {studiosError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                  {studiosError}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-2"
                    onClick={() => fetchStudios()}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : studiosLoading ? (
                <div className="text-sm text-muted-foreground p-2">
                  Cargando estudios...
                </div>
              ) : (
                <Select value={inviteStudioId || 'none'} onValueChange={(v) => setInviteStudioId(v === 'none' ? '' : v)}>
                  <SelectTrigger id="invite-studio">
                    <SelectValue placeholder="Sin estudio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin estudio</SelectItem>
                    {studios.map((studio) => (
                      <SelectItem key={studio.id} value={studio.id}>
                        {studio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {inviteStudioId && (
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rol *</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as StudioMemberRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="collaborator">Collaborator</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  No se puede invitar como owner. Solo hay 1 owner por studio.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)} disabled={isInviting}>
              Cancelar
            </Button>
            <Button onClick={handleInviteUser} disabled={isInviting}>
              {isInviting ? 'Invitando...' : 'Enviar Invitación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog crear usuario */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Crear Usuario
            </DialogTitle>
            <DialogDescription>
              Crear usuario directamente con contraseña. No se enviará email de invitación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">Nombre (opcional)</Label>
              <Input
                id="create-name"
                type="text"
                placeholder="Nombre del usuario"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Estudios (opcional)</Label>
                {studios.length > createStudios.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStudioToCreate}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar
                  </Button>
                )}
              </div>

              {createStudios.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin estudios asignados. El usuario podrá ser agregado después.
                </p>
              ) : (
                <div className="space-y-2">
                  {createStudios.map((cs) => {
                    const studio = studios.find((s) => s.id === cs.studio_id)
                    return (
                      <div
                        key={cs.studio_id}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                      >
                        <Select
                          value={cs.studio_id}
                          onValueChange={(v) => {
                            setCreateStudios(
                              createStudios.map((s) =>
                                s.studio_id === cs.studio_id ? { ...s, studio_id: v } : s
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue>{studio?.name || 'Seleccionar...'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {studios
                              .filter(
                                (s) =>
                                  s.id === cs.studio_id ||
                                  !createStudios.some((css) => css.studio_id === s.id)
                              )
                              .map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={cs.role}
                          onValueChange={(v) =>
                            handleUpdateStudioRole(cs.studio_id, v as Exclude<StudioMemberRole, 'owner'>)
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="collaborator">Collaborator</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveStudioFromCreate(cs.studio_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreating || !createEmail || createPassword.length < 6}>
              {isCreating ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
