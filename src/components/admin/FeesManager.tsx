import { useState, useEffect } from 'react'
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
import { Save } from 'lucide-react'
import { toast } from 'sonner'

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
      const { error } = await supabase.from('reca_fee_components').upsert(
        components.map((c) => ({
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
        {
          onConflict: 'reca_id,component_code,category',
        }
      )

      if (error) throw error
      toast.success(`Componentes ${activeTab} guardados correctamente`)
      fetchComponents() // Reload
    } catch (error: any) {
      console.error('Error saving components:', error)
      toast.error(error.message || 'Error al guardar componentes')
    } finally {
      setIsSaving(false)
    }
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

        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          Guardar {activeTab}
        </Button>
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
