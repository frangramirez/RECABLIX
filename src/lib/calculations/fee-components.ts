/**
 * Motor de Cálculo - Componentes de Cuota
 *
 * Calcula cada componente de la cuota de monotributo según
 * las reglas especiales del contribuyente:
 *
 * | Componente     | Código   | Regla                                          |
 * |----------------|----------|------------------------------------------------|
 * | Impositivo     | B20/S20  | BIENES→B20, SERVICIOS/LOCACION→S20, SOLO_LOC→0 |
 * | Jubilatorio    | 021/21J  | RD=SI→0, JUBILADO=SI→21J(mínimo), else→021     |
 * | Obra Social    | 024      | RD=SI→0, else→024 × (1 + adherentes)           |
 * | Provincial     | 9XX      | Según province_code del cliente                |
 * | Municipal      | 9XXM     | Si has_municipal=true para esa provincia       |
 */

export type ClientActivity = 'BIENES' | 'SERVICIOS' | 'LOCACION' | 'SOLO_LOC_2_INM'
export type FeeComponentType = 'IMP' | 'JUB' | 'OS' | 'IBP'

export interface FeeInput {
  category: string
  activity: ClientActivity
  provinceCode: string
  worksInRD: boolean
  isRetired: boolean
  dependents: number
}

export interface FeeComponentData {
  component_code: string
  description: string
  component_type: FeeComponentType
  category: string
  value: number
  province_code?: string | null
  has_municipal?: boolean
}

export interface FeeComponent {
  code: string
  description: string
  type: FeeComponentType
  value: number
  applied: boolean
  reason?: string
}

export interface FeeComponentsResult {
  components: FeeComponent[]
  subtotals: {
    impositivo: number
    jubilatorio: number
    obraSocial: number
    provincial: number
    municipal: number
  }
}

/**
 * Determina el código del componente impositivo según la actividad.
 * - BIENES → B20
 * - SERVICIOS/LOCACION → S20
 * - SOLO_LOC_2_INM → null (no paga componente impositivo)
 */
function getImpComponentCode(activity: ClientActivity): string | null {
  switch (activity) {
    case 'BIENES':
      return 'B20'
    case 'SERVICIOS':
    case 'LOCACION':
      return 'S20'
    case 'SOLO_LOC_2_INM':
      return null
  }
}

/**
 * Calcula los componentes de cuota basándose en los datos
 * de componentes y las condiciones del cliente.
 *
 * Esta es la función PURA que puede usarse sin conexión a BD.
 */
export function calculateFeeComponentsFromData(
  allComponents: FeeComponentData[],
  input: FeeInput
): FeeComponentsResult {
  const components: FeeComponent[] = []
  const subtotals = {
    impositivo: 0,
    jubilatorio: 0,
    obraSocial: 0,
    provincial: 0,
    municipal: 0
  }

  // Filtrar componentes por categoría
  const categoryComponents = allComponents.filter(c => c.category === input.category)

  // ────────────────────────────────────────────────────────────
  // 1. COMPONENTE IMPOSITIVO (IMP)
  // ────────────────────────────────────────────────────────────
  const impCode = getImpComponentCode(input.activity)

  if (impCode) {
    const comp = categoryComponents.find(c => c.component_code === impCode)
    if (comp) {
      subtotals.impositivo = Number(comp.value)
      components.push({
        code: impCode,
        description: comp.description,
        type: 'IMP',
        value: subtotals.impositivo,
        applied: true
      })
    }
  } else {
    // SOLO_LOC_2_INM no paga componente impositivo
    components.push({
      code: 'IMP',
      description: 'Componente Impositivo',
      type: 'IMP',
      value: 0,
      applied: false,
      reason: 'Locador ≤2 inmuebles'
    })
  }

  // ────────────────────────────────────────────────────────────
  // 2. COMPONENTE JUBILATORIO (JUB)
  // ────────────────────────────────────────────────────────────
  const noJub = input.worksInRD || input.activity === 'SOLO_LOC_2_INM'

  if (noJub) {
    // No paga jubilatorio si trabaja en RD o es solo locador
    components.push({
      code: 'JUB',
      description: 'Jubilatorio',
      type: 'JUB',
      value: 0,
      applied: false,
      reason: input.worksInRD ? 'Trabaja en Relación de Dependencia' : 'Solo locación ≤2 inmuebles'
    })
  } else if (input.isRetired) {
    // 21J: SIEMPRE usa valor de 021 Cat. A (no depende de categoría del cliente)
    // Buscar en todos los componentes, no solo los de la categoría del cliente
    const comp021CatA = allComponents.find(
      c => c.component_code === '021' && c.category === 'A'
    )
    if (comp021CatA) {
      subtotals.jubilatorio = Number(comp021CatA.value)
      components.push({
        code: '21J',
        description: 'Jubilatorio (aporte mínimo)',
        type: 'JUB',
        value: subtotals.jubilatorio,
        applied: true
      })
    }
  } else {
    // Aporta normalmente (código 021)
    const comp = categoryComponents.find(c => c.component_code === '021')
    if (comp) {
      subtotals.jubilatorio = Number(comp.value)
      components.push({
        code: '021',
        description: 'Jubilatorio',
        type: 'JUB',
        value: subtotals.jubilatorio,
        applied: true
      })
    }
  }

  // ────────────────────────────────────────────────────────────
  // 3. COMPONENTE OBRA SOCIAL (OS)
  // ────────────────────────────────────────────────────────────
  const noOS = input.worksInRD || input.activity === 'SOLO_LOC_2_INM'

  if (noOS) {
    components.push({
      code: 'OS',
      description: 'Obra Social',
      type: 'OS',
      value: 0,
      applied: false,
      reason: input.worksInRD ? 'Trabaja en Relación de Dependencia' : 'Solo locación ≤2 inmuebles'
    })
  } else {
    const comp = categoryComponents.find(c => c.component_code === '024')
    if (comp) {
      // Multiplicar por (1 + adherentes) para incluir grupo familiar
      const multiplier = 1 + input.dependents
      subtotals.obraSocial = Number(comp.value) * multiplier
      components.push({
        code: '024',
        description: `Obra Social${multiplier > 1 ? ` (×${multiplier} por ${input.dependents} adherente${input.dependents > 1 ? 's' : ''})` : ''}`,
        type: 'OS',
        value: subtotals.obraSocial,
        applied: true
      })
    }
  }

  // ────────────────────────────────────────────────────────────
  // 4. COMPONENTE PROVINCIAL (IIBB - IBP)
  // ────────────────────────────────────────────────────────────
  const provComponent = allComponents.find(
    c => c.component_type === 'IBP' &&
         c.province_code === input.provinceCode &&
         c.category === input.category
  )

  if (provComponent) {
    subtotals.provincial = Number(provComponent.value)
    components.push({
      code: provComponent.component_code,
      description: provComponent.description,
      type: 'IBP',
      value: subtotals.provincial,
      applied: true
    })

    // ────────────────────────────────────────────────────────────
    // 5. COMPONENTE MUNICIPAL (si aplica)
    // ────────────────────────────────────────────────────────────
    if (provComponent.has_municipal) {
      const munCode = `${input.provinceCode}M`
      const munComponent = allComponents.find(
        c => c.component_code === munCode && c.category === input.category
      )

      if (munComponent) {
        subtotals.municipal = Number(munComponent.value)
        components.push({
          code: munCode,
          description: `${provComponent.description} Municipal`,
          type: 'IBP',
          value: subtotals.municipal,
          applied: true
        })
      }
    }
  }

  return { components, subtotals }
}
