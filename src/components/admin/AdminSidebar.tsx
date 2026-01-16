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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { $impersonatedStudio, loadImpersonatedStudio } from '@/stores/impersonate'
import { MyStudiosNav } from './MyStudiosNav'
import { ContablixIcon } from '@/components/ui/contablix-logo'
import type { MyStudio } from '@/stores/session'

const adminNavigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Períodos', href: '/admin/periods', icon: Calendar },
  { name: 'Escalas', href: '/admin/scales', icon: Scale },
  { name: 'Componente Provincial', href: '/admin/fees', icon: Receipt },
  { name: 'Estudios', href: '/admin/studios', icon: Building2 },
  { name: 'Clientes', href: '/admin/clients', icon: Users },
  { name: 'Import/Export', href: '/admin/import-export', icon: FileSpreadsheet },
]

interface Props {
  myStudios?: MyStudio[]
  primaryStudioId?: string | null
  primaryStudioName?: string | null
}

export function AdminSidebar({
  myStudios = [],
  primaryStudioId,
  primaryStudioName,
}: Props) {
  const impersonated = useStore($impersonatedStudio)
  const [loaded, setLoaded] = useState(false)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  useEffect(() => {
    loadImpersonatedStudio()
    setLoaded(true)
  }, [])

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-border">
        <ContablixIcon size={32} />
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
            (item.href !== '/admin' && currentPath.startsWith(item.href) && !currentPath.startsWith('/admin/my-studio') && !currentPath.startsWith('/admin/my-studios'))

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

        {/* Mis Estudios - Menú expandible */}
        {loaded && <MyStudiosNav studios={myStudios} />}
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
