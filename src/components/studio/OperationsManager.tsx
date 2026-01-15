import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Upload, Download, TrendingUp, TrendingDown, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useSession } from '@/components/providers/SessionProvider'
import { useTenantSupabase } from '@/hooks/useTenantSupabase'

interface Transaction {
  id: string
  client_id: string
  transaction_type: 'SALE' | 'PURCHASE'
  period: string
  amount: number
  transaction_date: string | null
  description: string | null
  client_name?: string
  client_cuit?: string
}

interface Client {
  id: string
  name: string
  cuit: string | null
}

interface Props {
  activePeriod: { sales_period_start: string; sales_period_end: string } | null
}

export function OperationsManager({ activePeriod }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'SALE' | 'PURCHASE'>('SALE')
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const { toast } = useToast()

  const session = useSession()
  const tenantContext = session.studio ? {
    studioId: session.studio.id,
    schemaName: session.studio.schema_name
  } : null
  const { query, isReady } = useTenantSupabase(tenantContext)

  useEffect(() => {
    if (isReady) {
      fetchData()
    }
  }, [isReady])

  const fetchData = async () => {
    // Fetch clients con recablix (usa tenant schema automáticamente)
    const { data: clientsData } = await query('clients')
      .select('id, name, cuit')
      .contains('apps', ['recablix'])
      .order('name')

    setClients(clientsData || [])

    // Fetch todas las transacciones con datos del cliente
    const { data: txData, error } = await query('reca_transactions')
      .select(`
        id,
        client_id,
        transaction_type,
        period,
        amount,
        transaction_date,
        description,
        clients!inner (
          name,
          cuit
        )
      `)
      .order('period', { ascending: false })
      .order('transaction_date', { ascending: false })

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      // Flatten client data
      const flattenedTx = txData?.map(tx => ({
        ...tx,
        client_name: (tx.clients as any)?.name,
        client_cuit: (tx.clients as any)?.cuit,
      })) || []
      setTransactions(flattenedTx)
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const clientId = selectedClientId || editingTransaction?.client_id
    if (!clientId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccione un cliente' })
      return
    }

    const data = {
      client_id: clientId,
      transaction_type: activeTab,
      period: formData.get('period') as string,
      amount: parseFloat(formData.get('amount') as string),
      transaction_date: (formData.get('date') as string) || null,
      description: (formData.get('description') as string) || null,
    }

    let error
    if (editingTransaction) {
      const result = await query('reca_transactions').update(data).eq('id', editingTransaction.id)
      error = result.error
    } else {
      const result = await query('reca_transactions').insert(data)
      error = result.error
    }

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      setIsDialogOpen(false)
      setEditingTransaction(null)
      setSelectedClientId('')
      fetchData()
      toast({ title: 'Guardado' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    const { error } = await query('reca_transactions').delete().eq('id', id)
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      fetchData()
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws) as any[]

    let success = 0
    let errors: string[] = []

    for (const row of rows) {
      // Buscar cliente por CUIT o Nombre
      const clientIdentifier = row.CUIT || row.Cliente
      if (!clientIdentifier) {
        errors.push(`Fila sin cliente identificado`)
        continue
      }

      const client = clients.find(c =>
        c.cuit === String(clientIdentifier).trim() ||
        c.name.toLowerCase() === String(clientIdentifier).toLowerCase().trim()
      )

      if (!client) {
        errors.push(`Cliente no encontrado: ${clientIdentifier}`)
        continue
      }

      if (!row.Periodo || row.Monto === undefined) {
        errors.push(`Fila incompleta para ${clientIdentifier}`)
        continue
      }

      // Determinar tipo si no está especificado
      let txType = activeTab
      if (row.Tipo) {
        const tipo = String(row.Tipo).toUpperCase()
        if (tipo === 'VENTA' || tipo === 'SALE') txType = 'SALE'
        else if (tipo === 'COMPRA' || tipo === 'PURCHASE') txType = 'PURCHASE'
      }

      const txData = {
        client_id: client.id,
        transaction_type: txType,
        period: String(row.Periodo),
        amount: parseFloat(row.Monto),
        transaction_date: row.Fecha || null,
        description: row.Descripcion || null,
      }

      const { error } = await query('reca_transactions').insert(txData)
      if (!error) success++
      else errors.push(`Error al insertar para ${client.name}: ${error.message}`)
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: `Importado con errores`,
        description: `${success} ok, ${errors.length} errores. Ver consola.`
      })
      console.error('Errores de importación:', errors)
    } else {
      toast({ title: 'Importado', description: `${success} transacciones importadas` })
    }

    fetchData()
    e.target.value = ''
  }

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
      Cliente: tx.client_name,
      CUIT: tx.client_cuit,
      Tipo: tx.transaction_type === 'SALE' ? 'Venta' : 'Compra',
      Periodo: tx.period,
      Monto: tx.amount,
      Fecha: tx.transaction_date || '',
      Descripcion: tx.description || '',
    }))

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'SALE' ? 'Ventas' : 'Compras')
    XLSX.writeFile(wb, `operaciones_${activeTab.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Períodos únicos
  const uniquePeriods = useMemo(() =>
    [...new Set(transactions.map(t => t.period))].sort().reverse(),
    [transactions]
  )

  // Filtrar transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.transaction_type !== activeTab) return false
      if (periodFilter !== 'all' && t.period !== periodFilter) return false
      if (clientFilter !== 'all' && t.client_id !== clientFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!t.client_name?.toLowerCase().includes(s) && !t.client_cuit?.includes(s)) return false
      }
      return true
    })
  }, [transactions, activeTab, periodFilter, clientFilter, search])

  // Totales por tab
  const totals = useMemo(() => {
    const sales = transactions.filter(t => t.transaction_type === 'SALE')
    const purchases = transactions.filter(t => t.transaction_type === 'PURCHASE')
    return {
      sales: sales.reduce((acc, t) => acc + t.amount, 0),
      purchases: purchases.reduce((acc, t) => acc + t.amount, 0),
      filteredTotal: filteredTransactions.reduce((acc, t) => acc + t.amount, 0),
    }
  }, [transactions, filteredTransactions])

  const isInActivePeriod = (period: string) => {
    if (!activePeriod) return false
    return period >= activePeriod.sales_period_start && period <= activePeriod.sales_period_end
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const formatPeriod = (p: string) => `${p.slice(0,4)}/${p.slice(4)}`

  if (loading || !isReady) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      {/* Totales generales */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={activeTab === 'SALE' ? 'ring-2 ring-green-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Total Ventas</p>
                <p className="text-xl font-bold text-green-600">{formatAmount(totals.sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={activeTab === 'PURCHASE' ? 'ring-2 ring-red-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Total Compras</p>
                <p className="text-xl font-bold text-red-600">{formatAmount(totals.purchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'SALE' | 'PURCHASE')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="SALE" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
            <TrendingUp className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="PURCHASE" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800">
            <TrendingDown className="h-4 w-4 mr-2" />
            Compras
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {/* Filtros y acciones */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniquePeriods.map(p => (
                  <SelectItem key={p} value={p}>
                    {formatPeriod(p)} {isInActivePeriod(p) && '✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>

            <label className="cursor-pointer">
              <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              <Button variant="outline" asChild>
                <span><Upload className="h-4 w-4 mr-2" />Importar</span>
              </Button>
            </label>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingTransaction(null); setSelectedClientId(''); }}>
                  <Plus className="h-4 w-4 mr-2" />Nueva
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? 'Editar' : 'Nueva'} {activeTab === 'SALE' ? 'Venta' : 'Compra'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Select
                      value={selectedClientId || editingTransaction?.client_id || ''}
                      onValueChange={setSelectedClientId}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.cuit && `(${c.cuit})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="period">Período (YYYYMM) *</Label>
                    <Input id="period" name="period" defaultValue={editingTransaction?.period || ''}
                      placeholder="202501" maxLength={6} required />
                  </div>
                  <div>
                    <Label htmlFor="amount">Monto ($) *</Label>
                    <Input id="amount" name="amount" type="number" step="0.01"
                      defaultValue={editingTransaction?.amount || ''} required />
                    <p className="text-xs text-gray-500 mt-1">Usar negativo para NC</p>
                  </div>
                  <div>
                    <Label htmlFor="date">Fecha</Label>
                    <Input id="date" name="date" type="date"
                      defaultValue={editingTransaction?.transaction_date || ''} />
                  </div>
                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Input id="description" name="description"
                      defaultValue={editingTransaction?.description || ''} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Guardar</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Subtotal filtrado */}
          {(periodFilter !== 'all' || clientFilter !== 'all' || search) && (
            <div className="text-sm text-gray-600">
              Total filtrado: <span className="font-semibold">{formatAmount(totals.filteredTotal)}</span>
              {' '}({filteredTransactions.length} registros)
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No hay {activeTab === 'SALE' ? 'ventas' : 'compras'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.client_name}</TableCell>
                      <TableCell className="text-sm text-gray-500 font-mono">
                        {tx.client_cuit || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{formatPeriod(tx.period)}</span>
                        {isInActivePeriod(tx.period) && (
                          <Badge variant="outline" className="ml-2 text-xs">Reca</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {tx.transaction_date || '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${tx.amount < 0 ? 'text-red-600' : ''}`}>
                        {formatAmount(tx.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {tx.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingTransaction(tx)
                            setSelectedClientId(tx.client_id)
                            setIsDialogOpen(true)
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
