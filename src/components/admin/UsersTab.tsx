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
import { Search, Shield, Building2, User } from 'lucide-react'
import { toast } from 'sonner'
import type { UserWithRoles } from '@/pages/api/admin/users'

type FilterType = 'all' | 'superadmins' | 'studio'

export function UsersTab() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedStudio, setSelectedStudio] = useState<string>('')
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([])
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)

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
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedUser(user)}
                >
                  <TableCell className="font-medium">{user.email}</TableCell>
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
                        <Badge variant={getRoleBadgeVariant(studio.role)}>
                          {studio.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
