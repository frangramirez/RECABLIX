import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Upload, Download, CheckCircle, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface PreviewRow {
  row: number
  data: Record<string, any>
  valid: boolean
  errors: string[]
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

export function ClientImporter() {
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null)
  const { toast } = useToast()

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
    const jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]

    const previewRows: PreviewRow[] = jsonData.map((row, idx) => {
      const errors: string[] = []

      if (!row.Nombre?.trim()) errors.push('Nombre requerido')
      if (row.Actividad && !ACTIVITY_MAP[row.Actividad.toUpperCase()]) {
        errors.push(`Actividad inválida: ${row.Actividad}`)
      }
      if (row.Adherentes !== undefined && (row.Adherentes < 0 || row.Adherentes > 6)) {
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
      toast({ variant: 'destructive', title: 'Error', description: 'No hay filas válidas para importar' })
      return
    }

    setImporting(true)
    let success = 0
    let errors = 0

    for (const row of validRows) {
      try {
        // 1. Insert into clients
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: row.data.Nombre.trim(),
            cuit: row.data.CUIT?.trim() || null,
            apps: ['recablix'],
            fiscal_year: new Date().getFullYear(),
          })
          .select()
          .single()

        if (clientError) {
          errors++
          continue
        }

        // 2. Insert into reca_client_data
        // Parsear provincia: acepta códigos numéricos (901-923), 'EX' (exento), 'CM' (conv. multilateral)
        const provinciaRaw = String(row.data.Provincia || '901').toUpperCase().trim()
        const provinceCode = ['EX', 'CM'].includes(provinciaRaw) ? provinciaRaw : provinciaRaw || '901'

        const { error: recaError } = await supabase
          .from('reca_client_data')
          .insert({
            client_id: newClient.id,
            activity: ACTIVITY_MAP[row.data.Actividad?.toUpperCase()] || 'SERVICIOS',
            province_code: provinceCode,
            works_in_rd: row.data.RD?.toUpperCase() === 'SI',
            is_retired: row.data.Jubilado?.toUpperCase() === 'SI',
            dependents: parseInt(row.data.Adherentes) || 0,
            local_m2: row.data.M2 ? parseInt(row.data.M2) : null,
            annual_rent: row.data.Alquiler ? parseFloat(row.data.Alquiler) : null,
            annual_mw: row.data.MW ? parseInt(row.data.MW) : null,
            previous_category: row.data.CatAnt?.toUpperCase() || null,
            previous_fee: row.data.CuotaAnt ? parseFloat(row.data.CuotaAnt) : null,
          })

        if (recaError) {
          // Rollback: delete the client
          await supabase.from('clients').delete().eq('id', newClient.id)
          errors++
        } else {
          success++
        }
      } catch (err) {
        errors++
      }
    }

    setResults({ success, errors })
    setImporting(false)
    toast({
      title: 'Importación completada',
      description: `${success} clientes importados, ${errors} errores`
    })
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
                      <TableCell>{row.data.Nombre}</TableCell>
                      <TableCell className="font-mono text-sm">{row.data.CUIT || '-'}</TableCell>
                      <TableCell>{row.data.Actividad}</TableCell>
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
              <Alert>
                <AlertDescription>
                  Importación completada: {results.success} exitosos, {results.errors} con errores
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
