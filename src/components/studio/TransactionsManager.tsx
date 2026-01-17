import { useState, useEffect } from 'react'
import { useSession } from '@/components/providers/SessionProvider'
import { useTenantSupabase } from '@/hooks/useTenantSupabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Upload, TrendingUp, TrendingDown } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Transaction {
  id: string
  client_id: string
  transaction_type: 'SALE' | 'PURCHASE'
  period: string
  amount: number
  transaction_date: string | null
  description: string | null
}

interface Props {
  clientId: string
  clientName: string
  activePeriod: { sales_period_start: string; sales_period_end: string } | null
  // Optional props for explicit tenant context (used in /admin/my-studios)
  studioId?: string
  schemaName?: string
}

export function TransactionsManager({ clientId, activePeriod, studioId, schemaName }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const { toast } = useToast()

  // Tenant queries - use props if available, otherwise fall back to session
  const session = useSession()
  const tenantContext = schemaName && studioId
    ? { studioId, schemaName }
    : session.studio
      ? { studioId: session.studio.id, schemaName: session.studio.schema_name }
      : null
  const { query, isReady } = useTenantSupabase(tenantContext)

  useEffect(() => {
    if (isReady) {
      fetchTransactions()
    }
  }, [isReady])

  const fetchTransactions = async () => {
    const { data, error } = await query('reca_transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('period', { ascending: false })
      .order('transaction_date', { ascending: false })

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      setTransactions(data || [])
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const data = {
      client_id: clientId,
      transaction_type: formData.get('type') as 'SALE' | 'PURCHASE',
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
      fetchTransactions()
      toast({ title: 'Guardado' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    const { error } = await query('reca_transactions').delete().eq('id', id)
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } else {
      fetchTransactions()
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
    for (const row of rows) {
      if (!row.Periodo || !row.Tipo || row.Monto === undefined) continue

      const txData = {
        client_id: clientId,
        transaction_type: row.Tipo.toUpperCase() === 'VENTA' ? 'SALE' : 'PURCHASE',
        period: String(row.Periodo),
        amount: parseFloat(row.Monto),
        transaction_date: row.Fecha || null,
        description: row.Descripcion || null,
      }

      const { error } = await query('reca_transactions').insert(txData)
      if (!error) success++
    }

    toast({ title: 'Importado', description: `${success} transacciones importadas` })
    fetchTransactions()
    e.target.value = ''
  }

  // Obtener períodos únicos para el filtro
  const uniquePeriods = [...new Set(transactions.map(t => t.period))].sort().reverse()

  // Filtrar transacciones
  const filteredTransactions = periodFilter === 'all'
    ? transactions
    : transactions.filter(t => t.period === periodFilter)

  // Calcular totales
  const totals = filteredTransactions.reduce((acc, t) => {
    if (t.transaction_type === 'SALE') acc.sales += t.amount
    else acc.purchases += t.amount
    return acc
  }, { sales: 0, purchases: 0 })

  // Verificar si período está en rango de reca activa
  const isInActivePeriod = (period: string) => {
    if (!activePeriod) return false
    return period >= activePeriod.sales_period_start && period <= activePeriod.sales_period_end
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  const formatPeriod = (p: string) => `${p.slice(0,4)}/${p.slice(4)}`

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      {/* Totales */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Ventas</p>
                <p className="text-xl font-bold text-green-600">{formatAmount(totals.sales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Compras</p>
                <p className="text-xl font-bold text-red-600">{formatAmount(totals.purchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Neto</p>
            <p className="text-xl font-bold">{formatAmount(totals.sales - totals.purchases)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y acciones */}
      <div className="flex items-center gap-4">
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

        <label className="cursor-pointer">
          <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" asChild>
            <span><Upload className="h-4 w-4 mr-2" />Importar</span>
          </Button>
        </label>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTransaction(null)}>
              <Plus className="h-4 w-4 mr-2" />Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? 'Editar' : 'Nueva'} Transacción</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Tipo *</Label>
                <Select name="type" defaultValue={editingTransaction?.transaction_type || 'SALE'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALE">Venta</SelectItem>
                    <SelectItem value="PURCHASE">Compra</SelectItem>
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

      {/* Tabla */}
      <div className="bg-white rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No hay transacciones
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <span className="font-mono">{formatPeriod(tx.period)}</span>
                    {isInActivePeriod(tx.period) && (
                      <Badge variant="outline" className="ml-2 text-xs">Reca</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.transaction_type === 'SALE' ? 'default' : 'secondary'}>
                      {tx.transaction_type === 'SALE' ? 'Venta' : 'Compra'}
                    </Badge>
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
    </div>
  )
}
