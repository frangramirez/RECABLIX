-- EPIC-02-S03: Migrar reca_client_data y reca_transactions a Tenant Schemas
-- Migra datos específicos de RECABLIX de public a tenant schemas
-- Usa JOIN con clients para determinar el studio_id correcto

DO $$
DECLARE
  studio_record RECORD;
  schema_name TEXT;
  rcd_count INTEGER;
  rt_count INTEGER;
  total_rcd INTEGER := 0;
  total_rt INTEGER := 0;
BEGIN
  RAISE NOTICE '=== E02-S03: Migrando Datos RECA a Tenant Schemas ===';
  RAISE NOTICE '';

  FOR studio_record IN SELECT id, name FROM public.studios LOOP
    schema_name := get_tenant_schema(studio_record.id);

    -- Migrar reca_client_data
    EXECUTE format('
      INSERT INTO %I.reca_client_data (
        id, client_id, activity, province_code, works_in_rd, is_retired, is_exempt,
        has_multilateral, has_local, is_rented, dependents, local_m2, annual_rent,
        landlord_cuit, annual_mw, previous_category, previous_fee, notes,
        created_at, updated_at
      )
      SELECT rcd.*
      FROM public.reca_client_data rcd
      JOIN public.clients c ON c.id = rcd.client_id
      WHERE c.studio_id = %L
      ON CONFLICT (client_id) DO NOTHING
    ', schema_name, studio_record.id);

    GET DIAGNOSTICS rcd_count = ROW_COUNT;

    -- Migrar reca_transactions
    EXECUTE format('
      INSERT INTO %I.reca_transactions (
        id, client_id, transaction_type, period, amount,
        transaction_date, description, created_at
      )
      SELECT rt.*
      FROM public.reca_transactions rt
      JOIN public.clients c ON c.id = rt.client_id
      WHERE c.studio_id = %L
      ON CONFLICT (id) DO NOTHING
    ', schema_name, studio_record.id);

    GET DIAGNOSTICS rt_count = ROW_COUNT;

    IF rcd_count > 0 OR rt_count > 0 THEN
      RAISE NOTICE 'Studio: %', studio_record.name;
      RAISE NOTICE '  → Migrados: % reca_client_data, % reca_transactions', rcd_count, rt_count;
      total_rcd := total_rcd + rcd_count;
      total_rt := total_rt + rt_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Resumen E02-S03 ===';
  RAISE NOTICE 'Total reca_client_data migrados: %', total_rcd;
  RAISE NOTICE 'Total reca_transactions migrados: %', total_rt;
  RAISE NOTICE '';
  RAISE NOTICE 'En public schema:';
  RAISE NOTICE '  - reca_client_data: %', (SELECT COUNT(*) FROM public.reca_client_data);
  RAISE NOTICE '  - reca_transactions: %', (SELECT COUNT(*) FROM public.reca_transactions);
END;
$$;
