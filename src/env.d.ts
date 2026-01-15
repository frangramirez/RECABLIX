/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string
  readonly PUBLIC_SUPABASE_ANON_KEY: string
  readonly SUPABASE_SERVICE_KEY: string
  readonly PUBLIC_APP_URL: string
  readonly SUPERADMIN_EMAIL: string
  readonly PUBLIC_USE_TENANT_SCHEMAS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Studio {
  id: string
  name: string
  slug: string
  is_superadmin: boolean
  role?: string
  /** Nombre del tenant schema (tenant_xxxx_xxxx...) */
  schema_name: string
}

declare namespace App {
  interface Locals {
    studio: Studio | null
  }
}
