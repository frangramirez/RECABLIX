-- Migración: Agregar subscription_limits a studios y rol client
-- Fecha: 2026-01-17
-- Propósito: Permitir límites de usuarios por rol y agregar rol 'client'

-- ============================================================
-- PASO 1: Agregar campo subscription_limits a studios
-- ============================================================

ALTER TABLE public.studios
ADD COLUMN IF NOT EXISTS subscription_limits JSONB DEFAULT '{
  "max_admins": null,
  "max_collaborators": null,
  "max_clients": null
}'::jsonb;

COMMENT ON COLUMN public.studios.subscription_limits IS
'Límites de usuarios por rol. null = ilimitado. Formato: {"max_admins": 2, "max_collaborators": 10, "max_clients": null}';

-- ============================================================
-- PASO 2: Agregar rol 'client' al constraint de studio_members
-- ============================================================

-- Eliminar constraint existente
ALTER TABLE public.studio_members
DROP CONSTRAINT IF EXISTS studio_members_role_check;

-- Crear nuevo constraint con 'client' incluido
ALTER TABLE public.studio_members
ADD CONSTRAINT studio_members_role_check
CHECK (role IN ('owner', 'admin', 'collaborator', 'client'));

-- ============================================================
-- PASO 3: Comentarios y documentación
-- ============================================================

COMMENT ON CONSTRAINT studio_members_role_check ON public.studio_members IS
'Roles válidos: owner (1 por studio), admin (gestión total), collaborator (trabajo operativo), client (portal externo)';

-- ============================================================
-- PASO 4: Índices opcionales para performance
-- ============================================================

-- Índice para filtrar por rol (útil para contar por tipo)
CREATE INDEX IF NOT EXISTS idx_studio_members_role
ON public.studio_members(role);

-- Índice compuesto para contar miembros por studio y rol
CREATE INDEX IF NOT EXISTS idx_studio_members_studio_role
ON public.studio_members(studio_id, role);
