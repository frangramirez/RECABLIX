/**
 * MembersManager - Gestión de Miembros del Studio
 *
 * Permite a owners/admins gestionar miembros y sus permisos
 */

import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $session } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Shield, UserPlus, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { SubscriptionLimits, SubscriptionUsage } from '@/types/subscription'

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'collaborator' | 'client'
  permissions: {
    can_view_billing?: boolean
    can_manage_subscriptions?: boolean
    can_delete_members?: boolean
    can_delete_clients?: boolean
    can_export_data?: boolean
    can_import_data?: boolean
    can_generate_reports?: boolean
  }
  users: {
    email: string
  }
  created_at: string
}

interface PermissionConfig {
  key: keyof Member['permissions']
  label: string
  description: string
}

const PERMISSION_CONFIGS: PermissionConfig[] = [
  {
    key: 'can_view_billing',
    label: 'Ver Facturación',
    description: 'Puede ver información de facturación y pagos',
  },
  {
    key: 'can_manage_subscriptions',
    label: 'Gestionar Suscripciones',
    description: 'Puede cambiar el plan y gestionar la suscripción',
  },
  {
    key: 'can_delete_members',
    label: 'Eliminar Miembros',
    description: 'Puede eliminar otros miembros del studio',
  },
  {
    key: 'can_delete_clients',
    label: 'Eliminar Clientes',
    description: 'Puede eliminar clientes y sus datos',
  },
  {
    key: 'can_export_data',
    label: 'Exportar Datos',
    description: 'Puede exportar datos a Excel/CSV',
  },
  {
    key: 'can_import_data',
    label: 'Importar Datos',
    description: 'Puede importar datos desde archivos',
  },
  {
    key: 'can_generate_reports',
    label: 'Generar Reportes',
    description: 'Puede generar y descargar reportes PDF',
  },
]

interface MembersManagerProps {
  subscriptionLimits?: SubscriptionLimits | null
  subscriptionUsage?: SubscriptionUsage | null
  showLimits?: boolean
}

export function MembersManager({
  subscriptionLimits = null,
  subscriptionUsage = null,
  showLimits = false,
}: MembersManagerProps) {
  const { studio, role, is_superadmin, permissions } = useStore($session)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Member['permissions']>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Invite dialog state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'collaborator' | 'client'>('collaborator')
  const [inviting, setInviting] = useState(false)

  const canManageMembers = is_superadmin || role === 'owner' || role === 'admin'

  // Verificar si se alcanzó el límite para un rol específico
  const isLimitReached = (checkRole: 'admin' | 'collaborator' | 'client'): boolean => {
    if (!subscriptionLimits || !subscriptionUsage) return false

    const roleMap = {
      admin: { limit: subscriptionLimits.max_admins, usage: subscriptionUsage.admins },
      collaborator: {
        limit: subscriptionLimits.max_collaborators,
        usage: subscriptionUsage.collaborators,
      },
      client: { limit: subscriptionLimits.max_clients, usage: subscriptionUsage.clients },
    }

    const { limit, usage } = roleMap[checkRole]
    return limit !== null && usage >= limit
  }

  // Obtener mensaje de límite alcanzado
  const getLimitMessage = (checkRole: 'admin' | 'collaborator' | 'client'): string => {
    if (!subscriptionLimits || !subscriptionUsage) return ''

    const roleMap = {
      admin: { limit: subscriptionLimits.max_admins, usage: subscriptionUsage.admins },
      collaborator: {
        limit: subscriptionLimits.max_collaborators,
        usage: subscriptionUsage.collaborators,
      },
      client: { limit: subscriptionLimits.max_clients, usage: subscriptionUsage.clients },
    }

    const { limit, usage } = roleMap[checkRole]
    return limit !== null ? `${usage}/${limit}` : `${usage}/∞`
  }

  useEffect(() => {
    fetchMembers()
  }, [studio?.id])

  const fetchMembers = async () => {
    if (!studio?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/studio/members?studio_id=${studio.id}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setMembers(data.members || [])
    } catch (error) {
      console.error('Error fetching members:', error)
      toast.error('Error al cargar miembros')
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (member: Member) => {
    // Owner y superadmin pueden editar todos
    // Admin solo puede editar collaborator y client
    const canEdit =
      is_superadmin ||
      role === 'owner' ||
      (role === 'admin' && ['collaborator', 'client'].includes(member.role))

    if (!canEdit) {
      toast.error('No tienes permiso para editar este miembro')
      return
    }

    setEditingMember(member)
    setEditedPermissions(member.permissions || {})
    setIsDialogOpen(true)
  }

  const handleTogglePermission = (key: keyof Member['permissions']) => {
    setEditedPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSavePermissions = async () => {
    if (!editingMember) return

    try {
      const response = await fetch(`/api/studio/members/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: editedPermissions,
        }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Permisos actualizados correctamente')
      setIsDialogOpen(false)
      setEditingMember(null)
      fetchMembers()
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Error al actualizar permisos')
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('¿Estás seguro de eliminar este miembro?')) return

    if (!permissions?.can_delete_members && !is_superadmin && role !== 'owner') {
      toast.error('No tienes permiso para eliminar miembros')
      return
    }

    try {
      const response = await fetch(`/api/studio/members/${memberId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('Miembro eliminado')
      fetchMembers()
    } catch (error) {
      console.error('Error deleting member:', error)
      toast.error('Error al eliminar miembro')
    }
  }

  const handleInviteMember = async () => {
    if (!studio?.id) {
      toast.error('Error: No se pudo identificar el estudio')
      return
    }

    if (!inviteEmail.trim()) {
      toast.error('Ingrese un email válido')
      return
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      toast.error('El formato del email no es válido')
      return
    }

    try {
      setInviting(true)
      const response = await fetch('/api/studio/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studio_id: studio.id,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(`Miembro agregado: ${inviteEmail}`)
      setIsInviteDialogOpen(false)
      setInviteEmail('')
      setInviteRole('collaborator')
      fetchMembers()
    } catch (error) {
      console.error('Error inviting member:', error)
      toast.error('Error al agregar miembro')
    } finally {
      setInviting(false)
    }
  }

  const openInviteDialog = () => {
    setInviteEmail('')
    setInviteRole('collaborator')
    setIsInviteDialogOpen(true)
  }

  const getRoleBadgeColor = (memberRole: string) => {
    switch (memberRole) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'collaborator':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'client':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getRoleLabel = (memberRole: string) => {
    switch (memberRole) {
      case 'owner':
        return 'Propietario'
      case 'admin':
        return 'Administrador'
      case 'collaborator':
        return 'Colaborador'
      case 'client':
        return 'Cliente'
      default:
        return memberRole
    }
  }

  if (!canManageMembers) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600">No tienes permiso para gestionar miembros</p>
      </div>
    )
  }

  if (loading) {
    return <div className="p-6 text-center">Cargando miembros...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Miembros del Studio</h2>
          {showLimits && subscriptionUsage && (
            <p className="text-sm text-muted-foreground mt-1">
              Admins: {getLimitMessage('admin')} | Collaborators: {getLimitMessage('collaborator')} |
              Clients: {getLimitMessage('client')}
            </p>
          )}
        </div>
        {(is_superadmin || role === 'owner') && (
          <Button onClick={openInviteDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar Miembro
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Permisos Activos</TableHead>
              <TableHead>Fecha Alta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No hay miembros registrados
                </TableCell>
              </TableRow>
            ) : (
              members.map(member => {
                const activePerms = Object.entries(member.permissions || {}).filter(
                  ([_, value]) => value === true
                ).length

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.users?.email || 'Sin email'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {member.role === 'owner' || member.role === 'admin'
                          ? 'Todos'
                          : `${activePerms} / ${PERMISSION_CONFIGS.length}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(member.created_at).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {member.role !== 'owner' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {(permissions?.can_delete_members ||
                            is_superadmin ||
                            role === 'owner') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Edición de Permisos */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Permisos</DialogTitle>
            <DialogDescription>
              {editingMember?.users?.email} - {getRoleLabel(editingMember?.role || '')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editingMember?.role === 'owner' ? (
              <p className="text-sm text-gray-600">
                El propietario tiene todos los permisos automáticamente.
              </p>
            ) : (
              PERMISSION_CONFIGS.map(config => (
                <div key={config.key} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                  <Switch
                    checked={editedPermissions[config.key] || false}
                    onCheckedChange={() => handleTogglePermission(config.key)}
                    id={config.key}
                  />
                  <div className="flex-1">
                    <Label htmlFor={config.key} className="font-medium cursor-pointer">
                      {config.label}
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            {editingMember?.role !== 'owner' && (
              <Button onClick={handleSavePermissions}>Guardar Cambios</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Invitar Miembro */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar Miembro</DialogTitle>
            <DialogDescription>
              Agregue un nuevo miembro al estudio. El usuario debe tener una cuenta registrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email del usuario</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Rol</Label>
              <Select
                value={inviteRole}
                onValueChange={(value: 'admin' | 'collaborator' | 'client') =>
                  setInviteRole(value)
                }
                disabled={inviting}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">Administrador</span>
                      <span className="text-xs text-muted-foreground">
                        Acceso completo al estudio
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="collaborator">
                    <div className="flex flex-col">
                      <span className="font-medium">Colaborador</span>
                      <span className="text-xs text-muted-foreground">
                        Puede gestionar clientes y operaciones
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="client">
                    <div className="flex flex-col">
                      <span className="font-medium">Cliente</span>
                      <span className="text-xs text-muted-foreground">
                        Solo puede ver sus propios datos
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Advertencia de límite alcanzado */}
              {showLimits && isLimitReached(inviteRole) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">Límite alcanzado</p>
                    <p className="text-amber-700">
                      Ya alcanzaste el límite de {inviteRole}s ({getLimitMessage(inviteRole)}). No
                      podrás invitar más usuarios con este rol.
                    </p>
                  </div>
                </div>
              )}

              {/* Indicador de uso actual */}
              {showLimits && !isLimitReached(inviteRole) && subscriptionUsage && (
                <p className="text-xs text-muted-foreground">
                  Uso actual: {getLimitMessage(inviteRole)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancelar
            </Button>
            <Button onClick={handleInviteMember} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar Miembro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
