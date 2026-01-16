import { useState, useEffect } from 'react'
import { useSession } from '@/components/providers/SessionProvider'
import { useTenantSupabase } from '@/hooks/useTenantSupabase'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Search, Pencil, Trash2, FileText, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { stripCUITDashes } from '@/lib/validation/cuit'

interface Client {
  id: string
  name: string
  cuit: string | null
  activity: 'BIENES' | 'SERVICIOS' | 'LOCACION' | 'SOLO_LOC_2_INM' | null
  province_code: string | null
  works_in_rd: boolean | null
  is_retired: boolean | null
  dependents: number | null
  previous_category: string | null
}

const ACTIVITIES = [
  { value: 'all', label: 'Todas las actividades' },
  { value: 'BIENES', label: 'Bienes' },
  { value: 'SERVICIOS', label: 'Servicios' },
  { value: 'LOCACION', label: 'Locación' },
  { value: 'SOLO_LOC_2_INM', label: 'Solo Locación (≤2 inm)' },
]

const CATEGORIES = ['all', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

export function ClientsTable() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activityFilter, setActivityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const { toast } = useToast()

  // Obtener contexto del tenant para queries
  const session = useSession()
  const tenantContext = session.studio
    ? { studioId: session.studio.id, schemaName: session.studio.schema_name }
    : null
  const { query, isReady } = useTenantSupabase(tenantContext)

  useEffect(() => {
    if (isReady) {
      fetchClients()
    }
  }, [isReady])

  const fetchClients = async () => {
    // Query usa tenant schema si USE_TENANT_SCHEMAS=true
    const { data, error } = await query('clients')
      .select(`
        id,
        name,
        cuit,
        reca_client_data (
          activity,
          province_code,
          works_in_rd,
          is_retired,
          dependents,
          previous_category
        )
      `)
      .contains('apps', ['recablix'])
      .order('name')

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      // Flatten the nested structure
      const flattenedData = data?.map(client => ({
        id: client.id,
        name: client.name,
        cuit: client.cuit,
        activity: (client.reca_client_data as any)?.[0]?.activity || null,
        province_code: (client.reca_client_data as any)?.[0]?.province_code || null,
        works_in_rd: (client.reca_client_data as any)?.[0]?.works_in_rd || false,
        is_retired: (client.reca_client_data as any)?.[0]?.is_retired || false,
        dependents: (client.reca_client_data as any)?.[0]?.dependents || 0,
        previous_category: (client.reca_client_data as any)?.[0]?.previous_category || null,
      })) || []

      setClients(flattenedData)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar cliente "${name}"? También se eliminarán sus transacciones.`)) return

    const { error } = await query('clients').delete().eq('id', id)
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      fetchClients()
      toast({ title: 'Eliminado', description: 'Cliente eliminado' })
    }
  }

  const handleExport = async () => {
    const { data } = await query('clients')
      .select(`
        name,
        cuit,
        reca_client_data (
          activity,
          province_code,
          works_in_rd,
          is_retired,
          dependents,
          local_m2,
          annual_rent,
          annual_mw,
          previous_category,
          previous_fee
        )
      `)
      .contains('apps', ['recablix'])
      .order('name')

    if (!data) return

    const exportData = data.map(c => {
      const reca = (c.reca_client_data as any)?.[0] || {}
      return {
        Nombre: c.name,
        CUIT: stripCUITDashes(c.cuit),
        Actividad: reca.activity || 'SERVICIOS',
        Provincia: reca.province_code || '901',
        RD: reca.works_in_rd ? 'SI' : 'NO',
        Jubilado: reca.is_retired ? 'SI' : 'NO',
        Adherentes: reca.dependents || 0,
        M2: reca.local_m2 || '',
        Alquiler: reca.annual_rent || '',
        MW: reca.annual_mw || '',
        CatAnt: reca.previous_category || '',
        CuotaAnt: reca.previous_fee || '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes-${new Date().toISOString().split('T')[0]}.xlsx`)

    toast({ title: 'Exportado', description: 'Archivo descargado correctamente' })
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = search === '' ||
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.cuit && client.cuit.includes(search))
    const matchesActivity = activityFilter === 'all' || client.activity === activityFilter
    const matchesCategory = categoryFilter === 'all' || client.previous_category === categoryFilter
    return matchesSearch && matchesActivity && matchesCategory
  })

  const getActivityLabel = (activity: string | null) => {
    if (!activity) return '-'
    const found = ACTIVITIES.find(a => a.value === activity)
    return found?.label || activity
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o CUIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITIES.map(a => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.slice(1).map(c => (
              <SelectItem key={c} value={c}>Cat {c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />Exportar
        </Button>
      </div>

      <div className="bg-white rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead>Actividad</TableHead>
              <TableHead>Cat Ant</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="font-mono text-sm">{client.cuit || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getActivityLabel(client.activity)}</Badge>
                  </TableCell>
                  <TableCell>
                    {client.previous_category ? (
                      <Badge>{client.previous_category}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {client.works_in_rd && <Badge variant="secondary">RD</Badge>}
                      {client.is_retired && <Badge variant="secondary">Jub</Badge>}
                      {client.dependents && client.dependents > 0 && <Badge variant="secondary">+{client.dependents}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={`/studio/clients/${client.id}`}>
                          <Pencil className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" asChild>
                        <a href={`/studio/clients/${client.id}/transactions`}>
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id, client.name)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-gray-500">
        Mostrando {filteredClients.length} de {clients.length} clientes
      </p>
    </div>
  )
}
