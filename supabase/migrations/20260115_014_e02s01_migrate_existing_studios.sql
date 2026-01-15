-- EPIC-02-S01: Migrar Studios Existentes a Tenant Schemas
-- Itera sobre todos los studios y crea su tenant schema si no existe
-- Nota: El trigger on_studio_created() se ejecuta solo en INSERT, no en studios pre-existentes

DO $$
DECLARE
  studio_record RECORD;
  tenant_schema_name TEXT;
BEGIN
  RAISE NOTICE '=== E02-S01: Migrando Studios Existentes ===';
  RAISE NOTICE '';

  -- Iterar sobre todos los studios existentes
  FOR studio_record IN SELECT id, name FROM public.studios LOOP
    tenant_schema_name := get_tenant_schema(studio_record.id);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = tenant_schema_name
    ) THEN
      RAISE NOTICE 'Creando schema para studio: % (%)', studio_record.name, studio_record.id;

      -- Crear schema base + extensión RECA
      PERFORM create_reca_tenant(studio_record.id);

      -- Crear políticas RLS
      PERFORM create_tenant_rls_policies(studio_record.id);

      RAISE NOTICE '  ✓ Schema creado: %', tenant_schema_name;
    ELSE
      RAISE NOTICE 'Schema ya existe para studio: % (%)', studio_record.name, tenant_schema_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Resumen E02-S01 ===';
  RAISE NOTICE 'Total studios: %', (SELECT COUNT(*) FROM public.studios);
  RAISE NOTICE 'Schemas tenant: %', (
    SELECT COUNT(*) FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  );
END;
$$;
