/**
 * ClientImporterWithStudio - Importador de clientes para admin multi-studio
 *
 * Versión del ClientImporter que usa endpoint API en lugar de Supabase browser client.
 * Para uso en /admin/my-studios/[studioId]/clients/import
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface PreviewRow {
  row: number
  data: Record<string, unknown>
  valid: boolean
  errors: string[]
}

interface Props {
  studioId: string
  schemaName: string
}

const EXPECTED_COLUMNS = [
  'Nombre', 'CUIT', 'Actividad', 'Provincia', 'RD', 'Jubilado',
  'Adherentes', 'M2', 'Alquiler', 'MW', 'CatAnt', 'CuotaAnt'
]

const ACTIVITY_MAP: Record<string, string> = {
  'BIENES': 'BIENES',
  'SERVICIOS': 'SERVICIOS',
  'LOCACION': 'LOCACION',
  'SOLO_LOC': 'SOLO_LOC_2_INM',
  'SOLO LOC': 'SOLO_LOC_2_INM',
  'SOLO_LOC_2_INM': 'SOLO_LOC_2_INM',
}

export function ClientImporterWithStudio({ studioId }: Props) {
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ success: number; errors: { row: number; error: string }[] } | null>(null)

  const downloadTemplate = () => {
    const template = [
      {
        Nombre: 'Juan Pérez',
        CUIT: '20-12345678-9',
        Actividad: 'SERVICIOS',
        Provincia: '901',
        RD: 'NO',
        Jubilado: 'NO',
        Adherentes: 0,
        M2: '',
        Alquiler: '',
        MW: '',
        CatAnt: 'A',
        CuotaAnt: 37085.74
      },
      {
        Nombre: 'María García',
        CUIT: '27-98765432-1',
        Actividad: 'BIENES',
        Provincia: '904',
        RD: 'NO',
        Jubilado: 'SI',
        Adherentes: 2,
        M2: 50,
        Alquiler: 500000,
        MW: 3000,
        CatAnt: 'D',
        CuotaAnt: 61824.18
      },
      {
        Nombre: 'Carlos López (Exento)',
        CUIT: '23-11223344-5',
        Actividad: 'SERVICIOS',
        Provincia: 'EX',
        RD: 'NO',
        Jubilado: 'NO',
        Adherentes: 0,
        M2: '',
        Alquiler: '',
        MW: '',
        CatAnt: 'B',
        CuotaAnt: 45000
      },
      {
        Nombre: 'Ana Ruiz (Conv. Multilateral)',
        CUIT: '27-55667788-9',
        Actividad: 'BIENES',
        Provincia: 'CM',
        RD: 'NO',
        Jubilado: 'NO',
        Adherentes: 1,
        M2: 80,
        Alquiler: '',
        MW: '',
        CatAnt: 'E',
        CuotaAnt: 75000
      },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, 'plantilla-clientes.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]

    const previewRows: PreviewRow[] = jsonData.map((row, idx) => {
      const errors: string[] = []

      if (!row.Nombre || String(row.Nombre).trim() === '') {
        errors.push('Nombre requerido')
      }
      const actividad = row.Actividad ? String(row.Actividad).toUpperCase() : null
      if (actividad && !ACTIVITY_MAP[actividad]) {
        errors.push(`Actividad inválida: ${row.Actividad}`)
      }
      const adherentes = row.Adherentes !== undefined ? Number(row.Adherentes) : 0
      if (adherentes < 0 || adherentes > 6) {
        errors.push('Adherentes debe ser 0-6')
      }

      return {
        row: idx + 2,
        data: row,
        valid: errors.length === 0,
        errors,
      }
    })

    setPreview(previewRows)
    setResults(null)
  }

  const handleImport = async () => {
    const validRows = preview.filter(p => p.valid)
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }

    setImporting(true)

    // Preparar datos para el API
    const clients = validRows.map(row => {
      const provinciaRaw = String(row.data.Provincia || '901').toUpperCase().trim()
      const provinceCode = ['EX', 'CM'].includes(provinciaRaw) ? provinciaRaw : provinciaRaw || '901'

      return {
        name: String(row.data.Nombre).trim(),
        cuit: row.data.CUIT ? String(row.data.CUIT).trim() : null,
        activity: ACTIVITY_MAP[String(row.data.Actividad || 'SERVICIOS').toUpperCase()] || 'SERVICIOS',
        province_code: provinceCode,
        works_in_rd: String(row.data.RD || '').toUpperCase() === 'SI',
        is_retired: String(row.data.Jubilado || '').toUpperCase() === 'SI',
        dependents: parseInt(String(row.data.Adherentes || 0)) || 0,
        local_m2: row.data.M2 ? parseInt(String(row.data.M2)) : null,
        annual_rent: row.data.Alquiler ? parseFloat(String(row.data.Alquiler)) : null,
        annual_mw: row.data.MW ? parseInt(String(row.data.MW)) : null,
        previous_category: row.data.CatAnt ? String(row.data.CatAnt).toUpperCase() : null,
        previous_fee: row.data.CuotaAnt ? parseFloat(String(row.data.CuotaAnt)) : null,
      }
    })

    try {
      const response = await fetch('/api/admin/clients/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studioId, clients }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Error en la importación')
        setImporting(false)
        return
      }

      setResults({
        success: result.success,
        errors: result.errors || [],
      })

      toast.success(`Importación completada: ${result.success} clientes importados`)
    } catch (err) {
      toast.error('Error de conexión con el servidor')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Paso 1: Descargar Plantilla</CardTitle>
          <CardDescription>Usá esta plantilla para completar los datos de tus clientes</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />Descargar Plantilla Excel
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            Columnas: {EXPECTED_COLUMNS.join(', ')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Provincia: código numérico (901-923), EX (exento IIBB), o CM (convenio multilateral)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paso 2: Subir Archivo</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="file">Archivo Excel</Label>
          <Input id="file" type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 3: Revisar y Confirmar</CardTitle>
            <CardDescription>
              {preview.filter(p => p.valid).length} de {preview.length} filas válidas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Fila</TableHead>
                    <TableHead className="w-12">Estado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow key={row.row} className={row.valid ? '' : 'bg-red-50'}>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{String(row.data.Nombre || '')}</TableCell>
                      <TableCell className="font-mono text-sm">{String(row.data.CUIT || '-')}</TableCell>
                      <TableCell>{String(row.data.Actividad || '')}</TableCell>
                      <TableCell className="text-xs text-red-600">{row.errors.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={importing || preview.filter(p => p.valid).length === 0}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Importando...' : `Importar ${preview.filter(p => p.valid).length} clientes`}
            </Button>

            {results && (
              <div className="space-y-2">
                <Alert>
                  <AlertDescription>
                    Importación completada: {results.success} exitosos, {results.errors.length} con errores
                  </AlertDescription>
                </Alert>

                {results.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                      <AlertCircle className="h-4 w-4" />
                      Errores de importación
                    </div>
                    <ul className="text-sm text-red-600 space-y-1">
                      {results.errors.map((err, i) => (
                        <li key={i}>Fila {err.row}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
