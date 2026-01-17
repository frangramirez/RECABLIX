-- Migración: Agregar columna permissions a studio_members
-- Fecha: 2026-01-17
-- Propósito: Permitir permisos granulares por miembro

-- ============================================================
-- PASO 1: Agregar columna permissions
-- ============================================================

ALTER TABLE public.studio_members
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.studio_members.permissions IS
'Permisos granulares del miembro. Formato: {"can_view_billing": false, "can_delete_clients": true, ...}';

-- ============================================================
-- PASO 2: Actualizar miembros existentes con permisos por defecto
-- ============================================================

-- Los owners y admins tienen todos los permisos implícitamente (manejado en código)
-- Los collaborators y clients reciben permisos básicos

UPDATE public.studio_members
SET permissions = '{
  "can_view_billing": false,
  "can_manage_subscriptions": false,
  "can_delete_members": false,
  "can_delete_clients": false,
  "can_export_data": true,
  "can_import_data": false,
  "can_generate_reports": true
}'::jsonb
WHERE permissions IS NULL OR permissions = '{}'::jsonb;
