import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  calculateRecategorizationFromData,
  getScalesForPeriod,
  getFeeComponentsForPeriod,
  formatARS,
  type RecategorizationResult,
  type ClientData,
  type Scale,
  type FeeComponentData,
  type ClientActivity
} from '@/lib/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Download, FileText, TrendingUp, TrendingDown, Minus, RefreshCw, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Props {
  studioId: string
  recaId: string
  recaCode: string
  salesPeriodStart: string
  salesPeriodEnd: string
}

type ChangeFilter = 'all' | 'UP' | 'DOWN' | 'SAME' | 'NEW'

export function RecategorizationView({
  studioId,
  recaId,
  recaCode,
  salesPeriodStart,
  salesPeriodEnd
}: Props) {
  const [results, setResults] = useState<RecategorizationResult[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all')
  const [selectedResult, setSelectedResult] = useState<RecategorizationResult | null>(null)
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [generatingPdfs, setGeneratingPdfs] = useState(false)

  // Cache de escalas y componentes para recálculo
  const [cachedScales, setCachedScales] = useState<Scale[] | null>(null)
  const [cachedFeeComponents, setCachedFeeComponents] = useState<FeeComponentData[] | null>(null)

  useEffect(() => {
    calculateAll()
  }, [])

  const calculateAll = async () => {
    setLoading(true)

    try {
      // 1. Obtener clientes con datos de reca en UNA query
      const { data: clientsWithData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id, name,
          reca_client_data (
            activity, province_code, works_in_rd, is_retired,
            dependents, local_m2, annual_rent, annual_mw,
            previous_category, previous_fee
          )
        `)
        .eq('studio_id', studioId)
        .contains('apps', ['recablix'])

      if (clientsError) {
        toast.error('Error al cargar clientes', { description: clientsError.message })
        setLoading(false)
        return
      }

      if (!clientsWithData || clientsWithData.length === 0) {
        setResults([])
        setLoading(false)
        return
      }

      // 2. Obtener TODAS las transacciones del período en UNA query
      const clientIds = clientsWithData.map(c => c.id)
      const { data: allTx, error: txError } = await supabase
        .from('reca_transactions')
        .select('client_id, transaction_type, amount')
        .in('client_id', clientIds)
        .gte('period', salesPeriodStart)
        .lte('period', salesPeriodEnd)

      if (txError) {
        toast.error('Error al cargar transacciones', { description: txError.message })
        setLoading(false)
        return
      }

      // 3. Agrupar transacciones por cliente en memoria
      const salesByClient = new Map<string, number>()
      allTx?.forEach(tx => {
        if (tx.transaction_type === 'SALE') {
          const current = salesByClient.get(tx.client_id) || 0
          salesByClient.set(tx.client_id, current + Number(tx.amount))
        }
      })

      // 4. Obtener escalas y componentes UNA vez (o usar cache)
      let scales = cachedScales
      let feeComponents = cachedFeeComponents

      if (!scales || !feeComponents) {
        const [scalesData, feeComponentsData] = await Promise.all([
          getScalesForPeriod(supabase, recaId),
          getFeeComponentsForPeriod(supabase, recaId)
        ])
        scales = scalesData
        feeComponents = feeComponentsData
        setCachedScales(scales)
        setCachedFeeComponents(feeComponents)
      }

      // 5. Calcular usando función PURA
      const calculatedResults: RecategorizationResult[] = []

      for (const client of clientsWithData) {
        const reca = (client.reca_client_data as any)?.[0] || {}

        const clientData: ClientData = {
          id: client.id,
          name: client.name,
          activity: (reca.activity as ClientActivity) || 'SERVICIOS',
          provinceCode: reca.province_code || '901',
          worksInRD: reca.works_in_rd || false,
          isRetired: reca.is_retired || false,
          dependents: reca.dependents || 0,
          localM2: reca.local_m2 || null,
          annualRent: reca.annual_rent || null,
          annualMW: reca.annual_mw || null,
          periodSales: salesByClient.get(client.id) || 0,
          previousCategory: reca.previous_category || null,
          previousFee: reca.previous_fee || null,
        }

        try {
          const result = calculateRecategorizationFromData(scales!, feeComponents!, clientData)
          calculatedResults.push(result)
        } catch (err) {
          console.error(`Error calculando ${client.name}:`, err)
        }
      }

      setResults(calculatedResults)
    } catch (err) {
      console.error('Error en cálculo:', err)
      toast.error('Error al calcular recategorizaciones')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar resultados
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchesSearch = search === '' ||
        r.client.name.toLowerCase().includes(search.toLowerCase())
      const matchesChange = changeFilter === 'all' ||
        r.comparison.categoryChange === changeFilter
      return matchesSearch && matchesChange
    })
  }, [results, search, changeFilter])

  // Estadísticas
  const stats = useMemo(() => ({
    total: results.length,
    up: results.filter(r => r.comparison.categoryChange === 'UP').length,
    down: results.filter(r => r.comparison.categoryChange === 'DOWN').length,
    same: results.filter(r => r.comparison.categoryChange === 'SAME').length,
    new: results.filter(r => r.comparison.categoryChange === 'NEW').length,
    totalPreviousFee: results.reduce((acc, r) => acc + (r.comparison.previousFee || 0), 0),
    totalNewFee: results.reduce((acc, r) => acc + r.totalFee, 0),
  }), [results])

  const handleExport = () => {
    const exportData = results.map(r => ({
      Cliente: r.client.name,
      'Cat Anterior': r.comparison.previousCategory || '-',
      'Cuota Anterior': r.comparison.previousFee || 0,
      'Nueva Cat': r.category.finalCategory,
      'Nueva Cuota': r.totalFee,
      'Cambio': r.comparison.categoryChange,
      'Diff Cuota': r.comparison.feeChange,
      'Diff %': r.comparison.feeChangePercent?.toFixed(2) || '-',
      'Comp Impositivo': r.feeComponents.subtotals.impositivo,
      'Comp Jubilatorio': r.feeComponents.subtotals.jubilatorio,
      'Comp OS': r.feeComponents.subtotals.obraSocial,
      'Comp Provincial': r.feeComponents.subtotals.provincial,
      'Comp Municipal': r.feeComponents.subtotals.municipal,
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recategorización')
    XLSX.writeFile(wb, `recategorizacion-${recaCode}.xlsx`)
    toast.success('Archivo exportado', { description: `recategorizacion-${recaCode}.xlsx` })
  }

  const handleBatchPdf = async () => {
    setGeneratingPdfs(true)
    try {
      const clientIds = selectedClients.size > 0
        ? Array.from(selectedClients)
        : results.map(r => r.client.id)

      const response = await fetch('/api/pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds }),
      })

      if (!response.ok) {
        throw new Error('Error al generar PDFs')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RECA-${recaCode}.zip`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('PDFs generados', {
        description: `${clientIds.length} archivos descargados en RECA-${recaCode}.zip`
      })
    } catch (err) {
      console.error('Error generating PDFs:', err)
      toast.error('Error al generar PDFs')
    } finally {
      setGeneratingPdfs(false)
    }
  }

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedClients.size === filteredResults.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredResults.map(r => r.client.id)))
    }
  }

  const getChangeIcon = (change: string) => {
    switch (change) {
      case 'UP':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'DOWN':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'SAME':
        return <Minus className="h-4 w-4 text-gray-400" />
      default:
        return <Badge variant="outline" className="text-xs">Nuevo</Badge>
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="mt-2 text-gray-500">Calculando recategorizaciones...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Clientes</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <p className="text-sm text-red-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Suben
            </p>
            <p className="text-2xl font-bold text-red-600">{stats.up}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-4">
            <p className="text-sm text-green-600 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Bajan
            </p>
            <p className="text-2xl font-bold text-green-600">{stats.down}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Minus className="h-3 w-3" /> Igual
            </p>
            <p className="text-2xl font-bold">{stats.same}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Cuota Total Nueva</p>
            <p className="text-xl font-bold">{formatARS(stats.totalNewFee)}</p>
            <p className="text-xs text-gray-400">Ant: {formatARS(stats.totalPreviousFee)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={changeFilter} onValueChange={(v: ChangeFilter) => setChangeFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="UP">Suben</SelectItem>
            <SelectItem value="DOWN">Bajan</SelectItem>
            <SelectItem value="SAME">Igual</SelectItem>
            <SelectItem value="NEW">Nuevos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={handleExport} disabled={results.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
        <Button
          variant="outline"
          onClick={handleBatchPdf}
          disabled={results.length === 0 || generatingPdfs}
        >
          {generatingPdfs ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          PDFs ({selectedClients.size || results.length})
        </Button>
        <Button variant="outline" onClick={calculateAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recalcular
        </Button>
      </div>

      {/* Tabla */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-500">
            {results.length === 0
              ? 'No hay clientes con datos de recategorización'
              : 'No se encontraron resultados con los filtros aplicados'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedClients.size === filteredResults.length && filteredResults.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Cat Ant</TableHead>
                <TableHead className="text-center w-12"></TableHead>
                <TableHead className="text-center">Cat Nueva</TableHead>
                <TableHead className="text-right">Cuota Ant</TableHead>
                <TableHead className="text-right">Cuota Nueva</TableHead>
                <TableHead className="text-right">Variacion</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((result) => (
                <TableRow
                  key={result.client.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedResult(result)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedClients.has(result.client.id)}
                      onChange={() => toggleClientSelection(result.client.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{result.client.name}</TableCell>
                  <TableCell className="text-center">
                    {result.comparison.previousCategory ? (
                      <Badge variant="outline">{result.comparison.previousCategory}</Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getChangeIcon(result.comparison.categoryChange)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge>{result.category.finalCategory}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {result.comparison.previousFee
                      ? formatARS(result.comparison.previousFee)
                      : <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {formatARS(result.totalFee)}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-mono ${
                    result.comparison.feeChangePercent && result.comparison.feeChangePercent > 0
                      ? 'text-red-600'
                      : result.comparison.feeChangePercent && result.comparison.feeChangePercent < 0
                        ? 'text-green-600'
                        : ''
                  }`}>
                    {result.comparison.feeChangePercent
                      ? `${result.comparison.feeChangePercent > 0 ? '+' : ''}${result.comparison.feeChangePercent.toFixed(1)}%`
                      : <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedResult(result)
                        }}
                        title="Ver detalle"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/studio/recategorization/${result.client.id}/pdf`, '_blank')
                        }}
                        title="Ver PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog detalle */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle: {selectedResult?.client.name}</DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-6">
              {/* Categoría por parámetro */}
              <div>
                <h4 className="font-semibold mb-3">Determinación de Categoría</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Por Ingresos:</span>
                    <Badge variant="outline">{selectedResult.category.categoryByIncome}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Por M²:</span>
                    <Badge variant="outline">{selectedResult.category.categoryByM2}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Por MW:</span>
                    <Badge variant="outline">{selectedResult.category.categoryByMW}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Por Alquileres:</span>
                    <Badge variant="outline">{selectedResult.category.categoryByRent}</Badge>
                  </div>
                </div>
                <div className="mt-3 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
                  <span className="font-medium text-blue-900">Categoría Final (máxima):</span>
                  <Badge className="text-lg px-4 py-1">{selectedResult.category.finalCategory}</Badge>
                </div>
              </div>

              {/* Desglose de cuota */}
              <div>
                <h4 className="font-semibold mb-3">Desglose de Cuota</h4>
                <div className="space-y-1">
                  {selectedResult.feeComponents.components.map((comp, idx) => (
                    <div
                      key={idx}
                      className={`flex justify-between items-center p-3 rounded-lg text-sm ${
                        comp.applied
                          ? 'bg-gray-50'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <div className="flex-1">
                        <span>{comp.description}</span>
                        {comp.reason && (
                          <span className="text-xs ml-2 text-gray-400">({comp.reason})</span>
                        )}
                      </div>
                      <span className="font-mono">
                        {comp.applied ? formatARS(comp.value) : '-'}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg font-medium mt-2">
                    <span className="text-blue-900">TOTAL CUOTA</span>
                    <span className="font-mono text-lg text-blue-900">
                      {formatARS(selectedResult.totalFee)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparación */}
              {selectedResult.comparison.previousFee !== null && (
                <div>
                  <h4 className="font-semibold mb-3">Comparación con Período Anterior</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Cuota Anterior</p>
                      <p className="font-mono font-medium">
                        {formatARS(selectedResult.comparison.previousFee)}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Diferencia</p>
                      <p className={`font-mono font-medium ${
                        selectedResult.comparison.feeChange > 0
                          ? 'text-red-600'
                          : selectedResult.comparison.feeChange < 0
                            ? 'text-green-600'
                            : ''
                      }`}>
                        {selectedResult.comparison.feeChange > 0 ? '+' : ''}
                        {formatARS(selectedResult.comparison.feeChange)}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Variación</p>
                      <p className={`font-mono font-medium ${
                        selectedResult.comparison.feeChangePercent! > 0
                          ? 'text-red-600'
                          : selectedResult.comparison.feeChangePercent! < 0
                            ? 'text-green-600'
                            : ''
                      }`}>
                        {selectedResult.comparison.feeChangePercent! > 0 ? '+' : ''}
                        {selectedResult.comparison.feeChangePercent?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
