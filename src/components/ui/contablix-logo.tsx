import { cn } from '@/lib/utils'

interface ContablixIconProps {
  className?: string
  size?: number
}

/**
 * Isotipo CX de Contablix (solo el símbolo)
 * Uso: Favicon inline, espacios muy reducidos
 */
export function ContablixIcon({ className, size = 32 }: ContablixIconProps) {
  return (
    <img
      src="/logo-isotipo.png"
      alt="Contablix"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}

interface ContablixLogoProps {
  className?: string
  height?: number
}

/**
 * Logotipo completo "contablix" en azul con acento verde
 * Uso: Sidebars, headers, páginas de marketing
 */
export function ContablixLogo({ className, height = 24 }: ContablixLogoProps) {
  // Aspect ratio aproximado del logotipo: 5:1 (basado en imagen real)
  const width = height * 5

  return (
    <img
      src="/logo-contablix.png"
      alt="Contablix"
      width={width}
      height={height}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}

/**
 * Isotipo CX con fondo blanco (para usar donde se necesite el icono con fondo)
 */
export function ContablixIconWithBg({ className, size = 32 }: ContablixIconProps) {
  return (
    <div
      className={cn('shrink-0 bg-white rounded-lg flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo-isotipo.png"
        alt="Contablix"
        width={size * 0.75}
        height={size * 0.75}
        className="object-contain"
      />
    </div>
  )
}
