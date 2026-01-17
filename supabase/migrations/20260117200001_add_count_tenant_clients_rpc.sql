-- ============================================================================
-- Migration: Add count_tenant_clients RPC
-- Description: Función para contar clientes en un tenant schema específico
--              Usada por /api/admin/my-studios para mostrar conteos en dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION count_tenant_clients(p_schema_name TEXT, p_app VARCHAR DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_query TEXT;
BEGIN
  -- Verificar que el schema existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = p_schema_name
  ) THEN
    RETURN 0;
  END IF;

  -- Verificar que la tabla clients existe en el schema
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = p_schema_name
    AND table_name = 'clients'
  ) THEN
    RETURN 0;
  END IF;

  -- Construir query dinámico
  IF p_app IS NOT NULL THEN
    -- Contar solo clientes con la app específica
    v_query := format(
      'SELECT COUNT(*) FROM %I.clients WHERE %L = ANY(apps)',
      p_schema_name, p_app
    );
  ELSE
    -- Contar todos los clientes
    v_query := format('SELECT COUNT(*) FROM %I.clients', p_schema_name);
  END IF;

  EXECUTE v_query INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION count_tenant_clients IS
  'Cuenta clientes en un tenant schema. Parámetros: p_schema_name (requerido), p_app (opcional, filtra por app).';

-- Grant para que pueda ser llamado por authenticated users
GRANT EXECUTE ON FUNCTION count_tenant_clients(TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION count_tenant_clients(TEXT, VARCHAR) TO service_role;
