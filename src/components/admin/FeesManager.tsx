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
import { cn } from '@/lib/utils'
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
  has_integrated_iibb: boolean
}

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

// Formatear número con separador de miles para display (ej: 1234567.89 → "1.234.567,89")
function formatDisplayNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Formatear para edición: sin separador de miles, coma decimal (ej: 1234567.89 → "1234567,89")
function formatEditNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(value).replace('.', ',')
}

// Parsear string a número (acepta formato argentino con coma)
function parseInputNumber(str: string): number | null {
  if (!str.trim()) return null
  const normalized = str.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

// Validar input: solo dígitos, una coma, max 2 decimales
function sanitizeInput(value: string): string {
  let sanitized = value.replace(/[^\d,]/g, '')
  const parts = sanitized.split(',')
  if (parts.length > 2) {
    sanitized = parts[0] + ',' + parts.slice(1).join('')
  }
  if (parts.length === 2 && parts[1].length > 2) {
    sanitized = parts[0] + ',' + parts[1].slice(0, 2)
  }
  return sanitized
}

// Componente Input para moneda con formateo argentino
interface CurrencyInputProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  disabled?: boolean
  className?: string
}

function CurrencyInput({ value, onChange, disabled, className }: CurrencyInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const displayValue = isEditing ? editValue : formatDisplayNumber(value)

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => {
        const sanitized = sanitizeInput(e.target.value)
        setEditValue(sanitized)
      }}
      onFocus={() => {
        setIsEditing(true)
        setEditValue(formatEditNumber(value))
      }}
      onBlur={() => {
        setIsEditing(false)
        const parsed = parseInputNumber(editValue)
        onChange(parsed)
      }}
      placeholder="0"
      disabled={disabled}
      className={className}
    />
  )
}

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

type ComponentType = 'IBP' | 'IBP_MUN'

export function FeesManager({ periods }: Props) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<ComponentType>('IBP')
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
      // Fetch TODOS los componentes IBP (provincial + municipal)
      // Los filtraremos en la UI según el tab activo
      const { data, error } = await supabase
        .from('reca_fee_components')
        .select('*')
        .eq('reca_id', selectedPeriodId)
        .eq('component_type', 'IBP')

      if (error) throw error

      // Siempre crear plantilla completa y mergear con datos existentes
      const emptyComponents = createEmptyComponents()
      if (!data || data.length === 0) {
        setComponents(emptyComponents)
      } else {
        // Merge: usar datos existentes donde existan, plantilla vacía donde no
        const merged = emptyComponents.map((empty) => {
          const existing = data.find(
            (d: FeeComponent) =>
              d.component_code === empty.component_code && d.category === empty.category
          )
          return existing || empty
        })
        setComponents(merged)
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
      component_type: 'IBP' as const,
      description: null,
      value: null,
      province_code: null,
      has_municipal: false,
      has_integrated_iibb: false,
    }

    // Crear AMBOS tipos de componentes (provincial y municipal) para todas las provincias
    const provincial = PROVINCES.flatMap((prov) =>
      CATEGORIES.map((cat) => ({
        ...baseComponent,
        component_code: prov.code,
        category: cat,
        description: prov.name,
        province_code: prov.code,
      }))
    )

    const municipal = PROVINCES.flatMap((prov) =>
      CATEGORIES.map((cat) => ({
        ...baseComponent,
        component_code: `${prov.code}M`,
        category: cat,
        description: `${prov.name} Municipal`,
        province_code: prov.code,
      }))
    )

    return [...provincial, ...municipal]
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
      // Guardar componentes que:
      // 1. Tienen valor ingresado, O
      // 2. Tienen checkboxes activos (para preservar el estado aunque no haya valor)
      // La BD tiene NOT NULL en value, usamos 0 como valor por defecto
      const componentsToSave = components
        .filter((c) => {
          const hasValue = c.value !== null && !isNaN(c.value)
          const hasCheckboxes = c.has_municipal || c.has_integrated_iibb
          return hasValue || hasCheckboxes
        })
        .map((c) => ({
          reca_id: selectedPeriodId,
          component_code: c.component_code,
          description: c.description,
          component_type: 'IBP',
          category: c.category,
          // Usar 0 si no hay valor pero hay checkboxes activos
          value: c.value !== null && !isNaN(c.value) ? c.value : 0,
          province_code: c.province_code,
          has_municipal: c.has_municipal,
          has_integrated_iibb: c.has_integrated_iibb,
        }))

      if (componentsToSave.length === 0) {
        toast.info('No hay componentes para guardar')
        setIsSaving(false)
        return
      }

      const response = await fetch('/api/admin/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: componentsToSave,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al guardar')

      // Contar provincias únicas guardadas
      const uniqueProvinces = new Set(componentsToSave.map(c => c.province_code)).size
      toast.success(`Guardado: ${uniqueProvinces} provincias configuradas`)
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
    const periodCode = selectedPeriod?.code || 'iibb'

    let exportData: Record<string, any>[] = []
    let sheetName = ''
    let filename = ''

    if (activeTab === 'IBP') {
      sheetName = 'IIBB Provincial'
      filename = `iibb_provincial_${periodCode}.xlsx`
      exportData = PROVINCES.map(prov => {
        const row: Record<string, any> = { 'Provincia': prov.name, 'Código': prov.code }
        CATEGORIES.forEach(cat => {
          const comp = components.find(c => c.component_code === prov.code && c.category === cat)
          row[`Cat ${cat}`] = comp?.value || ''
        })
        const firstComp = components.find(c => c.component_code === prov.code && c.category === 'A')
        row['Municipal'] = firstComp?.has_municipal ? 'Sí' : 'No'
        row['IIBB Integrado'] = firstComp?.has_integrated_iibb ? 'Sí' : 'No'
        return row
      })
    } else {
      // IBP_MUN
      sheetName = 'IIBB Municipal'
      filename = `iibb_municipal_${periodCode}.xlsx`
      // Solo provincias con has_municipal=true
      const provincesWithMunicipal = PROVINCES.filter(prov => {
        const provincialComp = components.find(c => c.component_code === prov.code && c.category === 'A')
        return provincialComp?.has_municipal ?? false
      })
      exportData = provincesWithMunicipal.map(prov => {
        const row: Record<string, any> = { 'Provincia': prov.name, 'Código': `${prov.code}M` }
        CATEGORIES.forEach(cat => {
          const comp = components.find(c => c.component_code === `${prov.code}M` && c.category === cat)
          row[`Cat ${cat}`] = comp?.value || ''
        })
        return row
      })
    }

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    toast.success(`Tab ${sheetName} exportado correctamente`)
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
          const provCode = String(row['Código'] || row['Codigo'] || '').trim()

          if (!provCode) {
            errors.push(`Fila ${index + 2}: Código de provincia faltante`)
            return
          }

          if (activeTab === 'IBP') {
            // Provincial: códigos 901-924
            const hasMunicipal = row['Municipal'] === 'Sí' || row['Municipal'] === 'Si' || row['Municipal'] === true
            const hasIntegrated = row['IIBB Integrado'] === 'Sí' || row['IIBB Integrado'] === 'Si' || row['IIBB Integrado'] === true
            CATEGORIES.forEach(cat => {
              const val = parseFloat(row[`Cat ${cat}`] || '')
              if (!isNaN(val)) {
                updates.push({
                  component_code: provCode,
                  category: cat,
                  value: val,
                  has_municipal: hasMunicipal,
                  has_integrated_iibb: hasIntegrated
                })
              }
            })
          } else {
            // IBP_MUN: códigos municipales (ej: 902M)
            CATEGORIES.forEach(cat => {
              const val = parseFloat(row[`Cat ${cat}`] || '')
              if (!isNaN(val)) {
                updates.push({
                  component_code: provCode,
                  category: cat,
                  value: val
                })
              }
            })
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
            Guardar
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
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComponentType)}>
        <TabsList>
          <TabsTrigger value="IBP">Ingresos Brutos Provincial</TabsTrigger>
          <TabsTrigger value="IBP_MUN">Ingresos Brutos Municipal</TabsTrigger>
        </TabsList>

        {/* Tab IBP Provincial */}
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
                    <TableHead className="w-40">Provincia</TableHead>
                    <TableHead className="text-center w-10" title="IIBB Integrado">Int.</TableHead>
                    <TableHead className="text-center w-10" title="Municipal">Mun.</TableHead>
                    {CATEGORIES.map((cat) => (
                      <TableHead key={cat} className="text-center px-1">
                        {cat}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PROVINCES.map((prov) => {
                    const firstComp = components.find(
                      (c) => c.component_code === prov.code && c.category === 'A'
                    )
                    const hasIntegrated = firstComp?.has_integrated_iibb ?? false

                    return (
                      <TableRow
                        key={prov.code}
                        className={cn(!hasIntegrated && 'bg-muted/30 opacity-60')}
                      >
                        <TableCell className="font-medium py-1">{prov.name}</TableCell>
                        <TableCell className="text-center py-1">
                          <Checkbox
                            checked={hasIntegrated}
                            onCheckedChange={(checked: boolean) => {
                              setComponents((prev) =>
                                prev.map((c) =>
                                  c.component_code === prov.code
                                    ? { ...c, has_integrated_iibb: !!checked }
                                    : c
                                )
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center py-1">
                          <Checkbox
                            checked={firstComp?.has_municipal || false}
                            onCheckedChange={(checked: boolean) => {
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
                        {CATEGORIES.map((cat) => {
                          const comp = components.find(
                            (c) =>
                              c.component_code === prov.code && c.category === cat
                          )
                          return (
                            <TableCell key={cat} className="px-0.5 py-1">
                              <CurrencyInput
                                value={comp?.value}
                                onChange={(val) => updateComponent(prov.code, cat, 'value', val)}
                                disabled={!hasIntegrated}
                                className={cn(
                                  'w-full text-right tabular-nums',
                                  !hasIntegrated && 'cursor-not-allowed'
                                )}
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab IBP Municipal */}
        <TabsContent value="IBP_MUN">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Provincia</TableHead>
                    {CATEGORIES.map((cat) => (
                      <TableHead key={cat} className="text-center px-1">
                        {cat}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PROVINCES.map((prov) => {
                    const provincialComp = components.find(
                      (c) => c.component_code === prov.code && c.category === 'A'
                    )
                    const hasMunicipal = provincialComp?.has_municipal ?? false

                    return (
                      <TableRow
                        key={prov.code}
                        className={cn(!hasMunicipal && 'bg-muted/30 opacity-60')}
                      >
                        <TableCell className="font-medium py-1">{prov.name}</TableCell>
                        {CATEGORIES.map((cat) => {
                          const comp = components.find(
                            (c) =>
                              c.component_code === `${prov.code}M` && c.category === cat
                          )
                          return (
                            <TableCell key={cat} className="px-0.5 py-1">
                              <CurrencyInput
                                value={comp?.value}
                                onChange={(val) => updateComponent(`${prov.code}M`, cat, 'value', val)}
                                disabled={!hasMunicipal}
                                className={cn(
                                  'w-full text-right tabular-nums',
                                  !hasMunicipal && 'cursor-not-allowed'
                                )}
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
