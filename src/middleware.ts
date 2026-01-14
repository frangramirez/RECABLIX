import { defineMiddleware } from 'astro:middleware'
import { getStudioFromSession } from '@/lib/auth'

// Rutas públicas (no requieren auth)
const PUBLIC_ROUTES = ['/', '/login', '/api/auth/login', '/api/auth/logout']

// Prefijo de rutas solo para SuperAdmin
const ADMIN_ROUTES_PREFIX = '/admin'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Rutas públicas - permitir sin auth
  if (PUBLIC_ROUTES.includes(pathname)) {
    return next()
  }

  // Assets estáticos - permitir
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/favicon')) {
    return next()
  }

  // API routes (excepto auth) - dejar que manejen su propia auth
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    return next()
  }

  // Verificar sesión
  const studio = await getStudioFromSession(context.cookies)

  if (!studio) {
    // Sin sesión - redirect a login
    return context.redirect('/login')
  }

  // Rutas admin - solo superadmin
  if (pathname.startsWith(ADMIN_ROUTES_PREFIX)) {
    if (!studio.is_superadmin) {
      return context.redirect('/studio')
    }
  }

  // Agregar studio al locals para uso en páginas
  context.locals.studio = studio

  return next()
})
