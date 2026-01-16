-- ============================================================================
-- Migration: Fix Tenant Schema Creation
-- Description: Corrige las funciones de creación de tenant schema para que sean
--              completamente idempotentes:
--              1. create_tenant_rls_policies: usa DROP POLICY IF EXISTS antes de CREATE
--              2. create_reca_tenant: asegura actualización de schema_name
--              3. on_studio_created: maneja errores gracefully
--
-- Root Cause: Las políticas RLS no soportan "IF NOT EXISTS", por lo que si ya
--             existen, CREATE POLICY falla con "policy already exists"
-- ============================================================================

-- Eliminar funciones existentes (CASCADE para dependencias como triggers)
DROP FUNCTION IF EXISTS on_studio_created() CASCADE;
DROP FUNCTION IF EXISTS create_reca_tenant(uuid) CASCADE;
DROP FUNCTION IF EXISTS create_tenant_rls_policies(uuid) CASCADE;

-- ----------------------------------------------------------------------------
-- 1. FIX: create_tenant_rls_policies - Ahora es idempotente
-- ----------------------------------------------------------------------------
-- Cambio: DROP POLICY IF EXISTS antes de CREATE POLICY

CREATE FUNCTION create_tenant_rls_policies(studio_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  v_schema_name := get_tenant_schema(studio_uuid);

  RAISE NOTICE 'Creando/actualizando políticas RLS para schema: %', v_schema_name;

  -- ==========================================================================
  -- Políticas para clients
  -- ==========================================================================
  -- Primero eliminar si existe
  EXECUTE format('DROP POLICY IF EXISTS "tenant_access" ON %I.clients', v_schema_name);

  -- Luego crear la política
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
  ', v_schema_name, studio_uuid);

  -- ==========================================================================
  -- Políticas para client_users
  -- ==========================================================================
  EXECUTE format('DROP POLICY IF EXISTS "tenant_access" ON %I.client_users', v_schema_name);

  EXECUTE format('
    CREATE POLICY "tenant_access" ON %I.client_users
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.studio_members sm
        WHERE sm.user_id = auth.uid()
        AND sm.studio_id = %L
      )
      OR is_active_superadmin(auth.uid())
    )
  ', v_schema_name, studio_uuid);

  -- ==========================================================================
  -- Políticas para vouchers
  -- ==========================================================================
  EXECUTE format('DROP POLICY IF EXISTS "tenant_access" ON %I.vouchers', v_schema_name);

  EXECUTE format('
    CREATE POLICY "tenant_access" ON %I.vouchers
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.studio_members sm
        WHERE sm.user_id = auth.uid()
        AND sm.studio_id = %L
      )
      OR is_active_superadmin(auth.uid())
    )
  ', v_schema_name, studio_uuid);

  -- ==========================================================================
  -- Políticas para reca_client_data
  -- ==========================================================================
  EXECUTE format('DROP POLICY IF EXISTS "tenant_access" ON %I.reca_client_data', v_schema_name);

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
  ', v_schema_name, studio_uuid);

  -- ==========================================================================
  -- Políticas para reca_transactions
  -- ==========================================================================
  EXECUTE format('DROP POLICY IF EXISTS "tenant_access" ON %I.reca_transactions', v_schema_name);

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
  ', v_schema_name, studio_uuid);

  RAISE NOTICE 'Políticas RLS creadas/actualizadas para schema: %', v_schema_name;
END;
$$;

COMMENT ON FUNCTION create_tenant_rls_policies IS
  'Crea o actualiza políticas RLS para todas las tablas en un tenant schema. '
  'Idempotente: usa DROP IF EXISTS antes de CREATE. '
  'Solo miembros del studio o superadmins tienen acceso.';

-- ----------------------------------------------------------------------------
-- 2. FIX: create_reca_tenant - Asegurar actualización de schema_name
-- ----------------------------------------------------------------------------
-- Cambio: Actualizar schema_name explícitamente al final

CREATE FUNCTION create_reca_tenant(p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  v_schema_name := get_tenant_schema(p_studio_id);

  RAISE NOTICE 'Creando tenant RECA completo para studio: %', p_studio_id;

  -- Verificar si el schema ya existe
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata sch
    WHERE sch.schema_name = v_schema_name
  ) THEN
    RAISE NOTICE 'Schema % ya existe, verificando tablas...', v_schema_name;
  ELSE
    -- Crear schema base (incluye clients, client_users, vouchers)
    PERFORM create_tenant_schema(p_studio_id);
  END IF;

  -- Extender con tablas RECA (idempotente)
  PERFORM extend_tenant_for_reca(p_studio_id);

  -- Crear/actualizar políticas RLS (ahora idempotente)
  PERFORM create_tenant_rls_policies(p_studio_id);

  -- IMPORTANTE: Siempre actualizar schema_name para garantizar consistencia
  UPDATE public.studios
  SET schema_name = v_schema_name
  WHERE id = p_studio_id
  AND (schema_name IS NULL OR schema_name != v_schema_name);

  RAISE NOTICE 'Tenant RECA completo creado: %', v_schema_name;
END;
$$;

COMMENT ON FUNCTION create_reca_tenant IS
  'Crea un tenant schema completo para RECABLIX: schema base + tablas RECA + políticas RLS. '
  'Idempotente: puede ejecutarse múltiples veces sin error. '
  'Siempre actualiza studios.schema_name al final.';

-- ----------------------------------------------------------------------------
-- 3. FIX: on_studio_created - Manejo robusto con try/catch equivalente
-- ----------------------------------------------------------------------------
-- Cambio: Usar bloques BEGIN/EXCEPTION para manejar errores gracefully

CREATE FUNCTION on_studio_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  -- Generar nombre del schema
  v_schema_name := get_tenant_schema(NEW.id);

  RAISE NOTICE 'Nuevo studio creado: % (%). Creando schema: %', NEW.name, NEW.id, v_schema_name;

  -- Bloque con manejo de errores
  BEGIN
    -- Crear schema del tenant completo (base + RECA + RLS)
    -- Esta función es idempotente y actualiza schema_name
    PERFORM create_reca_tenant(NEW.id);

    RAISE NOTICE 'Schema % creado exitosamente para studio %', v_schema_name, NEW.name;
  EXCEPTION WHEN OTHERS THEN
    -- Log del error pero no fallar el trigger
    RAISE WARNING 'Error creando tenant schema para studio % (%): % - %',
      NEW.name, NEW.id, SQLSTATE, SQLERRM;

    -- Intentar al menos actualizar schema_name
    UPDATE public.studios
    SET schema_name = v_schema_name
    WHERE id = NEW.id;

    RAISE NOTICE 'schema_name actualizado a % aunque hubo error en creación completa', v_schema_name;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_studio_created IS
  'Trigger function que crea automáticamente el tenant schema cuando se inserta un nuevo studio. '
  'Maneja errores gracefully: si falla la creación completa, aún actualiza schema_name.';

-- ----------------------------------------------------------------------------
-- 4. Recrear el trigger
-- ----------------------------------------------------------------------------

CREATE TRIGGER trigger_create_tenant_on_studio
AFTER INSERT ON public.studios
FOR EACH ROW
EXECUTE FUNCTION on_studio_created();
