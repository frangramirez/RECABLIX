/**
 * OperationsManagerWithStudio - Wrapper de OperationsManager con contexto explícito
 *
 * Permite usar el OperationsManager con un studioId específico
 * en lugar de depender de la sesión
 */

import { useState, useEffect, useMemo } from 'react'
import { useTenantSupabase } from '@/hooks/useTenantSupabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Upload, Download, TrendingUp, TrendingDown, Search, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

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
  studioId: string
  schemaName: string
}

export function OperationsManagerWithStudio({ studioId, schemaName }: Props) {
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

  // Usar el hook de tenant con contexto explícito
  const tenantContext = { studioId, schemaName }
  const { query, isReady } = useTenantSupabase(tenantContext)

  useEffect(() => {
    if (isReady) {
      fetchData()
    }
  }, [isReady])

  const fetchData = async () => {
    // Fetch clients con recablix
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
      toast.error(error.message)
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

    const clientId = formData.get('client_id') as string
    if (!clientId) {
      toast.error('Seleccione un cliente')
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
      toast.error(error.message)
    } else {
      setIsDialogOpen(false)
      setEditingTransaction(null)
      setSelectedClientId('')
      fetchData()
      toast.success('Guardado')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    const { error } = await query('reca_transactions').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      fetchData()
    }
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

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const formatPeriod = (p: string) => `${p.slice(0,4)}/${p.slice(4)}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Cargando operaciones...</span>
      </div>
    )
  }

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
                    {formatPeriod(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>

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
                      name="client_id"
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
          <div className="bg-card rounded-xl border">
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
