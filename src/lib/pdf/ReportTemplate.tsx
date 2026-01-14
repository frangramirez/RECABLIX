import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { RecategorizationResult } from '@/lib/calculations'

interface Scale {
  category: string
  max_annual_income: number
}

interface ClientInfo {
  name: string
  cuit: string | null
  activity: string
  provinceCode: string
  worksInRD: boolean
  isRetired: boolean
  localM2: number | null
  annualRent: number | null
  annualMW: number | null
}

interface Props {
  client: ClientInfo
  result: RecategorizationResult
  scales: Scale[]
  recaCode: string
  recaYear: number
  recaSemester: number
  studioName: string
  periodSales: number
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const formatNumber = (n: number) => new Intl.NumberFormat('es-AR').format(n)

const ACTIVITY_LABELS: Record<string, string> = {
  BIENES: 'Venta de Bienes',
  SERVICIOS: 'Prestacion de Servicios',
  LOCACION: 'Locacion',
  SOLO_LOC_2_INM: 'Solo Locacion (<=2 inm)',
}

const PROVINCE_NAMES: Record<string, string> = {
  '901': 'CABA',
  '902': 'Buenos Aires',
  '903': 'Catamarca',
  '904': 'Cordoba',
  '905': 'Corrientes',
  '906': 'Chaco',
  '907': 'Chubut',
  '908': 'Entre Rios',
  '909': 'Formosa',
  '910': 'Jujuy',
  '911': 'La Pampa',
  '912': 'La Rioja',
  '913': 'Mendoza',
  '914': 'Misiones',
  '915': 'Neuquen',
  '916': 'Rio Negro',
  '917': 'Salta',
  '918': 'San Juan',
  '919': 'San Luis',
  '920': 'Santa Cruz',
  '921': 'Santa Fe',
  '922': 'Sgo del Estero',
  '923': 'T del Fuego',
  '924': 'Tucuman',
}

export function ReportTemplate({
  client,
  result,
  scales,
  recaCode,
  recaYear,
  recaSemester,
  studioName,
  periodSales
}: Props) {
  const currentCategory = result.category.finalCategory
  const currentScale = scales.find(s => s.category === currentCategory)
  const disponible = currentScale ? currentScale.max_annual_income - periodSales : 0
  const promedioMensual = disponible > 0 ? disponible / 6 : 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>{studioName}</Text>
          <Text style={{ fontSize: 8, color: '#6B7280' }}>
            Generado por RECABLIX
          </Text>
        </View>

        {/* Titulo */}
        <Text style={styles.title}>
          MONOTRIBUTO: {recaSemester}o RECATEGORIZACION ANO {recaYear}
        </Text>

        {/* Datos del contribuyente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL CONTRIBUYENTE</Text>
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Nombre:</Text>
                <Text style={styles.value}>{client.name}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>CUIT:</Text>
                <Text style={styles.value}>{client.cuit || '-'}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Actividad:</Text>
                <Text style={styles.value}>{ACTIVITY_LABELS[client.activity] || client.activity}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Provincia IIBB:</Text>
                <Text style={styles.value}>{PROVINCE_NAMES[client.provinceCode] || client.provinceCode}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Trabaja en RD:</Text>
                <Text style={styles.value}>{client.worksInRD ? 'Si' : 'No'}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Jubilado:</Text>
                <Text style={styles.value}>{client.isRetired ? 'Si' : 'No'}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>M2 Local:</Text>
                <Text style={styles.value}>{client.localM2 || 0}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.row}>
                <Text style={styles.label}>Alquiler Anual:</Text>
                <Text style={styles.value}>{client.annualRent ? formatARS(client.annualRent) : '$0'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nueva categoria y cuota */}
        <View style={styles.bigBox}>
          <View style={styles.bigBoxItem}>
            <Text style={styles.bigLabel}>CATEGORIA DETERMINADA</Text>
            <Text style={styles.bigValue}>{result.category.finalCategory}</Text>
          </View>
          <View style={styles.bigBoxItem}>
            <Text style={styles.bigLabel}>CUOTA MENSUAL</Text>
            <Text style={styles.bigValue}>{formatARS(result.totalFee)}</Text>
          </View>
        </View>

        {/* Tabla Facturando hasta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FACTURANDO HASTA - LIMITES POR CATEGORIA</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 0.5 }]}>Cat</Text>
              <Text style={styles.tableCell}>Tope Anual</Text>
              <Text style={styles.tableCell}>Facturado</Text>
              <Text style={styles.tableCell}>Disponible</Text>
              <Text style={styles.tableCell}>Prom/Mes</Text>
            </View>
            {scales.map((scale) => {
              const isCurrentCat = scale.category === currentCategory
              const catDisponible = scale.max_annual_income - periodSales
              const catPromedio = catDisponible > 0 ? catDisponible / 6 : 0

              return (
                <View key={scale.category} style={[styles.tableRow, isCurrentCat && styles.tableRowHighlight]}>
                  <Text style={[styles.tableCell, { flex: 0.5, fontWeight: isCurrentCat ? 'bold' : 'normal' }]}>
                    {scale.category}
                  </Text>
                  <Text style={styles.tableCell}>{formatNumber(scale.max_annual_income)}</Text>
                  <Text style={styles.tableCell}>{formatNumber(periodSales)}</Text>
                  <Text style={[styles.tableCell, { color: catDisponible < 0 ? '#DC2626' : '#000' }]}>
                    {formatNumber(Math.max(0, catDisponible))}
                  </Text>
                  <Text style={styles.tableCell}>
                    {catDisponible > 0 ? formatNumber(Math.round(catPromedio)) : '-'}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Desglose cuota */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESGLOSE DE CUOTA MENSUAL</Text>
          {result.feeComponents.components.filter(c => c.applied).map((comp, idx) => (
            <View key={idx} style={styles.row}>
              <Text style={styles.label}>{comp.description}:</Text>
              <Text style={styles.value}>{formatARS(comp.value)}</Text>
            </View>
          ))}
          <View style={[styles.row, { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
            <Text style={[styles.label, { fontWeight: 'bold' }]}>TOTAL:</Text>
            <Text style={[styles.value, { fontWeight: 'bold' }]}>{formatARS(result.totalFee)}</Text>
          </View>
        </View>

        {/* Comparacion */}
        {result.comparison.previousFee && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>COMPARACION CON PERIODO ANTERIOR</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Categoria anterior:</Text>
              <Text style={styles.value}>{result.comparison.previousCategory || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cuota anterior:</Text>
              <Text style={styles.value}>{formatARS(result.comparison.previousFee)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Diferencia:</Text>
              <Text style={[styles.value, { color: result.comparison.feeChange > 0 ? '#DC2626' : '#16A34A' }]}>
                {result.comparison.feeChange > 0 ? '+' : ''}{formatARS(result.comparison.feeChange)}
                {' '}({result.comparison.feeChangePercent?.toFixed(1)}%)
              </Text>
            </View>
          </View>
        )}

        {/* Placeholder deuda */}
        <View style={styles.placeholder}>
          <Text>SECCION DEUDAS - EN DESARROLLO</Text>
          <Text style={{ fontSize: 8, marginTop: 5 }}>
            Esta seccion mostrara deudas por periodo y estado de cuenta
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Documento generado el {new Date().toLocaleDateString('es-AR')} |
          Periodo RECA {recaCode} | {studioName}
        </Text>
      </Page>
    </Document>
  )
}
