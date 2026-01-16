/**
 * RecategorizationViewWithStudio - Vista de recategorización con contexto explícito
 *
 * Wrapper que obtiene el período activo y renderiza la vista de recategorización
 * usando un studioId específico en lugar de depender de la sesión
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecategorizationView } from '@/components/studio/RecategorizationView'

interface Props {
  studioId: string
  schemaName: string
}

interface ActivePeriod {
  id: string
  code: string
  sales_period_start: string
  sales_period_end: string
}

export function RecategorizationViewWithStudio({ studioId, schemaName }: Props) {
  const [activePeriod, setActivePeriod] = useState<ActivePeriod | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivePeriod()
  }, [])

  const fetchActivePeriod = async () => {
    try {
      setLoading(true)
      setError(null)

      // Obtener período activo desde la API pública
      const { data, error: fetchError } = await supabase
        .from('reca_periods')
        .select('id, code, sales_period_start, sales_period_end')
        .eq('is_active', true)
        .single()

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      if (!data) {
        throw new Error('No hay período activo configurado')
      }

      setActivePeriod(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Cargando período activo...</span>
      </div>
    )
  }

  if (error || !activePeriod) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium mb-2">
          {error || 'No hay período activo'}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Configura un período de recategorización activo desde el Panel Admin
        </p>
        <Button variant="outline" onClick={fetchActivePeriod}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    )
  }

  // Renderizar la vista de recategorización con el período activo
  // Nota: RecategorizationView ya usa useTenantSupabase con useSession internamente
  // pero aquí forzamos el contexto pasando studioId
  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Período activo: <span className="font-semibold text-foreground">{activePeriod.code}</span>
          {' '}| Ventas: {activePeriod.sales_period_start} - {activePeriod.sales_period_end}
        </p>
      </div>

      <RecategorizationView
        studioId={studioId}
        recaId={activePeriod.id}
        recaCode={activePeriod.code}
        salesPeriodStart={activePeriod.sales_period_start}
        salesPeriodEnd={activePeriod.sales_period_end}
      />
    </div>
  )
}
