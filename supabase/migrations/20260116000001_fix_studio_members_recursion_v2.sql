-- Fix: Recursión infinita en política INSERT de studio_members
-- Problema: La cláusula NOT EXISTS consulta studio_members desde su propia política
-- Solución: Usar función SECURITY DEFINER para verificar si studio está vacío
-- Fecha: 2026-01-16

-- 1. Crear función helper que bypass RLS
CREATE OR REPLACE FUNCTION public.studio_has_no_members(sid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM studio_members WHERE studio_id = sid
  )
$$;

COMMENT ON FUNCTION public.studio_has_no_members IS 'Verifica si un studio no tiene miembros. SECURITY DEFINER para bypass RLS.';

-- 2. Recrear política INSERT sin recursión
DROP POLICY IF EXISTS "Admins can add studio members" ON public.studio_members;

CREATE POLICY "Admins can add studio members" ON public.studio_members
  FOR INSERT WITH CHECK (
    -- Caso 1: Owner/Admin existente puede agregar miembros
    studio_id IN (
      SELECT sid FROM get_user_studio_ids(auth.uid()) sid
      WHERE EXISTS (
        SELECT 1 FROM studio_members sm
        WHERE sm.studio_id = sid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
      )
    )
    -- Caso 2: Studio vacío (primer miembro/owner)
    OR studio_has_no_members(studio_id)
    -- Caso 3: Superadmin
    OR is_active_superadmin(auth.uid())
  );

-- 3. También agregar política UPDATE que faltaba
DROP POLICY IF EXISTS "Users can update own membership" ON public.studio_members;

CREATE POLICY "Users can update own membership" ON public.studio_members
  FOR UPDATE USING (
    -- Solo owners pueden actualizar membresías
    studio_id IN (
      SELECT sid FROM get_user_studio_ids(auth.uid()) sid
      WHERE EXISTS (
        SELECT 1 FROM studio_members sm
        WHERE sm.studio_id = sid
        AND sm.user_id = auth.uid()
        AND sm.role = 'owner'
      )
    )
    OR is_active_superadmin(auth.uid())
  );
