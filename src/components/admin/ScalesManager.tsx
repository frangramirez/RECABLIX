import { useState, useEffect, useRef } from 'react'
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

interface RecaScale {
  id?: string
  reca_id: string
  category: string
  max_annual_income: number | null
  max_local_m2: number | null
  max_annual_mw: number | null
  max_annual_rent: number | null
  max_unit_sale: number | null
  // Fee components (de reca_fee_components)
  fee_s20: number | null  // Imp. Servicios
  fee_b20: number | null  // Imp. Bienes
  fee_021: number | null  // Aporte SIPA
  fee_024: number | null  // Aporte OS
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // Query 1: Escalas
      const { data: scalesData, error: scalesError } = await supabase
        .from('reca_scales')
        .select('*')
        .eq('reca_id', selectedPeriodId)
        .order('category')

      if (scalesError) throw scalesError

      // Query 2: Fee components (IMP, JUB, OS)
      const { data: feeData, error: feeError } = await supabase
        .from('reca_fee_components')
        .select('component_code, category, value')
        .eq('reca_id', selectedPeriodId)
        .in('component_type', ['IMP', 'JUB', 'OS'])

      if (feeError) throw feeError

      // Si no existen escalas, crear plantilla vacía
      if (!scalesData || scalesData.length === 0) {
        const emptyScales: RecaScale[] = CATEGORIES.map((cat) => ({
          reca_id: selectedPeriodId,
          category: cat,
          max_annual_income: null,
          max_local_m2: 200,
          max_annual_mw: 20000,
          max_annual_rent: null,
          max_unit_sale: null,
          fee_s20: null,
          fee_b20: null,
          fee_021: null,
          fee_024: null,
        }))
        setScales(emptyScales)
        setOriginalScales([])
      } else {
        // Mergear escalas con fee components
        const mergedScales: RecaScale[] = scalesData.map((scale: any) => {
          const s20 = feeData?.find(
            (f: any) => f.category === scale.category && f.component_code === 'S20'
          )
          const b20 = feeData?.find(
            (f: any) => f.category === scale.category && f.component_code === 'B20'
          )
          const c021 = feeData?.find(
            (f: any) => f.category === scale.category && f.component_code === '021'
          )
          const c024 = feeData?.find(
            (f: any) => f.category === scale.category && f.component_code === '024'
          )

          return {
            ...scale,
            fee_s20: s20?.value ?? null,
            fee_b20: b20?.value ?? null,
            fee_021: c021?.value ?? null,
            fee_024: c024?.value ?? null,
          }
        })

        setScales(mergedScales)
        setOriginalScales(JSON.parse(JSON.stringify(mergedScales)))
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
      current?.max_unit_sale !== original.max_unit_sale ||
      current?.fee_s20 !== original.fee_s20 ||
      current?.fee_b20 !== original.fee_b20 ||
      current?.fee_021 !== original.fee_021 ||
      current?.fee_024 !== original.fee_024
    )
  }

  async function handleSave() {
    if (!selectedPeriodId) return

    setIsSaving(true)
    try {
      // Usar endpoint API que bypassa RLS con supabaseAdmin
      const response = await fetch('/api/admin/scales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scales: scales.map((s) => ({
            id: s.id,
            reca_id: selectedPeriodId,
            category: s.category,
            max_annual_income: s.max_annual_income,
            max_local_m2: s.max_local_m2,
            max_annual_mw: s.max_annual_mw,
            max_annual_rent: s.max_annual_rent,
            max_unit_sale: s.max_unit_sale,
            fee_s20: s.fee_s20,
            fee_b20: s.fee_b20,
            fee_021: s.fee_021,
            fee_024: s.fee_024,
          })),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al guardar')

      toast.success('Escalas y componentes guardados correctamente')
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
      const { data: scalesData, error: scalesError } = await supabase
        .from('reca_scales')
        .select('*')
        .eq('reca_id', sourcePeriodId)

      if (scalesError) throw scalesError
      if (!scalesData || scalesData.length === 0) {
        toast.error('El período seleccionado no tiene escalas configuradas')
        return
      }

      // Fetch fee components del período origen
      const { data: feeData, error: feeError } = await supabase
        .from('reca_fee_components')
        .select('component_code, category, value')
        .eq('reca_id', sourcePeriodId)
        .in('component_type', ['IMP', 'JUB', 'OS'])

      if (feeError) throw feeError

      // Mapear a período actual (sin IDs) y mergear con fee components
      const copiedScales: RecaScale[] = scalesData.map((s: any) => {
        const s20 = feeData?.find(
          (f: any) => f.category === s.category && f.component_code === 'S20'
        )
        const b20 = feeData?.find(
          (f: any) => f.category === s.category && f.component_code === 'B20'
        )
        const c021 = feeData?.find(
          (f: any) => f.category === s.category && f.component_code === '021'
        )
        const c024 = feeData?.find(
          (f: any) => f.category === s.category && f.component_code === '024'
        )

        return {
          reca_id: selectedPeriodId,
          category: s.category,
          max_annual_income: s.max_annual_income,
          max_local_m2: s.max_local_m2,
          max_annual_mw: s.max_annual_mw,
          max_annual_rent: s.max_annual_rent,
          max_unit_sale: s.max_unit_sale,
          fee_s20: s20?.value ?? null,
          fee_b20: b20?.value ?? null,
          fee_021: c021?.value ?? null,
          fee_024: c024?.value ?? null,
        }
      })

      setScales(copiedScales)
      toast.success('Escalas y componentes copiados. Recuerda guardar los cambios.')
    } catch (error: any) {
      console.error('Error copying scales:', error)
      toast.error(error.message || 'Error al copiar escalas')
    }
  }

  function handleExportXLSX() {
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
    const periodCode = selectedPeriod?.code || 'escalas'

    const exportData = scales.map(s => ({
      'Categoría': s.category,
      'Ingreso Anual Máx': s.max_annual_income || '',
      'Superficie Máx (m²)': s.max_local_m2 || '',
      'Alquileres Anuales Máx': s.max_annual_rent || '',
      'Energía Máx (mW)': s.max_annual_mw || '',
      'Venta Unitaria Máx': s.max_unit_sale || '',
      'Imp. Serv.': s.fee_s20 || '',
      'Imp. Bienes': s.fee_b20 || '',
      'SIPA': s.fee_021 || '',
      'OS': s.fee_024 || '',
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Escalas_${periodCode}`)

    // Ajustar anchos de columna (ahora 10 columnas)
    ws['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }
    ]

    XLSX.writeFile(wb, `escalas_${periodCode}.xlsx`)
    toast.success('Archivo exportado correctamente')
  }

  function handleImportXLSX(event: React.ChangeEvent<HTMLInputElement>) {
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

        // Validar y mapear datos
        const importedScales: RecaScale[] = []
        const errors: string[] = []

        jsonData.forEach((row: any, index: number) => {
          const category = String(row['Categoría'] || row['Categoria'] || '').toUpperCase().trim()

          if (!CATEGORIES.includes(category)) {
            errors.push(`Fila ${index + 2}: Categoría "${category}" inválida (debe ser A-K)`)
            return
          }

          const maxIncome = parseFloat(row['Ingreso Anual Máx'] || row['Ingreso Anual Max'] || '')
          const maxM2 = parseFloat(row['Superficie Máx (m²)'] || row['Superficie Max (m2)'] || '')
          const maxRent = parseFloat(row['Alquileres Anuales Máx'] || row['Alquileres Anuales Max'] || '')
          const maxMW = parseFloat(row['Energía Máx (mW)'] || row['Energia Max (mW)'] || '')
          const maxUnitSale = parseFloat(row['Venta Unitaria Máx'] || row['Venta Unitaria Max'] || '')
          const feeS20 = parseFloat(row['Imp. Serv.'] || row['Imp Serv'] || '')
          const feeB20 = parseFloat(row['Imp. Bienes'] || row['Imp Bienes'] || '')
          const fee021 = parseFloat(row['SIPA'] || '')
          const fee024 = parseFloat(row['OS'] || '')

          importedScales.push({
            reca_id: selectedPeriodId,
            category,
            max_annual_income: isNaN(maxIncome) ? null : maxIncome,
            max_local_m2: isNaN(maxM2) ? null : maxM2,
            max_annual_rent: isNaN(maxRent) ? null : maxRent,
            max_annual_mw: isNaN(maxMW) ? null : maxMW,
            max_unit_sale: isNaN(maxUnitSale) ? null : maxUnitSale,
            fee_s20: isNaN(feeS20) ? null : feeS20,
            fee_b20: isNaN(feeB20) ? null : feeB20,
            fee_021: isNaN(fee021) ? null : fee021,
            fee_024: isNaN(fee024) ? null : fee024,
          })
        })

        if (errors.length > 0) {
          toast.error(`Errores en importación:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...y ${errors.length - 3} más` : ''}`)
          return
        }

        if (importedScales.length === 0) {
          toast.error('No se encontraron datos válidos en el archivo')
          return
        }

        // Actualizar escalas manteniendo las que no están en el import
        setScales(prev => {
          const updated = [...prev]
          importedScales.forEach(imported => {
            const idx = updated.findIndex(s => s.category === imported.category)
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...imported }
            }
          })
          return updated
        })

        toast.success(`${importedScales.length} escalas importadas. Recuerda guardar los cambios.`)
      } catch (error: any) {
        console.error('Error importing XLSX:', error)
        toast.error('Error al leer el archivo Excel')
      }
    }
    reader.readAsArrayBuffer(file)

    // Reset input para permitir reimportar mismo archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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

          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportXLSX}
            className="hidden"
          />

          <Button variant="outline" onClick={handleExportXLSX} disabled={scales.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
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
                <TableHead className="min-w-[110px] bg-blue-50">Imp. Serv.</TableHead>
                <TableHead className="min-w-[110px] bg-blue-50">Imp. Bienes</TableHead>
                <TableHead className="min-w-[100px] bg-green-50">SIPA</TableHead>
                <TableHead className="min-w-[100px] bg-amber-50">OS</TableHead>
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
                    <TableCell className="bg-blue-50/20">
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.fee_s20 || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'fee_s20',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="bg-blue-50/20">
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.fee_b20 || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'fee_b20',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="bg-green-50/20">
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.fee_021 || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'fee_021',
                            e.target.value
                          )
                        }
                        className="w-full"
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="bg-amber-50/20">
                      <Input
                        type="number"
                        step="0.01"
                        value={scale.fee_024 || ''}
                        onChange={(e) =>
                          updateScale(
                            scale.category,
                            'fee_024',
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
