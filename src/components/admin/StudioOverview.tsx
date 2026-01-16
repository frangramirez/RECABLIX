/**
 * StudioOverview - Vista general de un estudio específico
 *
 * Muestra información del estudio con stats y accesos rápidos
 */

import { useState, useEffect } from 'react'
import {
  Building2,
  Users,
  UserCog,
  Receipt,
  RefreshCw,
  FileBarChart,
  Calendar,
  ArrowLeft,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  studioId: string
  studioName: string
  studioSlug: string
  schemaName: string
  role: 'owner' | 'admin'
  memberCount: number
  createdAt: string
}

interface QuickLink {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

export function StudioOverview({
  studioId,
  studioName,
  studioSlug,
  schemaName,
  role,
  memberCount,
  createdAt,
}: Props) {
  const [clientCount, setClientCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Intentar obtener conteo de clientes
    // Por ahora solo mostramos el member count que viene del server
    setLoading(false)
  }, [])

  const roleLabel = role === 'owner' ? 'Propietario' : 'Administrador'
  const roleColor = role === 'owner'
    ? 'bg-purple-100 text-purple-700 border-purple-300'
    : 'bg-blue-100 text-blue-700 border-blue-300'

  const quickLinks: QuickLink[] = [
    {
      name: 'Clientes',
      href: `/admin/my-studios/${studioId}/clients`,
      icon: Users,
      description: 'Ver y gestionar clientes',
    },
    {
      name: 'Operaciones',
      href: `/admin/my-studios/${studioId}/operations`,
      icon: Receipt,
      description: 'Transacciones y movimientos',
    },
    {
      name: 'Recategorización',
      href: `/admin/my-studios/${studioId}/recategorization`,
      icon: RefreshCw,
      description: 'Análisis de categorías',
    },
    {
      name: 'Reportes',
      href: `/admin/my-studios/${studioId}/reports`,
      icon: FileBarChart,
      description: 'Generar informes PDF',
    },
    {
      name: 'Colaboradores',
      href: `/admin/my-studios/${studioId}/members`,
      icon: UserCog,
      description: 'Gestionar miembros',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <a href="/admin/my-studios">
            <ArrowLeft className="h-5 w-5" />
          </a>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{studioName}</h1>
            <Badge variant="outline" className={cn('text-xs', roleColor)}>
              {roleLabel}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm font-mono">{studioSlug}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Colaboradores</p>
              <p className="text-2xl font-bold">{memberCount}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={`/admin/my-studios/${studioId}/members`}>
              Gestionar
            </a>
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{clientCount}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={`/admin/my-studios/${studioId}/clients`}>
              Ver clientes
            </a>
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Creado</p>
              <p className="text-lg font-medium">
                {new Date(createdAt).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link) => {
            const LinkIcon = link.icon
            return (
              <a
                key={link.name}
                href={link.href}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <LinkIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{link.name}</p>
                  <p className="text-xs text-muted-foreground">{link.description}</p>
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* Info técnica (solo visible para debug) */}
      <div className="text-xs text-muted-foreground border-t border-border pt-4 mt-8">
        <p>Schema: <code className="bg-muted px-1 rounded">{schemaName}</code></p>
        <p>ID: <code className="bg-muted px-1 rounded">{studioId}</code></p>
      </div>
    </div>
  )
}
