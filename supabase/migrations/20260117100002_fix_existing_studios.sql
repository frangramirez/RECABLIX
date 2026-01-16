-- ============================================================================
-- Migration: Fix Existing Studios (Idempotente)
-- Description: Asegura que todos los studios existentes tengan:
--              1. schema_name populado
--              2. Tenant schema creado con todas las tablas
--
-- Esta migración es segura de ejecutar múltiples veces
-- ============================================================================

DO $$
DECLARE
  studio_record RECORD;
  v_schema_name TEXT;
  studios_fixed INTEGER := 0;
  schemas_created INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Verificando studios existentes ===';
  RAISE NOTICE '';

  -- Iterar sobre todos los studios
  FOR studio_record IN
    SELECT id, name, schema_name
    FROM public.studios
  LOOP
    v_schema_name := get_tenant_schema(studio_record.id);

    -- 1. Verificar y actualizar schema_name si es NULL o incorrecto
    IF studio_record.schema_name IS NULL OR studio_record.schema_name != v_schema_name THEN
      UPDATE public.studios
      SET schema_name = v_schema_name
      WHERE id = studio_record.id;

      studios_fixed := studios_fixed + 1;
      RAISE NOTICE 'Studio "%" (%): schema_name actualizado a %',
        studio_record.name, studio_record.id, v_schema_name;
    END IF;

    -- 2. Verificar si el tenant schema existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = v_schema_name
    ) THEN
      RAISE NOTICE 'Studio "%" (%): Creando schema faltante %',
        studio_record.name, studio_record.id, v_schema_name;

      -- Crear schema completo
      PERFORM create_reca_tenant(studio_record.id);

      -- Crear políticas RLS
      PERFORM create_tenant_rls_policies(studio_record.id);

      schemas_created := schemas_created + 1;
      RAISE NOTICE '  ✓ Schema % creado exitosamente', v_schema_name;
    ELSE
      -- Schema existe, verificar que tenga las tablas RECA
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema_name
        AND table_name = 'reca_client_data'
      ) THEN
        RAISE NOTICE 'Studio "%" (%): Agregando tablas RECA faltantes',
          studio_record.name, studio_record.id;
        PERFORM extend_tenant_for_reca(studio_record.id);
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Resumen ===';
  RAISE NOTICE 'Total studios: %', (SELECT COUNT(*) FROM public.studios);
  RAISE NOTICE 'Studios con schema_name corregido: %', studios_fixed;
  RAISE NOTICE 'Schemas creados: %', schemas_created;
  RAISE NOTICE 'Total tenant schemas: %', (
    SELECT COUNT(*) FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  );
END;
$$;

-- Verificación final: mostrar estado de studios
DO $$
DECLARE
  studio_row RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Estado final de studios ===';

  FOR studio_row IN
    SELECT
      s.name,
      s.schema_name,
      EXISTS(
        SELECT 1 FROM information_schema.schemata sch
        WHERE sch.schema_name = s.schema_name
      ) as schema_exists
    FROM public.studios s
    ORDER BY s.name
  LOOP
    IF studio_row.schema_exists THEN
      RAISE NOTICE '✓ % - Schema: % (existe)', studio_row.name, studio_row.schema_name;
    ELSE
      RAISE NOTICE '✗ % - Schema: % (NO EXISTE)', studio_row.name, studio_row.schema_name;
    END IF;
  END LOOP;
END;
$$;
