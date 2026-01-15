/**
 * StudioLayoutWrapper - Wrapper para páginas de studio
 *
 * Incluye el banner de impersonación si está activo
 */

import type { ReactNode } from 'react'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'

interface StudioLayoutWrapperProps {
  children: ReactNode
  isImpersonating?: boolean
  studioName?: string
}

export function StudioLayoutWrapper({
  children,
  isImpersonating,
  studioName,
}: StudioLayoutWrapperProps) {
  return (
    <>
      {isImpersonating && studioName && (
        <ImpersonationBanner studioName={studioName} />
      )}
      <div className={isImpersonating ? 'pt-12' : ''}>
        {children}
      </div>
    </>
  )
}
