/**
 * StudioCard - Card individual para mostrar un estudio
 *
 * Muestra información resumida del estudio con conteos de clientes y miembros
 */

import { Users, UserCog, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StudioCardProps {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin'
  clientCount?: number
  memberCount?: number
}

export function StudioCard({
  id,
  name,
  slug,
  role,
  clientCount = 0,
  memberCount = 0,
}: StudioCardProps) {
  const roleLabel = role === 'owner' ? 'Propietario' : 'Administrador'
  const roleColor = role === 'owner'
    ? 'bg-purple-100 text-purple-700 border-purple-300'
    : 'bg-blue-100 text-blue-700 border-blue-300'

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{slug}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn('text-xs', roleColor)}>
          {roleLabel}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Clientes</span>
          </div>
          <p className="text-xl font-semibold">{clientCount}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserCog className="h-4 w-4" />
            <span className="text-xs">Colaboradores</span>
          </div>
          <p className="text-xl font-semibold">{memberCount}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="default" size="sm" className="flex-1" asChild>
          <a href={`/admin/my-studios/${id}`}>
            Ver Estudio
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/admin/my-studios/${id}/members`}>
            <UserCog className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
