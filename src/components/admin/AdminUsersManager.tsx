import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Search, Shield, Building2, User, UserPlus, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { UserWithRoles } from '@/pages/api/admin/users'
import type { InviteUserRequest, InviteUserResponse, StudioMemberRole } from '@/types/subscription'

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
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [studiosError, setStudiosError] = useState<string | null>(null)
  const [studiosLoading, setStudiosLoading] = useState(false)

  // Dialog de invitación
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStudioId, setInviteStudioId] = useState<string>('')
  const [inviteRole, setInviteRole] = useState<StudioMemberRole>('collaborator')
  const [isInviting, setIsInviting] = useState(false)

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

      toast.success(data.message)

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con botón de invitar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestión de Usuarios</h3>
          <p className="text-sm text-muted-foreground">Invita y gestiona usuarios del sistema</p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Usuario
        </Button>
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
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedUser(user)}
                >
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
              ))
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
            <DialogDescription>Informacion del usuario y sus membresías</DialogDescription>
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
                  <span className="text-sm text-muted-foreground">SuperAdmin:</span>
                  <span>
                    {selectedUser.is_superadmin ? <Badge className="bg-amber-500">Si</Badge> : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Ultimo login:</span>
                  <span className="text-sm">{formatDate(selectedUser.last_sign_in_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Registrado:</span>
                  <span className="text-sm">{formatDate(selectedUser.created_at)}</span>
                </div>
              </div>

              {selectedUser.studios.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Membresías ({selectedUser.studios.length})</h4>
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
                        <Badge variant={getRoleBadgeVariant(studio.role)}>{studio.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
    </div>
  )
}
