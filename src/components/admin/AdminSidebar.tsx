import { useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'
import {
  Calendar,
  Scale,
  Receipt,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  Users,
  FolderOpen,
  FileText,
  RefreshCw,
  FileBarChart,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { $impersonatedStudio, loadImpersonatedStudio } from '@/stores/impersonate'

const adminNavigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Períodos', href: '/admin/periods', icon: Calendar },
  { name: 'Escalas', href: '/admin/scales', icon: Scale },
  { name: 'Componentes Cuota', href: '/admin/fees', icon: Receipt },
  { name: 'Estudios', href: '/admin/studios', icon: Building2 },
  { name: 'Clientes', href: '/admin/clients', icon: Users },
  { name: 'Import/Export', href: '/admin/import-export', icon: FileSpreadsheet },
]

const myStudioNavigation = [
  { name: 'Mis Clientes', href: '/admin/my-studio/clients', icon: Users },
  { name: 'Operaciones', href: '/admin/my-studio/operations', icon: Receipt },
  { name: 'Recategorización', href: '/admin/my-studio/recategorization', icon: RefreshCw },
  { name: 'Reportes', href: '/admin/my-studio/reports', icon: FileBarChart },
]

interface Props {
  studioId?: string | null
  studioName?: string | null
}

export function AdminSidebar({ studioId: ownStudioId, studioName: ownStudioName }: Props = {}) {
  const impersonated = useStore($impersonatedStudio)
  const [loaded, setLoaded] = useState(false)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  useEffect(() => {
    loadImpersonatedStudio()
    setLoaded(true)
  }, [])

  // Usar estudio impersonado si existe, sino el propio
  const activeStudioId = impersonated?.id || ownStudioId
  const activeStudioName = impersonated?.name || ownStudioName
  const isImpersonating = !!impersonated

  // Generar URL con query param si está impersonando
  const getMyStudioHref = (basePath: string) => {
    if (impersonated) {
      return `${basePath}?studioId=${impersonated.id}`
    }
    return basePath
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
          R
        </div>
        <div>
          <h1 className="font-semibold text-foreground">RECABLIX</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SuperAdmin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Panel Admin Section */}
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Panel Admin
          </p>
        </div>
        {adminNavigation.map((item) => {
          const isActive = currentPath === item.href ||
            (item.href !== '/admin' && currentPath.startsWith(item.href) && !currentPath.startsWith('/admin/my-studio'))

          return (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </a>
          )
        })}

        {/* Separator */}
        <div className="my-4 border-t border-border" />

        {/* Mi Estudio / Viendo Estudio Section */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            {isImpersonating ? (
              <Eye className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <p className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isImpersonating ? "text-amber-600" : "text-muted-foreground"
            )}>
              {isImpersonating ? 'Viendo Estudio' : 'Mi Estudio'}
            </p>
          </div>
          {activeStudioName ? (
            <p className={cn(
              "text-xs mt-1 truncate",
              isImpersonating ? "text-amber-600 font-medium" : "text-primary"
            )} title={activeStudioName}>
              {activeStudioName}
            </p>
          ) : (
            <p className="text-xs text-amber-500 mt-1">Sin estudio</p>
          )}
        </div>

        {loaded && activeStudioId ? (
          myStudioNavigation.map((item) => {
            const href = getMyStudioHref(item.href)
            const isActive = currentPath.startsWith(item.href)

            return (
              <a
                key={item.name}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? isImpersonating
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </a>
            )
          })
        ) : !loaded ? null : (
          <a
            href="/admin/my-studio/setup"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Configurar estudio
          </a>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <a
          href="/admin/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </a>
      </div>
    </aside>
  )
}
