import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { LogOut, Shield, Eye, X, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import {
  $impersonatedStudio,
  setImpersonatedStudio,
  clearImpersonatedStudio,
  loadImpersonatedStudio,
} from '@/stores/impersonate'

interface Studio {
  id: string
  name: string
  slug: string
}

export function AdminHeader() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [loading, setLoading] = useState(true)
  const impersonated = useStore($impersonatedStudio)

  // TODO: Obtener datos del usuario desde el store cuando auth esté implementado
  const email = 'admin@example.com'

  useEffect(() => {
    loadImpersonatedStudio()
    fetchStudios()
  }, [])

  const fetchStudios = async () => {
    const { data } = await supabase
      .from('studios')
      .select('id, name, slug')
      .order('name')
    setStudios(data || [])
    setLoading(false)
  }

  const handleSelectStudio = (studioId: string) => {
    if (studioId === 'none') {
      clearImpersonatedStudio()
      return
    }
    const studio = studios.find(s => s.id === studioId)
    if (studio) {
      setImpersonatedStudio(studio)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Left side - Title */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Panel de Administración</span>
      </div>

      {/* Center - Studio selector */}
      <div className="flex items-center gap-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <Select
          value={impersonated?.id || 'none'}
          onValueChange={handleSelectStudio}
          disabled={loading}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Ver como estudio..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Sin seleccionar</span>
            </SelectItem>
            {studios.map(s => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {impersonated && (
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              Viendo: {impersonated.name}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => clearImpersonatedStudio()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Right side - User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-3 h-auto py-1.5 px-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                SuperAdmin
              </Badge>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {email}
              </span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">SuperAdmin</span>
              <span className="text-xs text-muted-foreground font-normal">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
