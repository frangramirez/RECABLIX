/**
 * ReportsViewWithStudio - Vista de reportes con contexto explícito
 *
 * Muestra los reportes disponibles para un estudio específico
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, Users, FileBarChart } from 'lucide-react'

interface Props {
  studioId: string
  schemaName: string
}

export function ReportsViewWithStudio({ studioId, schemaName }: Props) {
  const basePath = `/admin/my-studios/${studioId}`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* PDF Individual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            Reporte Individual
          </CardTitle>
          <CardDescription>
            Genera un PDF con el detalle de recategorización para un cliente específico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Selecciona un cliente desde la pantalla de Recategorización y haz clic en el ícono de PDF.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <a href={`${basePath}/recategorization`}>
              <FileBarChart className="w-4 h-4 mr-2" />
              Ir a Recategorización
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* PDF Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Reportes Masivos (ZIP)
          </CardTitle>
          <CardDescription>
            Genera un archivo ZIP con los PDFs de todos los clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Desde Recategorización, usa el botón "Generar PDFs" para descargar un ZIP con todos los reportes.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <a href={`${basePath}/recategorization`}>
              <Download className="w-4 h-4 mr-2" />
              Ir a Recategorización
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Excel Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-green-500" />
            Exportar a Excel
          </CardTitle>
          <CardDescription>
            Descarga un archivo Excel con el resumen de recategorizaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Exporta la tabla de recategorización completa a un archivo Excel.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <a href={`${basePath}/recategorization`}>
              <FileBarChart className="w-4 h-4 mr-2" />
              Ir a Recategorización
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Listado de Clientes
          </CardTitle>
          <CardDescription>
            Exporta el listado de todos los clientes a Excel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Desde Clientes, usa el botón "Exportar" para descargar un Excel con todos los datos.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <a href={`${basePath}/clients`}>
              <Users className="w-4 h-4 mr-2" />
              Ir a Clientes
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="md:col-span-2 border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Sobre los reportes</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Los reportes de recategorización incluyen el desglose completo de la cuota mensual:
                componente impositivo, jubilatorio, obra social e IIBB provincial.
                También muestran la comparativa con la categoría anterior y el porcentaje de variación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
