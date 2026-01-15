-- EPIC-02-S02: Migrar Clientes de Public a Tenant Schemas
-- Copia clientes de public.clients a tenant_{studio_id}.clients
-- Usa ON CONFLICT (id) DO NOTHING para idempotencia

DO $$
DECLARE
  studio_record RECORD;
  schema_name TEXT;
  migrated_count INTEGER;
  total_migrated INTEGER := 0;
BEGIN
  RAISE NOTICE '=== E02-S02: Migrando Clientes a Tenant Schemas ===';
  RAISE NOTICE '';

  FOR studio_record IN SELECT id, name FROM public.studios LOOP
    schema_name := get_tenant_schema(studio_record.id);

    -- Migrar clientes de este studio
    EXECUTE format('
      INSERT INTO %I.clients (id, name, legal_name, cuit, email, phone, fiscal_year, apps, is_active, notes, created_at, updated_at)
      SELECT id, name, legal_name, cuit, email, phone, fiscal_year, apps, is_active, notes, created_at, updated_at
      FROM public.clients
      WHERE studio_id = %L
      ON CONFLICT (id) DO NOTHING
    ', schema_name, studio_record.id);

    GET DIAGNOSTICS migrated_count = ROW_COUNT;

    IF migrated_count > 0 THEN
      RAISE NOTICE 'Studio: % → Migrados % clientes', studio_record.name, migrated_count;
      total_migrated := total_migrated + migrated_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Resumen E02-S02 ===';
  RAISE NOTICE 'Total clientes migrados: %', total_migrated;
  RAISE NOTICE 'Clientes en public: %', (SELECT COUNT(*) FROM public.clients);
END;
$$;
