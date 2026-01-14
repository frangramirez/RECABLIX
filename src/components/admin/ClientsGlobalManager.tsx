import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Eye, Building2, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import type { GlobalClient } from '@/pages/api/admin/clients'

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

interface PeriodInfo {
  code: string
  sales_start: string
  sales_end: string
}

// Helper para leer URL params
function getInitialParams() {
  if (typeof window === 'undefined') return { search: '', studio: '', category: '' }
  const params = new URLSearchParams(window.location.search)
  return {
    search: params.get('search') || '',
    studio: params.get('studio') || '',
    category: params.get('category') || '',
  }
}

export function ClientsGlobalManager() {
  const [clients, setClients] = useState<GlobalClient[]>([])
  const [studios, setStudios] = useState<{ id: string; name: string }[]>([])
  const [period, setPeriod] = useState<PeriodInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Filtros - inicializar desde URL params
  const initialParams = getInitialParams()
  const [searchTerm, setSearchTerm] = useState(initialParams.search)
  const [studioFilter, setStudioFilter] = useState<string>(initialParams.studio)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialParams.category)

  // Modal
  const [selectedClient, setSelectedClient] = useState<GlobalClient | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  // Sincronizar filtros con URL params
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (studioFilter && studioFilter !== 'all') params.set('studio', studioFilter)
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter)

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname

    // Solo actualizar si cambió
    if (window.location.search !== (newUrl.includes('?') ? newUrl.split('?')[1] : '')) {
      history.replaceState(null, '', newUrl)
    }
  }, [searchTerm, studioFilter, categoryFilter])

  async function fetchClients() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/clients')
      if (!response.ok) {
        throw new Error('Error al cargar clientes')
      }
      const data = await response.json()
      setClients(data.clients || [])
      setStudios(data.studios || [])
      setPeriod(data.period || null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar clientes'
      console.error('Error fetching clients:', error)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar clientes en el cliente
  const filteredClients = clients.filter(client => {
    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      if (!client.name.toLowerCase().includes(term) &&
          !(client.cuit && client.cuit.includes(term))) {
        return false
      }
    }

    // Filtro por estudio
    if (studioFilter && client.studio_id !== studioFilter) {
      return false
    }

    // Filtro por categoría nueva
    if (categoryFilter && client.new_category !== categoryFilter) {
      return false
    }

    return true
  })

  function formatCurrency(value: number | null): string {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value)
  }

  function getCategoryBadgeVariant(category: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (!category) return 'outline'
    const catIndex = CATEGORIES.indexOf(category)
    if (catIndex <= 3) return 'default' // A-D verde
    if (catIndex <= 6) return 'secondary' // E-G amarillo
    return 'destructive' // H-K rojo
  }

  function getCategoryChange(prev: string | null, next: string | null): { direction: 'up' | 'down' | 'same'; steps: number } {
    if (!prev || !next) return { direction: 'same', steps: 0 }
    const prevIndex = CATEGORIES.indexOf(prev)
    const nextIndex = CATEGORIES.indexOf(next)
    const steps = nextIndex - prevIndex
    if (steps > 0) return { direction: 'up', steps }
    if (steps < 0) return { direction: 'down', steps: Math.abs(steps) }
    return { direction: 'same', steps: 0 }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando clientes...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info del período */}
      {period && (
        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          Período activo: <span className="font-medium">{period.code}</span> (ventas {period.sales_start} - {period.sales_end})
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={studioFilter} onValueChange={setStudioFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estudios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estudios</SelectItem>
            {studios.map((studio) => (
              <SelectItem key={studio.id} value={studio.id}>
                {studio.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                Categoría {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(studioFilter || categoryFilter || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setStudioFilter('')
              setCategoryFilter('')
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Conteo */}
      <p className="text-sm text-muted-foreground">
        {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
        {(studioFilter || categoryFilter || searchTerm) && ` (de ${clients.length} total)`}
      </p>

      {/* Tabla */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead>Estudio</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-center">Cat. Ant.</TableHead>
              <TableHead className="text-center">Nueva Cat.</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchTerm || studioFilter || categoryFilter
                      ? 'No hay clientes que coincidan con los filtros.'
                      : 'No hay clientes registrados con RECABLIX.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => {
                const change = getCategoryChange(client.previous_category, client.new_category)
                return (
                  <TableRow key={client.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {client.cuit || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{client.studio_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(client.period_sales)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(client.period_purchases)}
                    </TableCell>
                    <TableCell className="text-center">
                      {client.previous_category ? (
                        <Badge variant="outline">{client.previous_category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {client.new_category ? (
                          <>
                            <Badge variant={getCategoryBadgeVariant(client.new_category)}>
                              {client.new_category}
                            </Badge>
                            {change.direction === 'up' && (
                              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                            )}
                            {change.direction === 'down' && (
                              <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClient(client)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Preview Recategorización (E10-S06) */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recategorización: {selectedClient?.name}</DialogTitle>
            <DialogDescription>
              CUIT: {selectedClient?.cuit || 'No registrado'} | Estudio: {selectedClient?.studio_name}
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4">
              {/* Datos del período */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Datos del Período</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ventas:</span>
                    <span className="ml-2 font-mono font-medium">
                      {formatCurrency(selectedClient.period_sales)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Compras:</span>
                    <span className="ml-2 font-mono font-medium">
                      {formatCurrency(selectedClient.period_purchases)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actividad:</span>
                    <span className="ml-2">{selectedClient.activity || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Provincia:</span>
                    <span className="ml-2">{selectedClient.province_code || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Comparativa de categorías */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-3">Comparativa</h4>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Anterior</p>
                    <Badge variant="outline" className="text-lg px-4 py-1">
                      {selectedClient.previous_category || '?'}
                    </Badge>
                  </div>

                  <ArrowRight className="h-5 w-5 text-muted-foreground" />

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Nueva</p>
                    <Badge
                      variant={getCategoryBadgeVariant(selectedClient.new_category)}
                      className="text-lg px-4 py-1"
                    >
                      {selectedClient.new_category || '?'}
                    </Badge>
                  </div>

                  {(() => {
                    const change = getCategoryChange(
                      selectedClient.previous_category,
                      selectedClient.new_category
                    )
                    if (change.direction === 'same') return null
                    return (
                      <div className={`text-center px-3 py-1 rounded-md ${
                        change.direction === 'up'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-green-500/10 text-green-600'
                      }`}>
                        <p className="text-xs font-medium">
                          {change.direction === 'up' ? 'Sube' : 'Baja'}
                        </p>
                        <p className="text-lg font-bold">
                          {change.direction === 'up' ? '+' : '-'}{change.steps}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Nota informativa */}
              <p className="text-xs text-muted-foreground text-center">
                Para ver el desglose completo de componentes, accede desde el panel del estudio.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
