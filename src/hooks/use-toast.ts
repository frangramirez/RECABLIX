/**
 * Hook useToast - Wrapper sobre Sonner
 *
 * Provee una API compatible con los EPICs mientras usa
 * Sonner como backend de notificaciones.
 */

import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

function toast(options: ToastOptions) {
  const { title, description, variant = 'default', duration = 4000 } = options

  const message = title || description || ''
  const opts = {
    description: title ? description : undefined,
    duration,
  }

  switch (variant) {
    case 'destructive':
      sonnerToast.error(message, opts)
      break
    case 'success':
      sonnerToast.success(message, opts)
      break
    default:
      sonnerToast(message, opts)
  }
}

export function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
  }
}

// Re-export para uso directo
export { toast }
