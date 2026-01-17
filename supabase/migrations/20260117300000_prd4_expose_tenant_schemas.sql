-- ============================================================================
-- Migration: PRD4 - Expose Tenant Schemas in PostgREST
-- ============================================================================
-- Problema: PostgREST solo expone schemas configurados en pgrst.db_schemas
--           Actualmente solo tiene 'public' y 1 tenant schema.
--           Los otros 6 studios con tenant schemas devuelven "Invalid schema"
--
-- Solución:
--   1. Crear función expose_tenant_schema() para agregar schemas dinámicamente
--   2. Exponer TODOS los tenant schemas existentes
--   3. Modificar on_studio_created() para auto-exponer nuevos schemas
-- ============================================================================

-- ============================================================================
-- FASE 1: Función para exponer un schema en PostgREST
-- ============================================================================

CREATE OR REPLACE FUNCTION expose_tenant_schema(p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
  v_current_schemas TEXT;
  v_schema_exists BOOLEAN;
BEGIN
  -- Generar nombre del schema
  v_schema_name := get_tenant_schema(p_studio_id);

  -- Verificar si el schema físicamente existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = v_schema_name
  ) INTO v_schema_exists;

  IF NOT v_schema_exists THEN
    RAISE NOTICE 'Schema % no existe, saltando expose', v_schema_name;
    RETURN;
  END IF;

  -- Obtener configuración actual de pgrst.db_schemas
  SELECT setting INTO v_current_schemas
  FROM pg_catalog.pg_settings
  WHERE name = 'pgrst.db_schemas';

  -- Si no hay configuración, usar default
  IF v_current_schemas IS NULL OR v_current_schemas = '' THEN
    v_current_schemas := 'public';
  END IF;

  -- Verificar si el schema ya está expuesto
  IF v_current_schemas LIKE '%' || v_schema_name || '%' THEN
    RAISE NOTICE 'Schema % ya está expuesto en PostgREST', v_schema_name;
    RETURN;
  END IF;

  -- Agregar el schema a la configuración
  v_current_schemas := v_current_schemas || ', ' || v_schema_name;

  -- Actualizar configuración en el rol authenticator
  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', v_current_schemas);

  -- Notificar a PostgREST para que recargue la configuración
  NOTIFY pgrst, 'reload config';

  RAISE NOTICE 'Schema % expuesto en PostgREST. Config actual: %', v_schema_name, v_current_schemas;
END;
$$;

COMMENT ON FUNCTION expose_tenant_schema IS
  'Expone un tenant schema en PostgREST agregándolo a pgrst.db_schemas. '
  'Idempotente: no agrega duplicados. '
  'Emite NOTIFY pgrst para que PostgREST recargue la configuración.';

-- Otorgar permisos para que pueda ser llamada desde TypeScript
GRANT EXECUTE ON FUNCTION expose_tenant_schema(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION expose_tenant_schema(UUID) TO service_role;


-- ============================================================================
-- FASE 2: Actualizar on_studio_created() para auto-exponer schemas
-- ============================================================================

-- Eliminar función y trigger existentes (CASCADE para dependencias)
DROP TRIGGER IF EXISTS trigger_create_tenant_on_studio ON public.studios;
DROP FUNCTION IF EXISTS on_studio_created() CASCADE;

-- Recrear función con llamada a expose_tenant_schema
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

  -- Bloque con manejo de errores para creación de schema
  BEGIN
    -- Crear schema del tenant completo (base + RECA + RLS)
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

  -- =========================================================================
  -- PRD4: Exponer el schema en PostgREST (NUEVO)
  -- =========================================================================
  BEGIN
    PERFORM expose_tenant_schema(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Log del error pero no fallar - el schema funciona, solo PostgREST no lo ve
    RAISE WARNING 'Error exponiendo schema % en PostgREST: % - %',
      v_schema_name, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_studio_created IS
  'Trigger function que crea automáticamente el tenant schema cuando se inserta un nuevo studio. '
  'PRD4: También expone el schema en PostgREST via expose_tenant_schema().';

-- Recrear el trigger
CREATE TRIGGER trigger_create_tenant_on_studio
AFTER INSERT ON public.studios
FOR EACH ROW
EXECUTE FUNCTION on_studio_created();

COMMENT ON TRIGGER trigger_create_tenant_on_studio ON public.studios IS
  'Auto-crea y expone tenant schema al insertar nuevo studio.';


-- ============================================================================
-- FASE 3: Fix inmediato - Exponer TODOS los tenant schemas existentes
-- ============================================================================
-- Los 7 studios con tenant schemas según el diagnóstico:
-- 1. tenant_a1b2c3d4_e5f6_7890_abcd_ef1234567890 (Contablix) - YA expuesto
-- 2. tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9 (cx6)
-- 3. tenant_769f5a23_9b97_47be_a7ab_a7c42945c62d (Contablix3)
-- 4. tenant_f3265312_379b_4c98_bb49_431b7ed0ec77 (contablix4)
-- 5. tenant_4904adaf_da45_4305_959c_916a19055f0f (contablix5)
-- 6. tenant_c3d4e5f6_a7b8_9012_cdef_345678901234 (Consultora Fiscal Norte)
-- 7. tenant_b2c3d4e5_f6a7_8901_bcde_f23456789012 (Estudio García & Asociados)

DO $$
DECLARE
  v_studio RECORD;
  v_all_schemas TEXT := 'public';
  v_schema_name TEXT;
  v_count INT := 0;
BEGIN
  RAISE NOTICE 'PRD4: Exponiendo todos los tenant schemas existentes en PostgREST...';

  -- Iterar sobre todos los studios que tienen schema_name
  FOR v_studio IN
    SELECT id, name, schema_name
    FROM public.studios
    WHERE schema_name IS NOT NULL
    ORDER BY created_at
  LOOP
    -- Verificar que el schema existe físicamente
    IF EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = v_studio.schema_name
    ) THEN
      v_all_schemas := v_all_schemas || ', ' || v_studio.schema_name;
      v_count := v_count + 1;
      RAISE NOTICE '  [%] % (%)', v_count, v_studio.name, v_studio.schema_name;
    ELSE
      RAISE WARNING '  SKIP: % - schema % no existe físicamente', v_studio.name, v_studio.schema_name;
    END IF;
  END LOOP;

  -- Actualizar configuración del rol authenticator
  IF v_count > 0 THEN
    EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', v_all_schemas);

    -- Notificar a PostgREST para recargar
    NOTIFY pgrst, 'reload config';

    RAISE NOTICE 'PRD4: % schemas expuestos en PostgREST', v_count;
    RAISE NOTICE 'PRD4: Configuración final: %', v_all_schemas;
  ELSE
    RAISE NOTICE 'PRD4: No hay tenant schemas para exponer';
  END IF;
END;
$$;
