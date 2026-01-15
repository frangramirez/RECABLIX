import { createContext, useContext, type ReactNode } from 'react'

interface TenantContextValue {
  studioId: string
  schemaName: string
  studioName: string
  isSuperadmin: boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

interface TenantProviderProps {
  children: ReactNode
  value: TenantContextValue
}

/**
 * Provider que inyecta información del tenant actual a componentes hijos
 *
 * @example
 * <TenantProvider value={{
 *   studioId: studio.id,
 *   schemaName: studio.schema_name,
 *   studioName: studio.name,
 *   isSuperadmin: studio.is_superadmin,
 * }}>
 *   <MyComponent />
 * </TenantProvider>
 */
export function TenantProvider({ children, value }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

/**
 * Hook para obtener el contexto del tenant actual
 * Lanza error si se usa fuera de TenantProvider
 *
 * @example
 * const { studioId, schemaName } = useTenant()
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}

/**
 * Hook para obtener el contexto del tenant de forma opcional
 * Retorna null si se usa fuera de TenantProvider
 *
 * @example
 * const tenant = useTenantOptional()
 * if (tenant) {
 *   // Usar tenant
 * }
 */
export function useTenantOptional(): TenantContextValue | null {
  return useContext(TenantContext)
}
