import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface ImportResult {
  table: string
  success: number
  errors: string[]
}

export function ImportExportManager() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])

  async function handleExport() {
    setIsExporting(true)
    try {
      // Fetch data from all reca_* tables
      const [periodsRes, scalesRes, feesRes] = await Promise.all([
        supabase.from('reca_periods').select('*').order('code'),
        supabase.from('reca_scales').select('*').order('reca_id, category'),
        supabase.from('reca_fee_components').select('*').order('reca_id, component_type, category'),
      ])

      if (periodsRes.error) throw periodsRes.error
      if (scalesRes.error) throw scalesRes.error
      if (feesRes.error) throw feesRes.error

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Add sheets
      const periodsSheet = XLSX.utils.json_to_sheet(periodsRes.data || [])
      XLSX.utils.book_append_sheet(wb, periodsSheet, 'RECA_PERIODS')

      const scalesSheet = XLSX.utils.json_to_sheet(scalesRes.data || [])
      XLSX.utils.book_append_sheet(wb, scalesSheet, 'RECA_SCALES')

      const feesSheet = XLSX.utils.json_to_sheet(feesRes.data || [])
      XLSX.utils.book_append_sheet(wb, feesSheet, 'RECA_FEE_COMPONENTS')

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `recablix-export-${timestamp}.xlsx`

      // Download
      XLSX.writeFile(wb, filename)
      toast.success(`Exportación completada: ${filename}`)
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(error.message || 'Error al exportar datos')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResults([])

    try {
      // Read file
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)

      const results: ImportResult[] = []

      // Import RECA_PERIODS
      if (wb.SheetNames.includes('RECA_PERIODS')) {
        const sheet = wb.Sheets['RECA_PERIODS']
        const rows = XLSX.utils.sheet_to_json(sheet)
        const result = await importPeriods(rows)
        results.push(result)
      }

      // Import RECA_SCALES
      if (wb.SheetNames.includes('RECA_SCALES')) {
        const sheet = wb.Sheets['RECA_SCALES']
        const rows = XLSX.utils.sheet_to_json(sheet)
        const result = await importScales(rows)
        results.push(result)
      }

      // Import RECA_FEE_COMPONENTS
      if (wb.SheetNames.includes('RECA_FEE_COMPONENTS')) {
        const sheet = wb.Sheets['RECA_FEE_COMPONENTS']
        const rows = XLSX.utils.sheet_to_json(sheet)
        const result = await importFeeComponents(rows)
        results.push(result)
      }

      setImportResults(results)

      const totalSuccess = results.reduce((sum, r) => sum + r.success, 0)
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

      if (totalErrors === 0) {
        toast.success(`Importación completada: ${totalSuccess} registros`)
      } else {
        toast.error(`Importación con errores: ${totalSuccess} OK, ${totalErrors} fallos`)
      }
    } catch (error: any) {
      console.error('Import error:', error)
      toast.error(error.message || 'Error al importar archivo')
    } finally {
      setIsImporting(false)
      // Reset input
      e.target.value = ''
    }
  }

  async function importPeriods(rows: any[]): Promise<ImportResult> {
    const result: ImportResult = { table: 'RECA_PERIODS', success: 0, errors: [] }

    for (const row of rows) {
      try {
        const { error } = await supabase.from('reca_periods').upsert(
          {
            id: row.id || undefined,
            code: row.code,
            year: row.year,
            semester: row.semester,
            sales_period_start: row.sales_period_start || null,
            sales_period_end: row.sales_period_end || null,
            fee_period_start: row.fee_period_start || null,
            fee_period_end: row.fee_period_end || null,
            is_active: row.is_active || false,
          },
          { onConflict: 'code' }
        )

        if (error) throw error
        result.success++
      } catch (error: any) {
        result.errors.push(`${row.code}: ${error.message}`)
      }
    }

    return result
  }

  async function importScales(rows: any[]): Promise<ImportResult> {
    const result: ImportResult = { table: 'RECA_SCALES', success: 0, errors: [] }

    for (const row of rows) {
      try {
        const { error } = await supabase.from('reca_scales').upsert(
          {
            id: row.id || undefined,
            reca_id: row.reca_id,
            category: row.category,
            max_annual_income: row.max_annual_income || null,
            max_local_m2: row.max_local_m2 || null,
            max_annual_mw: row.max_annual_mw || null,
            max_annual_rent: row.max_annual_rent || null,
            max_unit_sale: row.max_unit_sale || null,
          },
          { onConflict: 'reca_id,category' }
        )

        if (error) throw error
        result.success++
      } catch (error: any) {
        result.errors.push(`${row.category}: ${error.message}`)
      }
    }

    return result
  }

  async function importFeeComponents(rows: any[]): Promise<ImportResult> {
    const result: ImportResult = { table: 'RECA_FEE_COMPONENTS', success: 0, errors: [] }

    for (const row of rows) {
      try {
        const { error } = await supabase.from('reca_fee_components').upsert(
          {
            id: row.id || undefined,
            reca_id: row.reca_id,
            component_code: row.component_code,
            description: row.description || null,
            component_type: row.component_type,
            category: row.category,
            value: row.value || null,
            province_code: row.province_code || null,
            has_municipal: row.has_municipal || false,
          },
          { onConflict: 'reca_id,component_code,category' }
        )

        if (error) throw error
        result.success++
      } catch (error: any) {
        result.errors.push(`${row.component_code}-${row.category}: ${error.message}`)
      }
    }

    return result
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Datos
          </CardTitle>
          <CardDescription>
            Descarga todas las configuraciones de períodos, escalas y componentes en formato Excel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              El archivo Excel contendrá 3 hojas:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>RECA_PERIODS</li>
              <li>RECA_SCALES</li>
              <li>RECA_FEE_COMPONENTS</li>
            </ul>
          </div>

          <Button onClick={handleExport} disabled={isExporting} className="w-full">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar a Excel'}
          </Button>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              No se exportan tablas compartidas con FINBLIX (studios, clients, studio_members).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Datos
          </CardTitle>
          <CardDescription>
            Carga un archivo Excel con la estructura generada por la exportación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              El archivo debe contener las hojas con sus columnas originales. Se hará upsert (insertar o actualizar).
            </p>
          </div>

          <div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={isImporting}
            />
          </div>

          {isImporting && (
            <p className="text-sm text-muted-foreground">Importando...</p>
          )}

          {importResults.length > 0 && (
            <div className="space-y-2">
              {importResults.map((result, idx) => (
                <Alert key={idx} variant={result.errors.length === 0 ? 'default' : 'destructive'}>
                  {result.errors.length === 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <div className="font-medium">{result.table}</div>
                    <div className="text-xs mt-1">
                      {result.success} registros importados
                      {result.errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.errors.slice(0, 3).map((err, i) => (
                            <div key={i} className="text-xs">• {err}</div>
                          ))}
                          {result.errors.length > 3 && (
                            <div className="text-xs">... y {result.errors.length - 3} más</div>
                          )}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
