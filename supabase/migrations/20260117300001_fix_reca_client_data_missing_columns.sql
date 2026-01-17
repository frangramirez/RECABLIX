-- ============================================================================
-- Migration: Fix missing columns in tenant reca_client_data tables
-- ============================================================================
-- Problema: La función extend_tenant_for_reca() no incluía las columnas
--           'activity' y 'province_code' en la tabla reca_client_data
--
-- Solución:
--   1. Agregar columnas faltantes a todos los tenant schemas existentes
--   2. Actualizar extend_tenant_for_reca() para futuros schemas
-- ============================================================================

-- ============================================================================
-- FASE 1: Agregar columnas a todos los tenant schemas existentes
-- ============================================================================

DO $$
DECLARE
  v_studio RECORD;
  v_sql TEXT;
BEGIN
  RAISE NOTICE 'Agregando columnas faltantes a reca_client_data en tenant schemas...';

  FOR v_studio IN
    SELECT id, name, schema_name
    FROM public.studios
    WHERE schema_name IS NOT NULL
    ORDER BY created_at
  LOOP
    -- Verificar que el schema existe
    IF EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = v_studio.schema_name
    ) THEN
      -- Verificar que la tabla existe
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_studio.schema_name
          AND table_name = 'reca_client_data'
      ) THEN
        -- Agregar columna 'activity' si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = v_studio.schema_name
            AND table_name = 'reca_client_data'
            AND column_name = 'activity'
        ) THEN
          v_sql := format(
            'ALTER TABLE %I.reca_client_data ADD COLUMN activity varchar DEFAULT ''SERVICIOS''',
            v_studio.schema_name
          );
          EXECUTE v_sql;
          RAISE NOTICE '  [%] activity agregada', v_studio.name;
        END IF;

        -- Agregar columna 'province_code' si no existe
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = v_studio.schema_name
            AND table_name = 'reca_client_data'
            AND column_name = 'province_code'
        ) THEN
          v_sql := format(
            'ALTER TABLE %I.reca_client_data ADD COLUMN province_code varchar(3) DEFAULT ''901''',
            v_studio.schema_name
          );
          EXECUTE v_sql;
          RAISE NOTICE '  [%] province_code agregada', v_studio.name;
        END IF;

        RAISE NOTICE '  [OK] %', v_studio.name;
      ELSE
        RAISE NOTICE '  [SKIP] % - tabla reca_client_data no existe', v_studio.name;
      END IF;
    ELSE
      RAISE NOTICE '  [SKIP] % - schema no existe', v_studio.name;
    END IF;
  END LOOP;

  RAISE NOTICE 'Columnas agregadas exitosamente';
END;
$$;


-- ============================================================================
-- FASE 2: Actualizar función extend_tenant_for_reca() para futuros schemas
-- ============================================================================

CREATE OR REPLACE FUNCTION extend_tenant_for_reca(p_studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  v_schema_name := get_tenant_schema(p_studio_id);

  RAISE NOTICE 'Extendiendo schema % con tablas RECA...', v_schema_name;

  -- Crear tabla reca_client_data si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = v_schema_name AND table_name = 'reca_client_data'
  ) THEN
    EXECUTE format('
      CREATE TABLE %I.reca_client_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID UNIQUE NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
        activity varchar DEFAULT ''SERVICIOS'',
        province_code varchar(3) DEFAULT ''901'',
        works_in_rd boolean DEFAULT false,
        is_retired boolean DEFAULT false,
        is_exempt boolean DEFAULT false,
        has_multilateral boolean DEFAULT false,
        has_local boolean DEFAULT false,
        is_rented boolean DEFAULT false,
        dependents smallint DEFAULT 0 CHECK (dependents >= 0 AND dependents <= 6),
        local_m2 smallint CHECK (local_m2 >= 0),
        annual_rent numeric(15,2) CHECK (annual_rent >= 0),
        landlord_cuit varchar(13),
        annual_mw smallint CHECK (annual_mw >= 0),
        previous_category char(1) CHECK (previous_category IN (''A'',''B'',''C'',''D'',''E'',''F'',''G'',''H'',''I'',''J'',''K'')),
        previous_fee numeric(15,2),
        notes text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    ', v_schema_name, v_schema_name);

    -- Habilitar RLS
    EXECUTE format('ALTER TABLE %I.reca_client_data ENABLE ROW LEVEL SECURITY', v_schema_name);

    -- Índices
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_client_data_client ON %I.reca_client_data(client_id)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_client_data_activity ON %I.reca_client_data(activity)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_client_data_province ON %I.reca_client_data(province_code)', v_schema_name);

    RAISE NOTICE 'Tabla reca_client_data creada en %', v_schema_name;
  ELSE
    -- Si la tabla ya existe, asegurar que tenga las columnas nuevas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = v_schema_name
        AND table_name = 'reca_client_data'
        AND column_name = 'activity'
    ) THEN
      EXECUTE format('ALTER TABLE %I.reca_client_data ADD COLUMN activity varchar DEFAULT ''SERVICIOS''', v_schema_name);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = v_schema_name
        AND table_name = 'reca_client_data'
        AND column_name = 'province_code'
    ) THEN
      EXECUTE format('ALTER TABLE %I.reca_client_data ADD COLUMN province_code varchar(3) DEFAULT ''901''', v_schema_name);
    END IF;
  END IF;

  -- Crear tabla reca_transactions si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = v_schema_name AND table_name = 'reca_transactions'
  ) THEN
    EXECUTE format('
      CREATE TABLE %I.reca_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
        transaction_type varchar NOT NULL CHECK (transaction_type IN (''SALE'', ''PURCHASE'')),
        period varchar(6) NOT NULL,
        amount numeric(15,2) NOT NULL,
        transaction_date date,
        description varchar(500),
        created_at timestamptz DEFAULT now()
      )
    ', v_schema_name, v_schema_name);

    -- Habilitar RLS
    EXECUTE format('ALTER TABLE %I.reca_transactions ENABLE ROW LEVEL SECURITY', v_schema_name);

    -- Índices
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_transactions_client ON %I.reca_transactions(client_id)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_transactions_period ON %I.reca_transactions(period)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_transactions_type ON %I.reca_transactions(transaction_type)', v_schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_reca_transactions_client_period ON %I.reca_transactions(client_id, period)', v_schema_name);

    RAISE NOTICE 'Tabla reca_transactions creada en %', v_schema_name;
  END IF;

  RAISE NOTICE 'Schema % extendido con tablas RECA', v_schema_name;
END;
$$;

COMMENT ON FUNCTION extend_tenant_for_reca IS
  'Extiende un tenant schema con tablas RECA (reca_client_data, reca_transactions). '
  'Idempotente: puede ejecutarse múltiples veces sin error. '
  'Incluye columnas activity y province_code con defaults.';
