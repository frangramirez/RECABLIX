/**
 * MyStudiosNav - Menú expandible de estudios para el sidebar
 *
 * Muestra una lista de estudios del superadmin con submenú expandible
 * para acceder a Clientes, Operaciones, Recategorización y Colaboradores
 */

import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Users,
  Receipt,
  RefreshCw,
  UserCog,
  FileBarChart,
  Plus,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { $impersonatedStudio } from '@/stores/impersonate'
import type { MyStudio } from '@/stores/session'

interface StudioNavItem {
  name: string
  href: (studioId: string) => string
  icon: React.ComponentType<{ className?: string }>
}

const studioNavItems: StudioNavItem[] = [
  {
    name: 'Clientes',
    href: (id) => `/admin/my-studios/${id}/clients`,
    icon: Users,
  },
  {
    name: 'Operaciones',
    href: (id) => `/admin/my-studios/${id}/operations`,
    icon: Receipt,
  },
  {
    name: 'Recategorización',
    href: (id) => `/admin/my-studios/${id}/recategorization`,
    icon: RefreshCw,
  },
  {
    name: 'Reportes',
    href: (id) => `/admin/my-studios/${id}/reports`,
    icon: FileBarChart,
  },
  {
    name: 'Colaboradores',
    href: (id) => `/admin/my-studios/${id}/members`,
    icon: UserCog,
  },
]

interface Props {
  studios: MyStudio[]
}

export function MyStudiosNav({ studios }: Props) {
  const impersonated = useStore($impersonatedStudio)
  const [expandedStudios, setExpandedStudios] = useState<Set<string>>(new Set())
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname)

      // Auto-expandir el estudio activo basado en la URL
      const match = window.location.pathname.match(/\/admin\/my-studios\/([^/]+)/)
      if (match) {
        setExpandedStudios(new Set([match[1]]))
      }
    }
  }, [])

  const toggleStudio = (studioId: string) => {
    setExpandedStudios((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(studioId)) {
        newSet.delete(studioId)
      } else {
        newSet.add(studioId)
      }
      return newSet
    })
  }

  const isStudioActive = (studioId: string) => {
    return currentPath.includes(`/admin/my-studios/${studioId}`)
  }

  const isItemActive = (studioId: string, itemHref: string) => {
    const href = typeof itemHref === 'function' ? itemHref(studioId) : itemHref
    return currentPath.startsWith(href)
  }

  // Si está impersonando, mostrar indicador especial
  const isImpersonating = !!impersonated

  return (
    <div className="space-y-1">
      {/* Header de sección */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isImpersonating ? (
            <Eye className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              isImpersonating ? 'text-amber-600' : 'text-muted-foreground'
            )}
          >
            {isImpersonating ? 'Viendo Estudio' : 'Mis Estudios'}
          </p>
        </div>
      </div>

      {/* Si está impersonando, mostrar el estudio impersonado */}
      {isImpersonating && impersonated && (
        <div className="px-3 py-1">
          <p className="text-xs text-amber-600 font-medium truncate" title={impersonated.name}>
            {impersonated.name}
          </p>
        </div>
      )}

      {/* Lista de estudios propios */}
      {!isImpersonating && studios.length === 0 && (
        <a
          href="/admin/my-studio/setup"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Configurar estudio
        </a>
      )}

      {!isImpersonating &&
        studios.map((studio) => {
          const isExpanded = expandedStudios.has(studio.id)
          const isActive = isStudioActive(studio.id)

          return (
            <div key={studio.id}>
              {/* Studio header - clickeable para expandir */}
              <button
                onClick={() => toggleStudio(studio.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate flex-1" title={studio.name}>
                  {studio.name}
                </span>
              </button>

              {/* Sub-navegación */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
                  {studioNavItems.map((item) => {
                    const href = item.href(studio.id)
                    const ItemIcon = item.icon
                    const itemIsActive = isItemActive(studio.id, href)

                    return (
                      <a
                        key={item.name}
                        href={href}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
                          itemIsActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5" />
                        {item.name}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      {/* Link para asociar más estudios */}
      {!isImpersonating && studios.length > 0 && (
        <a
          href="/admin/my-studio/setup"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Asociar estudio
        </a>
      )}
    </div>
  )
}
