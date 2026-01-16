import { cn } from '@/lib/utils'

interface ContablixIconProps {
  className?: string
  size?: number
}

/**
 * Isotipo CX de Contablix
 * Uso: Sidebars, headers compactos, favicon inline
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
      {/* C ovalada */}
      <path
        d="M12 32c0-11 8-20 19-20 5 0 9 1.5 12 4l-6.5 8c-1.5-1.5-3.5-2.5-5.5-2.5-6 0-9 4.5-9 10.5s3 10.5 9 10.5c2 0 4-1 5.5-2.5l6.5 8c-3 2.5-7 4-12 4-11 0-19-9-19-20z"
        fill="#14315d"
      />
      {/* X */}
      <path
        d="M32 24l7-10h10l-12 16 12 16h-10l-7-10-7 10h-10l12-16-12-16h10l7 10z"
        fill="#14315d"
      />
      {/* Acento verde */}
      <polygon points="44,14 56,14 52,20 40,20" fill="#00b67a" />
    </svg>
  )
}

interface ContablixLogoProps {
  className?: string
  height?: number
  showTagline?: boolean
}

/**
 * Logotipo completo "contablix"
 * Uso: Login, páginas de marketing, headers expandidos
 */
export function ContablixLogo({ className, height = 40, showTagline }: ContablixLogoProps) {
  // Aspect ratio del logo completo es aproximadamente 6:1
  const width = height * 6

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 360 60"
        fill="none"
        width={width}
        height={height}
        aria-label="Contablix"
      >
        {/* c */}
        <path
          d="M0 30c0-16.5 11-30 28-30 7 0 13 2 17 6l-8 11c-2-2-5-4-9-4-8 0-13 7-13 17s5 17 13 17c4 0 7-2 9-4l8 11c-4 4-10 6-17 6-17 0-28-13.5-28-30z"
          fill="#14315d"
        />
        {/* o */}
        <path
          d="M45 30c0-16.5 11-30 27-30s27 13.5 27 30-11 30-27 30-27-13.5-27-30zm39 0c0-10-5-17-12-17s-12 7-12 17 5 17 12 17 12-7 12-17z"
          fill="#14315d"
        />
        {/* n */}
        <path
          d="M104 2h14v10c3-7 10-12 19-12 13 0 21 9 21 24v34h-15V28c0-9-4-14-12-14-9 0-13 6-13 17v27h-14V2z"
          fill="#14315d"
        />
        {/* t */}
        <path
          d="M167 14V2h14v12h12v12h-12v22c0 5 2 7 7 7h5v12c-2 1-6 1-9 1-13 0-17-6-17-19V26h-9V14h9z"
          fill="#14315d"
        />
        {/* a */}
        <path
          d="M195 44c0-11 9-17 24-18l11-1v-2c0-6-4-10-11-10-6 0-10 3-11 8h-14c1-12 11-21 26-21 16 0 25 9 25 24v34h-14v-8c-4 6-10 10-19 10-12 0-17-7-17-16zm35-5v-5l-11 1c-8 1-11 3-11 8s3 7 9 7c9 0 13-5 13-11z"
          fill="#14315d"
        />
        {/* b */}
        <path
          d="M253 2h14v14c4-6 10-11 19-11 16 0 26 13 26 30s-10 30-26 30c-9 0-15-4-18-10v8h-15V2zm29 28c0-11-5-17-13-17s-13 6-13 17 5 17 13 17 13-6 13-17z"
          fill="#14315d"
        />
        {/* l */}
        <path d="M318 2h14v56h-14V2z" fill="#14315d" />
        {/* i */}
        <path d="M340 14h14v44h-14V14z" fill="#14315d" />
        {/* x con acento verde */}
        <path
          d="M340 30l-7-10 7-10 7 10-7 10z"
          fill="#14315d"
          transform="translate(0, -18) scale(0.8)"
        />
        {/* Punto de la i + acento verde */}
        <rect x="340" y="0" width="14" height="10" fill="#14315d" />
        <polygon points="354,0 360,0 358,6 352,6" fill="#00b67a" />
      </svg>
      {showTagline && (
        <p className="text-xs text-muted-foreground mt-1">
          Software contable inteligente
        </p>
      )}
    </div>
  )
}

/**
 * Versión compacta del isotipo con texto "RECABLIX"
 * Uso: Sidebars cuando se necesita mostrar el nombre del producto
 */
export function RecablixBrand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ContablixIcon size={32} />
      <div>
        <h1 className="font-semibold text-foreground">RECABLIX</h1>
      </div>
    </div>
  )
}
