import { useState, useEffect } from 'react'
import { useSession } from '@/components/providers/SessionProvider'
import { useTenantSupabase } from '@/hooks/useTenantSupabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Save, ArrowLeft } from 'lucide-react'
import { validateCUIT, formatCUITInput } from '@/lib/validation/cuit'

interface ClientData {
  id?: string
  name: string
  cuit: string | null
  uses_recablix: boolean
  activity: 'BIENES' | 'SERVICIOS' | 'LOCACION' | 'SOLO_LOC_2_INM'
  province_code: string
  works_in_rd: boolean
  is_retired: boolean
  dependents: number
  // Nuevos campos tributarios
  is_exempt: boolean
  has_multilateral: boolean
  // Nuevos campos de local
  has_local: boolean
  rents_local: boolean
  lessor_cuit: string | null
  // Parámetros físicos
  local_m2: number | null
  annual_rent: number | null
  annual_mw: number | null
  previous_category: string | null
  previous_fee: number | null
}

interface Props {
  initialData?: ClientData
  studioId: string
  schemaName?: string
  returnUrl?: string
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

export function ClientForm({ initialData, studioId, schemaName, returnUrl = '/studio/clients' }: Props) {
  const [loading, setLoading] = useState(false)
  const [cuitError, setCuitError] = useState<string | null>(null)
  const [lessorCuitError, setLessorCuitError] = useState<string | null>(null)

  // Tenant queries - usar props si están disponibles, sino session
  const session = useSession()
  const tenantContext = schemaName
    ? { studioId, schemaName }
    : session.studio
      ? { studioId: session.studio.id, schemaName: session.studio.schema_name }
      : null
  const { query } = useTenantSupabase(tenantContext)

  const [formData, setFormData] = useState<ClientData>({
    name: initialData?.name || '',
    cuit: initialData?.cuit || null,
    uses_recablix: initialData?.uses_recablix ?? true, // Por defecto activo para nuevos clientes
    activity: initialData?.activity || 'SERVICIOS',
    province_code: initialData?.province_code || '901',
    works_in_rd: initialData?.works_in_rd || false,
    is_retired: initialData?.is_retired || false,
    dependents: initialData?.dependents || 0,
    is_exempt: initialData?.is_exempt || false,
    has_multilateral: initialData?.has_multilateral || false,
    has_local: initialData?.has_local || false,
    rents_local: initialData?.rents_local || false,
    lessor_cuit: initialData?.lessor_cuit || null,
    local_m2: initialData?.local_m2 || null,
    annual_rent: initialData?.annual_rent || null,
    annual_mw: initialData?.annual_mw || null,
    previous_category: initialData?.previous_category || null,
    previous_fee: initialData?.previous_fee || null,
  })
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validar CUIT antes de enviar
    if (formData.cuit) {
      const cuitValidation = validateCUIT(formData.cuit)
      if (!cuitValidation.valid) {
        toast({ variant: 'destructive', title: 'Error', description: cuitValidation.error })
        return
      }
    }

    // Validar CUIT del locador si alquila
    if (formData.rents_local && !formData.lessor_cuit) {
      toast({ variant: 'destructive', title: 'Error', description: 'CUIT del locador es obligatorio cuando alquilas el local' })
      return
    }

    if (formData.rents_local && formData.lessor_cuit) {
      const lessorCuitValidation = validateCUIT(formData.lessor_cuit)
      if (!lessorCuitValidation.valid) {
        toast({ variant: 'destructive', title: 'Error', description: `CUIT locador: ${lessorCuitValidation.error}` })
        return
      }
    }

    setLoading(true)

    try {
      if (initialData?.id) {
        // UPDATE: actualizar clients y reca_client_data
        // Primero obtenemos el array apps actual
        const { data: currentClient } = await query('clients')
          .select('apps')
          .eq('id', initialData.id)
          .single()

        let currentApps: string[] = (currentClient?.apps as string[]) || []

        // Actualizar array apps según el switch
        if (formData.uses_recablix && !currentApps.includes('recablix')) {
          currentApps = [...currentApps, 'recablix']
        } else if (!formData.uses_recablix && currentApps.includes('recablix')) {
          currentApps = currentApps.filter(app => app !== 'recablix')
        }

        const { error: clientError } = await query('clients')
          .update({
            name: formData.name,
            cuit: formData.cuit?.trim() || null,
            apps: currentApps,
          })
          .eq('id', initialData.id)

        if (clientError) throw clientError

        const { error: recaError } = await query('reca_client_data')
          .upsert({
            client_id: initialData.id,
            activity: formData.activity,
            province_code: formData.province_code,
            works_in_rd: formData.works_in_rd,
            is_retired: formData.is_retired,
            dependents: formData.dependents,
            is_exempt: formData.is_exempt,
            has_multilateral: formData.has_multilateral,
            has_local: formData.has_local,
            rents_local: formData.rents_local,
            lessor_cuit: formData.lessor_cuit?.trim() || null,
            local_m2: formData.local_m2,
            annual_rent: formData.annual_rent,
            annual_mw: formData.annual_mw,
            previous_category: formData.previous_category,
            previous_fee: formData.previous_fee,
          })

        if (recaError) throw recaError

        toast({ title: 'Actualizado', description: 'Cliente actualizado correctamente' })
      } else {
        // CREATE: usar endpoint API que bypasea RLS con supabaseAdmin
        // Necesario porque auth.uid() puede ser NULL en sesiones de superadmin/impersonación
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            cuit: formData.cuit,
            uses_recablix: formData.uses_recablix,
            activity: formData.activity,
            province_code: formData.province_code,
            works_in_rd: formData.works_in_rd,
            is_retired: formData.is_retired,
            dependents: formData.dependents,
            is_exempt: formData.is_exempt,
            has_multilateral: formData.has_multilateral,
            has_local: formData.has_local,
            rents_local: formData.rents_local,
            lessor_cuit: formData.lessor_cuit,
            local_m2: formData.local_m2,
            annual_rent: formData.annual_rent,
            annual_mw: formData.annual_mw,
            previous_category: formData.previous_category,
            previous_fee: formData.previous_fee,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear cliente')
        }

        toast({ title: 'Creado', description: 'Cliente creado correctamente' })
      }

      window.location.href = returnUrl
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

          {/* Switch para habilitar recategorización */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <Label className="text-blue-900">Incluir en Recategorización</Label>
              <p className="text-xs text-blue-700">Este cliente aparecerá en el panel de recategorización</p>
            </div>
            <Switch
              checked={formData.uses_recablix}
              onCheckedChange={(v) => updateField('uses_recablix', v)}
            />
          </div>

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
                onChange={(e) => {
                  const formatted = formatCUITInput(e.target.value)
                  updateField('cuit', formatted)
                  const validation = validateCUIT(formatted)
                  setCuitError(validation.error || null)
                }}
                placeholder="XX-XXXXXXXX-X"
                maxLength={13}
                className={cuitError ? 'border-destructive' : ''}
              />
              {cuitError && (
                <p className="text-xs text-destructive mt-1">{cuitError}</p>
              )}
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

            {/* Nuevos switches para exención y convenio multilateral */}
            <div className="col-span-2 space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>¿Es exento de impuestos?</Label>
                  <p className="text-xs text-gray-500">Cliente exento de ciertos impuestos provinciales</p>
                </div>
                <Switch
                  checked={formData.is_exempt}
                  onCheckedChange={(v) => updateField('is_exempt', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>¿Inscripto en Convenio Multilateral?</Label>
                  <p className="text-xs text-gray-500">Sujeto a CM para IIBB</p>
                </div>
                <Switch
                  checked={formData.has_multilateral}
                  onCheckedChange={(v) => updateField('has_multilateral', v)}
                />
              </div>
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
          <h3 className="font-semibold">Parámetros Físicos</h3>

          {/* Switch: ¿Tiene local? */}
          <div className="flex items-center justify-between">
            <div>
              <Label>¿Tenés local o establecimiento?</Label>
              <p className="text-xs text-gray-500">Local comercial o establecimiento</p>
            </div>
            <Switch
              checked={formData.has_local}
              onCheckedChange={(v) => {
                updateField('has_local', v)
                if (!v) {
                  // Si desactiva, limpiar todos los campos relacionados
                  updateField('local_m2', null)
                  updateField('annual_mw', null)
                  updateField('rents_local', false)
                  updateField('annual_rent', null)
                  updateField('lessor_cuit', null)
                  setLessorCuitError(null)
                }
              }}
            />
          </div>

          {/* Campos condicionales si tiene local */}
          {formData.has_local && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="local_m2">M² Local</Label>
                  <Input
                    id="local_m2"
                    type="number"
                    value={formData.local_m2 || ''}
                    onChange={(e) => updateField('local_m2', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Ej: 50"
                  />
                </div>
                <div>
                  <Label htmlFor="annual_mw">MW Anual</Label>
                  <Input
                    id="annual_mw"
                    type="number"
                    value={formData.annual_mw || ''}
                    onChange={(e) => updateField('annual_mw', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Ej: 5000"
                  />
                </div>
              </div>

              {/* Switch: ¿Alquila? */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label>¿Lo alquilás?</Label>
                  <p className="text-xs text-gray-500">Sos locatario del local</p>
                </div>
                <Switch
                  checked={formData.rents_local}
                  onCheckedChange={(v) => {
                    updateField('rents_local', v)
                    if (!v) {
                      updateField('annual_rent', null)
                      updateField('lessor_cuit', null)
                      setLessorCuitError(null)
                    }
                  }}
                />
              </div>

              {/* Campos condicionales si alquila */}
              {formData.rents_local && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="annual_rent">Alquiler Anual ($) *</Label>
                    <Input
                      id="annual_rent"
                      type="number"
                      step="0.01"
                      value={formData.annual_rent || ''}
                      onChange={(e) => updateField('annual_rent', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Ej: 1200000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lessor_cuit">CUIT Locador *</Label>
                    <Input
                      id="lessor_cuit"
                      value={formData.lessor_cuit || ''}
                      onChange={(e) => {
                        const formatted = formatCUITInput(e.target.value)
                        updateField('lessor_cuit', formatted)
                        const validation = validateCUIT(formatted)
                        setLessorCuitError(validation.error || null)
                      }}
                      placeholder="XX-XXXXXXXX-X"
                      maxLength={13}
                      className={lessorCuitError ? 'border-destructive' : ''}
                      required
                    />
                    {lessorCuitError && (
                      <p className="text-xs text-destructive mt-1">{lessorCuitError}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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
          <a href={returnUrl}><ArrowLeft className="h-4 w-4 mr-2" />Volver</a>
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4 mr-2" />{loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
