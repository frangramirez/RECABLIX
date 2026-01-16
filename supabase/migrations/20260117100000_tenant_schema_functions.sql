-- ============================================================================
-- Migration: Tenant Schema Functions
-- Description: Versiona las funciones de tenant schema que existían solo en DB
--
-- Funciones incluidas:
--   1. get_tenant_schema(studio_uuid) - Genera nombre del schema
--   2. user_belongs_to_studio(uid, sid) - Helper SECURITY DEFINER para RLS
--   3. create_tenant_schema(studio_id) - Crea schema base (clients, client_users, vouchers)
--   4. extend_tenant_for_reca(studio_id) - Agrega tablas RECA
--   5. create_reca_tenant(studio_id) - Wrapper que combina las anteriores
--
-- Nota: Todas las funciones usan CREATE OR REPLACE para ser idempotentes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. get_tenant_schema: Genera el nombre del schema tenant
-- ----------------------------------------------------------------------------
-- Patrón: tenant_{studio_uuid_con_guiones_bajos}
-- Ejemplo: tenant_a1b2c3d4_e5f6_7890_abcd_ef1234567890

CREATE OR REPLACE FUNCTION get_tenant_schema(studio_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN 'tenant_' || REPLACE(studio_uuid::TEXT, '-', '_');
END;
$$;

COMMENT ON FUNCTION get_tenant_schema IS
  'Genera el nombre del tenant schema para un studio. Reemplaza guiones por underscores.';

-- ----------------------------------------------------------------------------
-- 2. user_belongs_to_studio: Helper SECURITY DEFINER para verificar membresía
-- ----------------------------------------------------------------------------
-- Usado en políticas RLS para evitar recursión infinita

CREATE OR REPLACE FUNCTION user_belongs_to_studio(uid UUID, sid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.studio_members
    WHERE user_id = uid
    AND studio_id = sid
  );
END;
$$;

COMMENT ON FUNCTION user_belongs_to_studio IS
  'Verifica si un usuario pertenece a un studio. SECURITY DEFINER para evitar recursión RLS.';

-- ----------------------------------------------------------------------------
-- 3. create_tenant_schema: Crea el schema base con tablas compartidas
-- ----------------------------------------------------------------------------
-- Estructura base:
--   - clients: Tabla de clientes del studio
--   - client_users: Usuarios vinculados a clientes (FINBLIX)
--   - vouchers: Comprobantes (FINBLIX)

CREATE OR REPLACE FUNCTION create_tenant_schema(studio_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  v_schema_name := get_tenant_schema(studio_id);

  -- Crear el schema si no existe
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);

  RAISE NOTICE 'Creando schema: %', v_schema_name;

  -- Tabla clients (estructura compatible con FINBLIX)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      cuit VARCHAR(13) CHECK (cuit ~ ''^\d{2}-\d{8}-\d{1}$''),
      email VARCHAR(255),
      fiscal_year INTEGER CHECK (fiscal_year BETWEEN 2000 AND 2100),
      apps VARCHAR(20)[] DEFAULT ''{}''::VARCHAR(20)[],
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  ', v_schema_name);

  -- Índices para clients
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_clients_studio
    ON %I.clients(studio_id)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_clients_cuit
    ON %I.clients(cuit)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_clients_apps
    ON %I.clients USING GIN(apps)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);

  -- Tabla client_users (FINBLIX - usuarios vinculados a clientes)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.client_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT ''viewer'',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(client_id, user_id)
    )
  ', v_schema_name, v_schema_name);

  -- Tabla vouchers (FINBLIX - comprobantes)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.vouchers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
      voucher_type VARCHAR(50) NOT NULL,
      voucher_number VARCHAR(50),
      issue_date DATE,
      amount DECIMAL(15,2),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  ', v_schema_name, v_schema_name);

  -- Habilitar RLS en las tablas
  EXECUTE format('ALTER TABLE %I.clients ENABLE ROW LEVEL SECURITY', v_schema_name);
  EXECUTE format('ALTER TABLE %I.client_users ENABLE ROW LEVEL SECURITY', v_schema_name);
  EXECUTE format('ALTER TABLE %I.vouchers ENABLE ROW LEVEL SECURITY', v_schema_name);

  -- Actualizar el campo schema_name en studios
  UPDATE public.studios SET schema_name = v_schema_name WHERE id = studio_id;

  RAISE NOTICE 'Schema base creado: %', v_schema_name;
END;
$$;

COMMENT ON FUNCTION create_tenant_schema IS
  'Crea el tenant schema base con tablas clients, client_users, vouchers y habilita RLS.';

-- ----------------------------------------------------------------------------
-- 4. extend_tenant_for_reca: Agrega tablas específicas de RECABLIX
-- ----------------------------------------------------------------------------
-- Estructura RECA:
--   - reca_client_data: Datos de monotributo del cliente
--   - reca_transactions: Transacciones de ventas/compras

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

  RAISE NOTICE 'Extendiendo schema % con tablas RECA', v_schema_name;

  -- Verificar que el schema existe (usando alias para evitar confusión con variable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata sch
    WHERE sch.schema_name = v_schema_name
  ) THEN
    RAISE EXCEPTION 'Schema % no existe. Ejecutar create_tenant_schema primero.', v_schema_name;
  END IF;

  -- Tabla reca_client_data (datos de monotributo)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.reca_client_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
      activity VARCHAR(20) DEFAULT ''SERVICIOS'',
      province_code VARCHAR(3) DEFAULT ''901'',
      works_in_rd BOOLEAN DEFAULT false,
      is_retired BOOLEAN DEFAULT false,
      is_exempt BOOLEAN DEFAULT false,
      has_multilateral BOOLEAN DEFAULT false,
      has_local BOOLEAN DEFAULT false,
      is_rented BOOLEAN DEFAULT false,
      dependents SMALLINT DEFAULT 0 CHECK (dependents BETWEEN 0 AND 6),
      local_m2 SMALLINT CHECK (local_m2 >= 0),
      annual_rent DECIMAL(15,2) CHECK (annual_rent >= 0),
      landlord_cuit VARCHAR(13),
      annual_mw SMALLINT CHECK (annual_mw >= 0),
      previous_category CHAR(1) CHECK (previous_category IN (''A'',''B'',''C'',''D'',''E'',''F'',''G'',''H'',''I'',''J'',''K'')),
      previous_fee DECIMAL(15,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT unique_reca_client UNIQUE (client_id)
    )
  ', v_schema_name, v_schema_name);

  -- Índices para reca_client_data
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_client_data_client
    ON %I.reca_client_data(client_id)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_client_data_activity
    ON %I.reca_client_data(activity)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_client_data_province
    ON %I.reca_client_data(province_code)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);

  -- Tabla reca_transactions (ventas/compras)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.reca_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES %I.clients(id) ON DELETE CASCADE,
      transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN (''SALE'', ''PURCHASE'')),
      period VARCHAR(6) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      transaction_date DATE,
      description VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  ', v_schema_name, v_schema_name);

  -- Índices para reca_transactions
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_trans_client
    ON %I.reca_transactions(client_id)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_trans_period
    ON %I.reca_transactions(period)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_trans_type
    ON %I.reca_transactions(transaction_type)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_reca_trans_client_period
    ON %I.reca_transactions(client_id, period)', REPLACE(v_schema_name, 'tenant_', ''), v_schema_name);

  -- Habilitar RLS en las tablas RECA
  EXECUTE format('ALTER TABLE %I.reca_client_data ENABLE ROW LEVEL SECURITY', v_schema_name);
  EXECUTE format('ALTER TABLE %I.reca_transactions ENABLE ROW LEVEL SECURITY', v_schema_name);

  RAISE NOTICE 'Tablas RECA creadas en schema: %', v_schema_name;
END;
$$;

COMMENT ON FUNCTION extend_tenant_for_reca IS
  'Agrega tablas RECA (reca_client_data, reca_transactions) a un tenant schema existente.';

-- ----------------------------------------------------------------------------
-- 5. create_reca_tenant: Wrapper que crea schema completo para RECABLIX
-- ----------------------------------------------------------------------------
-- Ejecuta en orden:
--   1. create_tenant_schema (schema base)
--   2. extend_tenant_for_reca (tablas RECA)

CREATE OR REPLACE FUNCTION create_reca_tenant(p_studio_id UUID)
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

  -- Verificar si el schema ya existe (usando alias para evitar confusión con variable)
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata sch
    WHERE sch.schema_name = v_schema_name
  ) THEN
    RAISE NOTICE 'Schema % ya existe, verificando tablas...', v_schema_name;
  ELSE
    -- Crear schema base
    PERFORM create_tenant_schema(p_studio_id);
  END IF;

  -- Extender con tablas RECA
  PERFORM extend_tenant_for_reca(p_studio_id);

  RAISE NOTICE 'Tenant RECA completo creado: %', v_schema_name;
END;
$$;

COMMENT ON FUNCTION create_reca_tenant IS
  'Crea un tenant schema completo para RECABLIX: schema base + tablas RECA.';

-- ----------------------------------------------------------------------------
-- Agregar columna schema_name a studios si no existe
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'studios'
    AND column_name = 'schema_name'
  ) THEN
    ALTER TABLE public.studios ADD COLUMN schema_name TEXT;
    RAISE NOTICE 'Columna schema_name agregada a studios';
  ELSE
    RAISE NOTICE 'Columna schema_name ya existe en studios';
  END IF;
END;
$$;

-- Índice para schema_name
CREATE INDEX IF NOT EXISTS idx_studios_schema_name ON public.studios(schema_name);

COMMENT ON COLUMN public.studios.schema_name IS
  'Nombre del tenant schema asociado al studio (tenant_xxx)';
