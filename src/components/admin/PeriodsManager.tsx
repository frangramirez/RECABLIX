import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface RecaPeriod {
  id: string
  code: string
  year: number
  semester: number
  sales_period_start: string | null
  sales_period_end: string | null
  fee_period_start: string | null
  fee_period_end: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface PeriodFormData {
  code: string
  year: number
  semester: number
  sales_period_start: string
  sales_period_end: string
  fee_period_start: string
  fee_period_end: string
}

export function PeriodsManager() {
  const [periods, setPeriods] = useState<RecaPeriod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<RecaPeriod | null>(null)
  const [formData, setFormData] = useState<PeriodFormData>({
    code: '',
    year: new Date().getFullYear(),
    semester: 1,
    sales_period_start: '',
    sales_period_end: '',
    fee_period_start: '',
    fee_period_end: '',
  })

  useEffect(() => {
    fetchPeriods()
  }, [])

  async function fetchPeriods() {
    try {
      const { data, error } = await supabase
        .from('reca_periods')
        .select('*')
        .order('code', { ascending: false })

      if (error) throw error
      setPeriods(data || [])
    } catch (error) {
      console.error('Error fetching periods:', error)
      toast.error('Error al cargar períodos')
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingPeriod(null)
    setFormData({
      code: '',
      year: new Date().getFullYear(),
      semester: 1,
      sales_period_start: '',
      sales_period_end: '',
      fee_period_start: '',
      fee_period_end: '',
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(period: RecaPeriod) {
    setEditingPeriod(period)
    setFormData({
      code: period.code,
      year: period.year,
      semester: period.semester,
      sales_period_start: period.sales_period_start || '',
      sales_period_end: period.sales_period_end || '',
      fee_period_start: period.fee_period_start || '',
      fee_period_end: period.fee_period_end || '',
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validación
    if (formData.sales_period_start && formData.sales_period_end) {
      if (formData.sales_period_start >= formData.sales_period_end) {
        toast.error('La fecha de inicio debe ser anterior a la fecha de fin')
        return
      }
    }

    try {
      const response = await fetch('/api/admin/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: {
            id: editingPeriod?.id,
            code: formData.code,
            year: formData.year,
            semester: formData.semester,
            sales_period_start: formData.sales_period_start || null,
            sales_period_end: formData.sales_period_end || null,
            fee_period_start: formData.fee_period_start || null,
            fee_period_end: formData.fee_period_end || null,
          },
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al guardar')

      toast.success(editingPeriod ? 'Período actualizado correctamente' : 'Período creado correctamente')
      setIsDialogOpen(false)
      fetchPeriods()
    } catch (error: any) {
      console.error('Error saving period:', error)
      toast.error(error.message || 'Error al guardar período')
    }
  }

  async function toggleActive(period: RecaPeriod) {
    try {
      const response = await fetch('/api/admin/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: period.id,
          is_active: !period.is_active,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al cambiar estado')

      toast.success(
        period.is_active
          ? 'Período desactivado'
          : 'Período activado (otros desactivados)'
      )
      fetchPeriods()
    } catch (error: any) {
      console.error('Error toggling active:', error)
      toast.error(error.message || 'Error al cambiar estado')
    }
  }

  async function handleDelete(period: RecaPeriod) {
    if (
      !confirm(
        `¿Eliminar el período ${period.code}? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }

    try {
      const response = await fetch('/api/admin/periods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: period.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Error al eliminar')

      toast.success('Período eliminado correctamente')
      fetchPeriods()
    } catch (error: any) {
      console.error('Error deleting period:', error)
      toast.error(error.message || 'Error al eliminar período')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Cargando períodos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {periods.length} período{periods.length !== 1 ? 's' : ''} configurado
          {periods.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Período
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Año/Sem</TableHead>
              <TableHead>Período Ventas</TableHead>
              <TableHead>Período Cuota</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    No hay períodos configurados. Crea uno nuevo.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.code}</TableCell>
                  <TableCell>
                    {period.year}/{period.semester}° Sem
                  </TableCell>
                  <TableCell className="text-sm">
                    {period.sales_period_start && period.sales_period_end ? (
                      <>
                        {period.sales_period_start} → {period.sales_period_end}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin definir</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {period.fee_period_start && period.fee_period_end ? (
                      <>
                        {period.fee_period_start} → {period.fee_period_end}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin definir</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={period.is_active}
                        onCheckedChange={() => toggleActive(period)}
                      />
                      {period.is_active && (
                        <Badge variant="default">Activo</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(period)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(period)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog para crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPeriod ? 'Editar Período' : 'Nuevo Período'}
            </DialogTitle>
            <DialogDescription>
              {editingPeriod
                ? 'Modifica los datos del período de recategorización.'
                : 'Crea un nuevo período de recategorización de monotributo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="251"
                  required
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({ ...formData, year: parseInt(e.target.value) })
                  }
                  min={2020}
                  max={2100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semestre</Label>
                <Input
                  id="semester"
                  type="number"
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      semester: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  max={2}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Período de Ventas</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={formData.sales_period_start}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sales_period_start: e.target.value,
                    })
                  }
                  placeholder="YYYYMM (ej: 202401)"
                  maxLength={6}
                />
                <Input
                  value={formData.sales_period_end}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sales_period_end: e.target.value,
                    })
                  }
                  placeholder="YYYYMM (ej: 202406)"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Período de Cuota</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={formData.fee_period_start}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fee_period_start: e.target.value,
                    })
                  }
                  placeholder="YYYYMM (ej: 202407)"
                  maxLength={6}
                />
                <Input
                  value={formData.fee_period_end}
                  onChange={(e) =>
                    setFormData({ ...formData, fee_period_end: e.target.value })
                  }
                  placeholder="YYYYMM (ej: 202412)"
                  maxLength={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingPeriod ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
