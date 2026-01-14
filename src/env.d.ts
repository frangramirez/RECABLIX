/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string
  readonly PUBLIC_SUPABASE_ANON_KEY: string
  readonly SUPABASE_SERVICE_KEY: string
  readonly PUBLIC_APP_URL: string
  readonly SUPERADMIN_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Studio {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  cuit: string | null
  is_superadmin: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

declare namespace App {
  interface Locals {
    studio: Studio | null
  }
}
