import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Save, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface Period {
  id: string
  code: string
  year: number
  semester: number
}

interface FeeComponent {
  id?: string
  reca_id: string
  component_code: string
  description: string | null
  component_type: 'IMP' | 'JUB' | 'OS' | 'IBP'
  category: string
  value: number | null
  province_code: string | null
  has_municipal: boolean
}

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

const PROVINCES = [
  { code: '901', name: 'CABA' },
  { code: '902', name: 'Buenos Aires' },
  { code: '903', name: 'Catamarca' },
  { code: '904', name: 'Córdoba' },
  { code: '905', name: 'Corrientes' },
  { code: '906', name: 'Chaco' },
  { code: '907', name: 'Chubut' },
  { code: '908', name: 'Entre Ríos' },
  { code: '909', name: 'Formosa' },
  { code: '910', name: 'Jujuy' },
  { code: '911', name: 'La Pampa' },
  { code: '912', name: 'La Rioja' },
  { code: '913', name: 'Mendoza' },
  { code: '914', name: 'Misiones' },
  { code: '915', name: 'Neuquén' },
  { code: '916', name: 'Río Negro' },
  { code: '917', name: 'Salta' },
  { code: '918', name: 'San Juan' },
  { code: '919', name: 'San Luis' },
  { code: '920', name: 'Santa Cruz' },
  { code: '921', name: 'Santa Fe' },
  { code: '922', name: 'Santiago del Estero' },
  { code: '923', name: 'Tierra del Fuego' },
  { code: '924', name: 'Tucumán' },
]

interface Props {
  periods: Period[]
}

type ComponentType = 'IMP' | 'JUB' | 'OS' | 'IBP'

export function FeesManager({ periods }: Props) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<ComponentType>('IMP')
  const [components, setComponents] = useState<FeeComponent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(periods[0].id)
    }
  }, [periods])

  useEffect(() => {
    if (selectedPeriodId) {
      fetchComponents()
    }
  }, [selectedPeriodId, activeTab])

  async function fetchComponents() {
    if (!selectedPeriodId) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('reca_fee_components')
        .select('*')
        .eq('reca_id', selectedPeriodId)
        .eq('component_type', activeTab)

      if (error) throw error

      // Si no existen, crear plantilla vacía según tipo
      if (!data || data.length === 0) {
        setComponents(createEmptyComponents())
      } else {
        setComponents(data)
      }
    } catch (error: any) {
      console.error('Error fetching components:', error)
      toast.error(error.message || 'Error al cargar componentes')
    } finally {
      setIsLoading(false)
    }
  }

  function createEmptyComponents(): FeeComponent[] {
    const baseComponent = {
      reca_id: selectedPeriodId,
      component_type: activeTab,
      description: null,
      value: null,
      province_code: null,
      has_municipal: false,
    }

    switch (activeTab) {
      case 'IMP':
        return CATEGORIES.flatMap((cat) => [
          {
            ...baseComponent,
            component_code: 'B20',
            category: cat,
            description: 'Impositivo Bienes',
          },
          {
            ...baseComponent,
            component_code: 'S20',
            category: cat,
            description: 'Impositivo Servicios',
          },
        ])
      case 'JUB':
        return CATEGORIES.flatMap((cat) => [
          {
            ...baseComponent,
            component_code: '021',
            category: cat,
            description: 'Jubilatorio Aportes',
          },
          {
            ...baseComponent,
            component_code: '21J',
            category: cat,
            description: 'Jubilatorio Mínimo',
          },
        ])
      case 'OS':
        return CATEGORIES.map((cat) => ({
          ...baseComponent,
          component_code: '024',
          category: cat,
          description: 'Obra Social',
        }))
      case 'IBP':
        return PROVINCES.flatMap((prov) =>
          CATEGORIES.map((cat) => ({
            ...baseComponent,
            component_code: prov.code,
            category: cat,
            description: prov.name,
            province_code: prov.code,
          }))
        )
      default:
        return []
    }
  }

  function updateComponent(
    code: string,
    category: string,
    field: keyof FeeComponent,
    value: any
  ) {
    setComponents((prev) =>
      prev.map((c) =>
        c.component_code === code && c.category === category
          ? { ...c, [field]: value }
          : c
      )
    )
  }

  async function handleSave() {
    if (!selectedPeriodId) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: components.map((c) => ({
            id: c.id,
            reca_id: selectedPeriodId,
            component_code: c.component_code,
            description: c.description,
            component_type: activeTab,
            category: c.category,
            value: c.value,
            province_code: c.province_code,
            has_municipal: c.has_municipal,
          })),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al guardar')

      toast.success(`Componentes ${activeTab} guardados correctamente`)
      fetchComponents() // Reload
    } catch (error: any) {
      console.error('Error saving components:', error)
      toast.error(error.message || 'Error al guardar componentes')
    } finally {
      setIsSaving(false)
    }
  }

  function handleExportTab() {
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    const periodCode = selectedPeriod?.code || 'cuotas'

    let exportData: Record<string, any>[] = []
    let sheetName = ''

    switch (activeTab) {
      case 'IMP':
        sheetName = 'Impositivo'
        exportData = CATEGORIES.map(cat => {
          const b20 = components.find(c => c.category === cat && c.component_code === 'B20')
          const s20 = components.find(c => c.category === cat && c.component_code === 'S20')
          return {
            'Categoría': cat,
            'B20 (Bienes)': b20?.value || '',
            'S20 (Servicios)': s20?.value || '',
          }
        })
        break
      case 'JUB':
        sheetName = 'Jubilatorio'
        exportData = CATEGORIES.map(cat => {
          const c021 = components.find(c => c.category === cat && c.component_code === '021')
          const c21j = components.find(c => c.category === cat && c.component_code === '21J')
          return {
            'Categoría': cat,
            '021 (Aportes)': c021?.value || '',
            '21J (Mínimo Jubilado)': c21j?.value || '',
          }
        })
        break
      case 'OS':
        sheetName = 'ObraSocial'
        exportData = CATEGORIES.map(cat => {
          const c024 = components.find(c => c.category === cat && c.component_code === '024')
          return {
            'Categoría': cat,
            '024 (Obra Social)': c024?.value || '',
          }
        })
        break
      case 'IBP':
        sheetName = 'IIBB'
        exportData = PROVINCES.map(prov => {
          const row: Record<string, any> = { 'Provincia': prov.name, 'Código': prov.code }
          CATEGORIES.forEach(cat => {
            const comp = components.find(c => c.component_code === prov.code && c.category === cat)
            row[`Cat ${cat}`] = comp?.value || ''
          })
          const firstComp = components.find(c => c.component_code === prov.code)
          row['Municipal'] = firstComp?.has_municipal ? 'Sí' : 'No'
          return row
        })
        break
    }

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `cuotas_${activeTab}_${periodCode}.xlsx`)
    toast.success(`Tab ${activeTab} exportado correctamente`)
  }

  async function handleExportAll() {
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    const periodCode = selectedPeriod?.code || 'cuotas'

    // Fetch all components for this period
    const { data: allComponents, error } = await supabase
      .from('reca_fee_components')
      .select('*')
      .eq('reca_id', selectedPeriodId)

    if (error) {
      toast.error('Error al obtener datos')
      return
    }

    const wb = XLSX.utils.book_new()

    // IMP sheet
    const impData = CATEGORIES.map(cat => {
      const b20 = allComponents?.find(c => c.category === cat && c.component_code === 'B20')
      const s20 = allComponents?.find(c => c.category === cat && c.component_code === 'S20')
      return { 'Categoría': cat, 'B20 (Bienes)': b20?.value || '', 'S20 (Servicios)': s20?.value || '' }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(impData), 'Impositivo')

    // JUB sheet
    const jubData = CATEGORIES.map(cat => {
      const c021 = allComponents?.find(c => c.category === cat && c.component_code === '021')
      const c21j = allComponents?.find(c => c.category === cat && c.component_code === '21J')
      return { 'Categoría': cat, '021 (Aportes)': c021?.value || '', '21J (Mínimo Jubilado)': c21j?.value || '' }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jubData), 'Jubilatorio')

    // OS sheet
    const osData = CATEGORIES.map(cat => {
      const c024 = allComponents?.find(c => c.category === cat && c.component_code === '024')
      return { 'Categoría': cat, '024 (Obra Social)': c024?.value || '' }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(osData), 'ObraSocial')

    // IBP sheet
    const ibpData = PROVINCES.map(prov => {
      const row: Record<string, any> = { 'Provincia': prov.name, 'Código': prov.code }
      CATEGORIES.forEach(cat => {
        const comp = allComponents?.find(c => c.component_code === prov.code && c.category === cat)
        row[`Cat ${cat}`] = comp?.value || ''
      })
      const firstComp = allComponents?.find(c => c.component_code === prov.code)
      row['Municipal'] = firstComp?.has_municipal ? 'Sí' : 'No'
      return row
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ibpData), 'IIBB')

    XLSX.writeFile(wb, `cuotas_completo_${periodCode}.xlsx`)
    toast.success('Archivo completo exportado')
  }

  function handleImportTab(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const errors: string[] = []
        const updates: Partial<FeeComponent>[] = []

        jsonData.forEach((row: any, index: number) => {
          const category = String(row['Categoría'] || row['Categoria'] || '').toUpperCase().trim()

          if (activeTab !== 'IBP' && !CATEGORIES.includes(category)) {
            errors.push(`Fila ${index + 2}: Categoría "${category}" inválida`)
            return
          }

          switch (activeTab) {
            case 'IMP': {
              const b20Val = parseFloat(row['B20 (Bienes)'] || '')
              const s20Val = parseFloat(row['S20 (Servicios)'] || '')
              if (!isNaN(b20Val)) updates.push({ component_code: 'B20', category, value: b20Val })
              if (!isNaN(s20Val)) updates.push({ component_code: 'S20', category, value: s20Val })
              break
            }
            case 'JUB': {
              const c021Val = parseFloat(row['021 (Aportes)'] || '')
              const c21jVal = parseFloat(row['21J (Mínimo Jubilado)'] || '')
              if (!isNaN(c021Val)) updates.push({ component_code: '021', category, value: c021Val })
              if (!isNaN(c21jVal)) updates.push({ component_code: '21J', category, value: c21jVal })
              break
            }
            case 'OS': {
              const c024Val = parseFloat(row['024 (Obra Social)'] || '')
              if (!isNaN(c024Val)) updates.push({ component_code: '024', category, value: c024Val })
              break
            }
            case 'IBP': {
              const provCode = String(row['Código'] || row['Codigo'] || '')
              const hasMunicipal = row['Municipal'] === 'Sí' || row['Municipal'] === 'Si' || row['Municipal'] === true
              CATEGORIES.forEach(cat => {
                const val = parseFloat(row[`Cat ${cat}`] || '')
                if (!isNaN(val)) {
                  updates.push({ component_code: provCode, category: cat, value: val, has_municipal: hasMunicipal })
                }
              })
              break
            }
          }
        })

        if (errors.length > 0) {
          toast.error(`Errores: ${errors.slice(0, 3).join(', ')}`)
          return
        }

        // Apply updates
        setComponents(prev => {
          const updated = [...prev]
          updates.forEach(upd => {
            const idx = updated.findIndex(c => c.component_code === upd.component_code && c.category === upd.category)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...upd }
            }
          })
          return updated
        })

        toast.success(`${updates.length} valores importados. Recuerda guardar.`)
      } catch (error) {
        console.error('Import error:', error)
        toast.error('Error al leer el archivo')
      }
    }
    reader.readAsArrayBuffer(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (periods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No hay períodos configurados. Crea uno primero.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="max-w-xs">
          <Label htmlFor="period-select">Período</Label>
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger id="period-select">
              <SelectValue placeholder="Selecciona un período" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.code} ({period.year}/{period.semester}° Sem)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Guardar {activeTab}
          </Button>

          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Tab
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportTab}
            className="hidden"
          />

          <Button variant="outline" onClick={handleExportTab}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Tab
          </Button>

          <Button variant="outline" onClick={handleExportAll}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Todo
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComponentType)}>
        <TabsList>
          <TabsTrigger value="IMP">Impositivo</TabsTrigger>
          <TabsTrigger value="JUB">Jubilatorio</TabsTrigger>
          <TabsTrigger value="OS">Obra Social</TabsTrigger>
          <TabsTrigger value="IBP">Ingresos Brutos</TabsTrigger>
        </TabsList>

        {/* Tab IMP */}
        <TabsContent value="IMP">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Cat</TableHead>
                    <TableHead>B20 (Bienes)</TableHead>
                    <TableHead>S20 (Servicios)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map((cat) => {
                    const b20 = components.find(
                      (c) => c.category === cat && c.component_code === 'B20'
                    )
                    const s20 = components.find(
                      (c) => c.category === cat && c.component_code === 'S20'
                    )
                    return (
                      <TableRow key={cat}>
                        <TableCell className="font-bold">{cat}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={b20?.value || ''}
                            onChange={(e) =>
                              updateComponent('B20', cat, 'value', parseFloat(e.target.value) || null)
                            }
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={s20?.value || ''}
                            onChange={(e) =>
                              updateComponent('S20', cat, 'value', parseFloat(e.target.value) || null)
                            }
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab JUB */}
        <TabsContent value="JUB">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Cat</TableHead>
                    <TableHead>021 (Aportes)</TableHead>
                    <TableHead>21J (Mínimo Jubilado)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map((cat) => {
                    const c021 = components.find(
                      (c) => c.category === cat && c.component_code === '021'
                    )
                    const c21j = components.find(
                      (c) => c.category === cat && c.component_code === '21J'
                    )
                    return (
                      <TableRow key={cat}>
                        <TableCell className="font-bold">{cat}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={c021?.value || ''}
                            onChange={(e) =>
                              updateComponent('021', cat, 'value', parseFloat(e.target.value) || null)
                            }
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={c21j?.value || ''}
                            onChange={(e) =>
                              updateComponent('21J', cat, 'value', parseFloat(e.target.value) || null)
                            }
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab OS */}
        <TabsContent value="OS">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Cat</TableHead>
                    <TableHead>024 (Obra Social Base)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map((cat) => {
                    const c024 = components.find(
                      (c) => c.category === cat && c.component_code === '024'
                    )
                    return (
                      <TableRow key={cat}>
                        <TableCell className="font-bold">{cat}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={c024?.value || ''}
                            onChange={(e) =>
                              updateComponent('024', cat, 'value', parseFloat(e.target.value) || null)
                            }
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab IBP */}
        <TabsContent value="IBP">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Provincia</TableHead>
                    {CATEGORIES.map((cat) => (
                      <TableHead key={cat} className="text-center w-24">
                        {cat}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Municipal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PROVINCES.map((prov) => (
                    <TableRow key={prov.code}>
                      <TableCell className="font-medium">{prov.name}</TableCell>
                      {CATEGORIES.map((cat) => {
                        const comp = components.find(
                          (c) =>
                            c.component_code === prov.code && c.category === cat
                        )
                        return (
                          <TableCell key={cat}>
                            <Input
                              type="number"
                              step="0.01"
                              value={comp?.value || ''}
                              onChange={(e) =>
                                updateComponent(
                                  prov.code,
                                  cat,
                                  'value',
                                  parseFloat(e.target.value) || null
                                )
                              }
                              placeholder="0.00"
                              className="w-20"
                            />
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={
                            components.find(
                              (c) => c.component_code === prov.code && c.category === 'A'
                            )?.has_municipal || false
                          }
                          onCheckedChange={(checked: boolean) => {
                            // Aplicar a todas las categorías de la provincia
                            setComponents((prev) =>
                              prev.map((c) =>
                                c.component_code === prov.code
                                  ? { ...c, has_municipal: !!checked }
                                  : c
                              )
                            )
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
