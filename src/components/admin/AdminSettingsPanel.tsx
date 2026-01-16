import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminUsersManager } from './AdminUsersManager'
import { StudiosLimitsManager } from './StudiosLimitsManager'

/**
 * Panel de configuración del sistema (SuperAdmin only)
 *
 * Tabs:
 * - Usuarios: Gestión global de usuarios e invitaciones
 * - Límites Studios: Configuración de límites de subscripción por studio
 */
export function AdminSettingsPanel() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="users">Usuarios</TabsTrigger>
        <TabsTrigger value="limits">Límites Studios</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="mt-6">
        <AdminUsersManager />
      </TabsContent>

      <TabsContent value="limits" className="mt-6">
        <StudiosLimitsManager />
      </TabsContent>
    </Tabs>
  )
}
