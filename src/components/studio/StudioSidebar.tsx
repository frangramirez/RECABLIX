import {
  Users,
  BarChart3,
  LayoutDashboard,
  FileText,
  Settings,
  Shield,
  Receipt
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/SessionProvider'
import { ContablixLogo } from '@/components/ui/contablix-logo'

const navigation = [
  { name: 'Dashboard', href: '/studio', icon: LayoutDashboard },
  { name: 'Clientes', href: '/studio/clients', icon: Users },
  { name: 'Operaciones', href: '/studio/operations', icon: Receipt },
  { name: 'Recategorización', href: '/studio/recategorization', icon: BarChart3 },
  { name: 'Reportes', href: '/studio/reports', icon: FileText },
]

export function StudioSidebar() {
  const session = useSession()
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const isSuperAdmin = session.studio?.is_superadmin

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo Contablix */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <ContablixLogo height={20} />
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

      {/* Superadmin Link */}
      {isSuperAdmin && (
        <div className="px-3 pb-2">
          <div className="border-t border-border pt-3 mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Superadmin
            </p>
          </div>
          <a
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Shield className="h-4 w-4" />
            Panel SuperAdmin
          </a>
        </div>
      )}

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
