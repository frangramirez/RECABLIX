import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Save, ArrowLeft } from 'lucide-react'

interface ClientData {
  id?: string
  name: string
  cuit: string | null
  activity: 'BIENES' | 'SERVICIOS' | 'LOCACION' | 'SOLO_LOC_2_INM'
  province_code: string
  works_in_rd: boolean
  is_retired: boolean
  dependents: number
  local_m2: number | null
  annual_rent: number | null
  annual_mw: number | null
  previous_category: string | null
  previous_fee: number | null
}

interface Props {
  initialData?: ClientData
  studioId: string
}

const ACTIVITIES = [
  { value: 'BIENES', label: 'Venta de Bienes' },
  { value: 'SERVICIOS', label: 'Prestación de Servicios' },
  { value: 'LOCACION', label: 'Locación' },
  { value: 'SOLO_LOC_2_INM', label: 'Solo Locación (hasta 2 inmuebles)' },
]

const PROVINCES = [
  { code: '901', name: 'CABA' }, { code: '902', name: 'Buenos Aires' },
  { code: '903', name: 'Catamarca' }, { code: '904', name: 'Córdoba' },
  { code: '905', name: 'Corrientes' }, { code: '906', name: 'Chaco' },
  { code: '907', name: 'Chubut' }, { code: '908', name: 'Entre Ríos' },
  { code: '909', name: 'Formosa' }, { code: '910', name: 'Jujuy' },
  { code: '911', name: 'La Pampa' }, { code: '912', name: 'La Rioja' },
  { code: '913', name: 'Mendoza' }, { code: '914', name: 'Misiones' },
  { code: '915', name: 'Neuquén' }, { code: '916', name: 'Río Negro' },
  { code: '917', name: 'Salta' }, { code: '918', name: 'San Juan' },
  { code: '919', name: 'San Luis' }, { code: '920', name: 'Santa Cruz' },
  { code: '921', name: 'Santa Fe' }, { code: '922', name: 'Sgo del Estero' },
  { code: '923', name: 'Tierra del Fuego' }, { code: '924', name: 'Tucumán' },
]

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

export function ClientForm({ initialData, studioId }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ClientData>({
    name: initialData?.name || '',
    cuit: initialData?.cuit || null,
    activity: initialData?.activity || 'SERVICIOS',
    province_code: initialData?.province_code || '901',
    works_in_rd: initialData?.works_in_rd || false,
    is_retired: initialData?.is_retired || false,
    dependents: initialData?.dependents || 0,
    local_m2: initialData?.local_m2 || null,
    annual_rent: initialData?.annual_rent || null,
    annual_mw: initialData?.annual_mw || null,
    previous_category: initialData?.previous_category || null,
    previous_fee: initialData?.previous_fee || null,
  })
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (initialData?.id) {
        // UPDATE: actualizar clients y reca_client_data
        const { error: clientError } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            cuit: formData.cuit?.trim() || null,
          })
          .eq('id', initialData.id)

        if (clientError) throw clientError

        const { error: recaError } = await supabase
          .from('reca_client_data')
          .upsert({
            client_id: initialData.id,
            activity: formData.activity,
            province_code: formData.province_code,
            works_in_rd: formData.works_in_rd,
            is_retired: formData.is_retired,
            dependents: formData.dependents,
            local_m2: formData.local_m2,
            annual_rent: formData.annual_rent,
            annual_mw: formData.annual_mw,
            previous_category: formData.previous_category,
            previous_fee: formData.previous_fee,
          })

        if (recaError) throw recaError

        toast({ title: 'Actualizado', description: 'Cliente actualizado correctamente' })
      } else {
        // CREATE: insertar en clients y luego en reca_client_data
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            studio_id: studioId,
            name: formData.name,
            cuit: formData.cuit?.trim() || null,
            apps: ['recablix'],
            fiscal_year: new Date().getFullYear(),
          })
          .select()
          .single()

        if (clientError) throw clientError

        const { error: recaError } = await supabase
          .from('reca_client_data')
          .insert({
            client_id: newClient.id,
            activity: formData.activity,
            province_code: formData.province_code,
            works_in_rd: formData.works_in_rd,
            is_retired: formData.is_retired,
            dependents: formData.dependents,
            local_m2: formData.local_m2,
            annual_rent: formData.annual_rent,
            annual_mw: formData.annual_mw,
            previous_category: formData.previous_category,
            previous_fee: formData.previous_fee,
          })

        if (recaError) throw recaError

        toast({ title: 'Creado', description: 'Cliente creado correctamente' })
      }

      window.location.href = '/studio/clients'
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: keyof ClientData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Datos Básicos</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cuit">CUIT</Label>
              <Input
                id="cuit"
                value={formData.cuit || ''}
                onChange={(e) => updateField('cuit', e.target.value)}
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
            <div>
              <Label>Actividad Principal *</Label>
              <Select value={formData.activity} onValueChange={(v: any) => updateField('activity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITIES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Provincia (IIBB) *</Label>
              <Select value={formData.province_code} onValueChange={(v) => updateField('province_code', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Condiciones Especiales</h3>

          <div className="flex items-center justify-between">
            <div>
              <Label>Trabaja en Relación de Dependencia</Label>
              <p className="text-xs text-gray-500">No paga jubilatorio ni obra social</p>
            </div>
            <Switch checked={formData.works_in_rd} onCheckedChange={(v) => updateField('works_in_rd', v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Es Jubilado</Label>
              <p className="text-xs text-gray-500">Paga jubilatorio mínimo</p>
            </div>
            <Switch
              checked={formData.is_retired}
              onCheckedChange={(v) => updateField('is_retired', v)}
              disabled={formData.works_in_rd}
            />
          </div>

          <div>
            <Label htmlFor="dependents">Adherentes Obra Social (0-6)</Label>
            <Input
              id="dependents"
              type="number"
              min={0}
              max={6}
              value={formData.dependents}
              onChange={(e) => updateField('dependents', parseInt(e.target.value) || 0)}
              disabled={formData.works_in_rd}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Parámetros Físicos (opcionales)</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="local_m2">M² Local</Label>
              <Input
                id="local_m2"
                type="number"
                value={formData.local_m2 || ''}
                onChange={(e) => updateField('local_m2', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            <div>
              <Label htmlFor="annual_rent">Alquiler Anual ($)</Label>
              <Input
                id="annual_rent"
                type="number"
                step="0.01"
                value={formData.annual_rent || ''}
                onChange={(e) => updateField('annual_rent', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
            <div>
              <Label htmlFor="annual_mw">MW Anual</Label>
              <Input
                id="annual_mw"
                type="number"
                value={formData.annual_mw || ''}
                onChange={(e) => updateField('annual_mw', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">Categoría Anterior (Reca previa)</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría Anterior</Label>
              <Select value={formData.previous_category || '__none__'} onValueChange={(v) => updateField('previous_category', v === '__none__' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sin datos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin datos</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>Categoría {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="previous_fee">Cuota Anterior ($)</Label>
              <Input
                id="previous_fee"
                type="number"
                step="0.01"
                value={formData.previous_fee || ''}
                onChange={(e) => updateField('previous_fee', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="button" variant="outline" asChild>
          <a href="/studio/clients"><ArrowLeft className="h-4 w-4 mr-2" />Volver</a>
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4 mr-2" />{loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
