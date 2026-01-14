import {
  Users,
  BarChart3,
  LayoutDashboard,
  FileText,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/studio', icon: LayoutDashboard },
  { name: 'Clientes', href: '/studio/clients', icon: Users },
  { name: 'Recategorización', href: '/studio/recategorization', icon: BarChart3 },
  { name: 'Reportes', href: '/studio/reports', icon: FileText },
]

export function StudioSidebar() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
          R
        </div>
        <div>
          <h1 className="font-semibold text-foreground">RECABLIX</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Panel de Estudio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPath === item.href ||
            (item.href !== '/studio' && currentPath.startsWith(item.href))

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
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <a
          href="/studio/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </a>
      </div>
    </aside>
  )
}
