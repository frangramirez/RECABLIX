-- EPIC-01: Función para crear políticas RLS en tenant schemas
-- Esta función crea políticas RLS dinámicamente para cada tabla en un tenant schema
-- Permite acceso solo a miembros del studio o superadmins

CREATE OR REPLACE FUNCTION create_tenant_rls_policies(studio_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_name TEXT;
BEGIN
  schema_name := get_tenant_schema(studio_uuid);

  -- Políticas para clients
  EXECUTE format('
    CREATE POLICY "tenant_access" ON %I.clients
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.studio_members sm
        WHERE sm.user_id = auth.uid()
        AND sm.studio_id = %L
      )
      OR is_active_superadmin(auth.uid())
    )
  ', schema_name, studio_uuid);

  -- Políticas para reca_client_data
  EXECUTE format('
    CREATE POLICY "tenant_access" ON %I.reca_client_data
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.studio_members sm
        WHERE sm.user_id = auth.uid()
        AND sm.studio_id = %L
      )
      OR is_active_superadmin(auth.uid())
    )
  ', schema_name, studio_uuid);

  -- Políticas para reca_transactions
  EXECUTE format('
    CREATE POLICY "tenant_access" ON %I.reca_transactions
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.studio_members sm
        WHERE sm.user_id = auth.uid()
        AND sm.studio_id = %L
      )
      OR is_active_superadmin(auth.uid())
    )
  ', schema_name, studio_uuid);

  RAISE NOTICE 'Políticas RLS creadas para schema: %', schema_name;
END;
$$;

COMMENT ON FUNCTION create_tenant_rls_policies IS 'Crea políticas RLS para todas las tablas en un tenant schema. Solo miembros del studio o superadmins tienen acceso.';
