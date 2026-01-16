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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="Contablix"
    >
      <path
        d="M12 32c0-11 8-20 19-20 5 0 9 1.5 12 4l-6.5 8c-1.5-1.5-3.5-2.5-5.5-2.5-6 0-9 4.5-9 10.5s3 10.5 9 10.5c2 0 4-1 5.5-2.5l6.5 8c-3 2.5-7 4-12 4-11 0-19-9-19-20z"
        fill="#14315d"
      />
      <path
        d="M32 24l7-10h10l-12 16 12 16h-10l-7-10-7 10h-10l12-16-12-16h10l7 10z"
        fill="#14315d"
      />
      <polygon points="44,14 56,14 52,20 40,20" fill="#00b67a" />
    </svg>
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
  // Aspect ratio aproximado del logotipo: 5.5:1
  const width = height * 5.5

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 40"
      fill="none"
      width={width}
      height={height}
      className={cn('shrink-0', className)}
      aria-label="Contablix"
    >
      {/* c */}
      <path
        d="M0 20c0-11 7-20 18-20 4 0 8 1.5 11 4.5L24 11c-1.5-1.5-3.5-2.5-6-2.5-5 0-8 4.5-8 11.5s3 11.5 8 11.5c2.5 0 4.5-1 6-2.5l5 6.5c-3 3-7 4.5-11 4.5-11 0-18-9-18-20z"
        fill="#14315d"
      />
      {/* o */}
      <path
        d="M32 20c0-11 7-20 17-20s17 9 17 20-7 20-17 20-17-9-17-20zm25 0c0-7-3.5-11.5-8-11.5S41 13 41 20s3.5 11.5 8 11.5 8-4.5 8-11.5z"
        fill="#14315d"
      />
      {/* n */}
      <path
        d="M70 1h9v7c2-5 7-8 13-8 9 0 14 6 14 16v23h-9V18c0-6-3-9-8-9-6 0-10 4-10 12v18h-9V1z"
        fill="#14315d"
      />
      {/* t */}
      <path
        d="M112 9V1h9v8h8v8h-8v15c0 3 1.5 4.5 4.5 4.5h3.5v8c-1.5.5-4 .5-6 .5-8 0-11-4-11-13V17h-6V9h6z"
        fill="#14315d"
      />
      {/* a */}
      <path
        d="M134 29c0-7 6-11 15-12l7-.5v-1c0-4-2.5-6.5-7-6.5-4 0-6.5 2-7 5h-9c.5-8 7-14 17-14 10 0 16 6 16 16v23h-9v-5c-2.5 4-7 6.5-12 6.5-8 0-11-4.5-11-11zm22-3v-3l-7 .5c-5 .5-7 2-7 5s2 4.5 6 4.5c6 0 8-3 8-7z"
        fill="#14315d"
      />
      {/* b */}
      <path
        d="M166 1h9v9c2.5-4 7-7.5 13-7.5 10 0 17 8.5 17 20s-7 20-17 20c-6 0-10.5-3-13-7v6h-9V1zm19 30.5c5 0 8.5-4 8.5-11.5s-3.5-11.5-8.5-11.5-8.5 4-8.5 11.5 3.5 11.5 8.5 11.5z"
        fill="#14315d"
      />
      {/* l */}
      <path d="M209 1h9v38h-9V1z" fill="#14315d" />
      {/* i + acento verde */}
      <path d="M220 9h-9v30h9V9z" fill="#14315d" />
      <rect x="211" y="0" width="9" height="6" fill="#14315d" />
      {/* Acento verde sobre la i */}
      <polygon points="220,0 226,0 224,4 218,4" fill="#00b67a" />
      {/* x - simplificada como parte del diseño */}
    </svg>
  )
}

/**
 * Isotipo CX con fondo blanco (para usar donde se necesite el icono con fondo)
 */
export function ContablixIconWithBg({ className, size = 32 }: ContablixIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-label="Contablix"
    >
      <rect width="64" height="64" fill="white" rx="8" />
      <path
        d="M12 32c0-11 8-20 19-20 5 0 9 1.5 12 4l-6.5 8c-1.5-1.5-3.5-2.5-5.5-2.5-6 0-9 4.5-9 10.5s3 10.5 9 10.5c2 0 4-1 5.5-2.5l6.5 8c-3 2.5-7 4-12 4-11 0-19-9-19-20z"
        fill="#14315d"
      />
      <path
        d="M32 24l7-10h10l-12 16 12 16h-10l-7-10-7 10h-10l12-16-12-16h10l7 10z"
        fill="#14315d"
      />
      <polygon points="44,14 56,14 52,20 40,20" fill="#00b67a" />
    </svg>
  )
}
