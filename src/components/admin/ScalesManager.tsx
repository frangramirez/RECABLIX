import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Period {
  id: string
  code: string
  year: number
  semester: number
}

interface RecaScale {
  id?: string
  reca_id: string
  category: string
  max_annual_income: number | null
  max_local_m2: number | null
  max_annual_mw: number | null
  max_annual_rent: number | null
  max_unit_sale: number | null
}

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

interface Props {
  periods: Period[]
}

export function ScalesManager({ periods }: Props) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [scales, setScales] = useState<RecaScale[]>([])
  const [originalScales, setOriginalScales] = useState<RecaScale[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(periods[0].id)
    }
  }, [periods])

  useEffect(() => {
    if (selectedPeriodId) {
      fetchScales()
    }
  }, [selectedPeriodId])

  async function fetchScales() {
    if (!selectedPeriodId) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('reca_scales')
        .select('*')
        .eq('reca_id', selectedPeriodId)
        .order('category')

      if (error) throw error

      // Si no existen escalas, crear plantilla vacía
      if (!data || data.length === 0) {
        const emptyScales = CATEGORIES.map((cat) => ({
          reca_id: selectedPeriodId,
          category: cat,
          max_annual_income: null,
          max_local_m2: 200,
          max_annual_mw: 20000,
          max_annual_rent: null,
          max_unit_sale: null,
        }))
        setScales(emptyScales)
        setOriginalScales([])
      } else {
        setScales(data)
        setOriginalScales(JSON.parse(JSON.stringify(data)))
      }
    } catch (error: any) {
      console.error('Error fetching scales:', error)
      toast.error(error.message || 'Error al cargar escalas')
    } finally {
      setIsLoading(false)
    }
  }

  function updateScale(category: string, field: keyof RecaScale, value: string) {
    const numValue = value === '' ? null : parseFloat(value)
    setScales((prev) =>
      prev.map((s) =>
        s.category === category ? { ...s, [field]: numValue } : s
      )
    )
  }

  function isScaleModified(category: string): boolean {
    const current = scales.find((s) => s.category === category)
    const original = originalScales.find((s) => s.category === category)

    if (!original) return true // Nueva escala

    return (
      current?.max_annual_income !== original.max_annual_income ||
      current?.max_local_m2 !== original.max_local_m2 ||
      current?.max_annual_mw !== original.max_annual_mw ||
      current?.max_annual_rent !== original.max_annual_rent ||
      current?.max_unit_sale !== original.max_unit_sale
    )
  }

  async function handleSave() {
    if (!selectedPeriodId) return

    setIsSaving(true)
    try {
      // Upsert de todas las escalas
      const { error } = await supabase.from('reca_scales').upsert(
        scales.map((s) => ({
          id: s.id,
          reca_id: selectedPeriodId,
          category: s.category,
          max_annual_income: s.max_annual_income,
          max_local_m2: s.max_local_m2,
          max_annual_mw: s.max_annual_mw,
          max_annual_rent: s.max_annual_rent,
          max_unit_sale: s.max_unit_sale,
        })),
        {
          onConflict: 'reca_id,category',
        }
      )

      if (error) throw error
      toast.success('Escalas guardadas correctamente')
      fetchScales() // Reload para actualizar IDs y originalScales
    } catch (error: any) {
      console.error('Error saving scales:', error)
      toast.error(error.message || 'Error al guardar escalas')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyFrom(sourcePeriodId: string) {
    try {
      // Fetch escalas del período origen
      const { data, error } = await supabase
        .from('reca_scales')
        .select('*')
        .eq('reca_id', sourcePeriodId)

      if (error) throw error
      if (!data || data.length === 0) {
        toast.error('El período seleccionado no tiene escalas configuradas')
        return
      }

      // Mapear a período actual (sin IDs)
      const copiedScales = data.map((s) => ({
        reca_id: selectedPeriodId,
        category: s.category,
        max_annual_income: s.max_annual_income,
        max_local_m2: s.max_local_m2,
        max_annual_mw: s.max_annual_mw,
        max_annual_rent: s.max_annual_rent,
        max_unit_sale: s.max_unit_sale,
      }))

      setScales(copiedScales)
      toast.success('Escalas copiadas. Recuerda guardar los cambios.')
    } catch (error: any) {
      console.error('Error copying scales:', error)
      toast.error(error.message || 'Error al copiar escalas')
    }
  }

  const hasUnsavedChanges = scales.some((s) => isScaleModified(s.category))

  if (periods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No hay períodos configurados. Crea uno primero en la sección de
          Períodos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-xs">
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

        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="copy-from">Copiar desde</Label>
            <Select
              onValueChange={(val) => {
                if (val !== selectedPeriodId) handleCopyFrom(val)
              }}
            >
              <SelectTrigger id="copy-from" className="w-[200px]">
                <SelectValue placeholder="Selecciona período" />
              </SelectTrigger>
              <SelectContent>
                {periods
                  .filter((p) => p.id !== selectedPeriodId)
                  .map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.code}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cargando escalas...</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Cat</TableHead>
                <TableHead>Ingreso Anual</TableHead>
                <TableHead>Sup. Local (m²)</TableHead>
                <TableHead>Monto Alquileres</TableHead>
                <TableHead>Energía (mW)</TableHead>
                <TableHead>Venta Unitaria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scales.map((scale) => {
                const isModified = isScaleModified(scale.category)
                return (
                  <TableRow
                    key={scale.category}
                    className={cn(isModified && 'bg-yellow-50')}
                  >
                    <TableCell className="font-bold">{scale.category}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.max_annual_income || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'max_annual_income',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={scale.max_local_m2 || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'max_local_m2',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="200"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.max_annual_rent || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'max_annual_rent',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={scale.max_annual_mw || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'max_annual_mw',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="20000"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.max_unit_sale || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'max_unit_sale',
                            e.target.value
                          )
                        }
                        className="w-full"
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

      {hasUnsavedChanges && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            Tienes cambios sin guardar. Las filas modificadas están resaltadas en
            amarillo.
          </p>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Ahora
          </Button>
        </div>
      )}
    </div>
  )
}
