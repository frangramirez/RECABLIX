import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// Cliente para uso en el browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente para uso en el servidor (con cookies)
export function createSupabaseServerClient(cookies: AstroCookies) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Astro no expone getAll, usamos los nombres conocidos de Supabase
        const cookieNames = [
          'sb-access-token',
          'sb-refresh-token',
          `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`,
        ]
        const result: { name: string; value: string }[] = []
        for (const name of cookieNames) {
          const cookie = cookies.get(name)
          if (cookie?.value) {
            result.push({ name, value: cookie.value })
          }
        }
        return result
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, {
            path: '/',
            ...options,
          })
        }
      },
    },
  })
}
