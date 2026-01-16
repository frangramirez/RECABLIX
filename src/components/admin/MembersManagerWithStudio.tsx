/**
 * MembersManagerWithStudio - Gestión de Miembros del Studio (con studioId explícito)
 *
 * Versión del MembersManager que acepta studioId como prop
 * para usar en /admin/my-studios/[studioId]/members
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Shield, UserPlus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

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

interface Props {
  studioId: string
  studioName: string
}

export function MembersManagerWithStudio({ studioId, studioName }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Member['permissions']>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (studioId) {
      fetchMembers()
    }
  }, [studioId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/studio/members?studio_id=${studioId}`)
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
    // Solo owners/admins pueden editar, y solo a roles inferiores
    const canEdit = ['collaborator', 'client'].includes(member.role)

    if (!canEdit && member.role !== 'admin') {
      toast.error('No se pueden editar los permisos del propietario')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Cargando miembros...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Miembros de {studioName}</h2>
        <Button onClick={() => toast.info('Función de invitar pendiente')}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Miembro
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
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
    </div>
  )
}
