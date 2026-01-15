-- FASE 1: Seed de Public Schema para Migración
-- Crea tablas en public schema (si no existen) y las pobla con datos
-- Esto simula el estado de producción (FINBLIX) antes de la migración a tenant schemas

-- 1. Tabla clients en public (si no existe)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  cuit VARCHAR(13),
  email VARCHAR(255),
  phone VARCHAR(50),
  fiscal_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  apps VARCHAR(20)[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_studio ON public.clients(studio_id);
CREATE INDEX IF NOT EXISTS idx_clients_apps ON public.clients USING GIN(apps);

-- 2. Tabla reca_client_data en public (si no existe)
CREATE TABLE IF NOT EXISTS public.reca_client_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  activity VARCHAR(20) DEFAULT 'SERVICIOS',
  province_code VARCHAR(3) DEFAULT '901',
  works_in_rd BOOLEAN DEFAULT false,
  is_retired BOOLEAN DEFAULT false,
  is_exempt BOOLEAN DEFAULT false,
  has_multilateral BOOLEAN DEFAULT false,
  has_local BOOLEAN DEFAULT false,
  is_rented BOOLEAN DEFAULT false,
  dependents SMALLINT DEFAULT 0 CHECK (dependents >= 0 AND dependents <= 6),
  local_m2 SMALLINT CHECK (local_m2 >= 0),
  annual_rent DECIMAL(15,2) CHECK (annual_rent >= 0),
  landlord_cuit VARCHAR(13),
  annual_mw SMALLINT CHECK (annual_mw >= 0),
  previous_category CHAR(1) CHECK (previous_category IN ('A','B','C','D','E','F','G','H','I','J','K')),
  previous_fee DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_client_reca UNIQUE (client_id)
);

-- 3. Tabla reca_transactions en public (si no existe)
CREATE TABLE IF NOT EXISTS public.reca_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('SALE', 'PURCHASE')),
  period VARCHAR(6) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE,
  description VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reca_tx_client ON public.reca_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_reca_tx_period ON public.reca_transactions(period);

-- 4. Insertar datos seed para migración
-- Studio PRD3 Test ya existe: a1b2c3d4-e5f6-7890-abcd-ef1234567890

-- Clientes en public schema
INSERT INTO public.clients (id, studio_id, name, cuit, apps, is_active)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Cliente Public 1', '20-12345678-9', ARRAY['recablix'], true),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Cliente Public 2', '27-98765432-1', ARRAY['recablix'], true),
  ('aaaaaaaa-3333-3333-3333-333333333333', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Cliente Public 3', '23-11111111-9', ARRAY['finblix'], true)
ON CONFLICT (id) DO NOTHING;

-- Datos RECA para clientes 1 y 2
INSERT INTO public.reca_client_data (client_id, activity, province_code, previous_category)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'SERVICIOS', '901', 'B'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'BIENES', '902', 'D')
ON CONFLICT (client_id) DO NOTHING;

-- Transacciones para clientes 1 y 2
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'SALE', '202501', 1500000),
  ('aaaaaaaa-1111-1111-1111-111111111111', 'SALE', '202502', 1600000),
  ('aaaaaaaa-1111-1111-1111-111111111111', 'SALE', '202503', 1550000),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'SALE', '202501', 2500000),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'SALE', '202502', 2600000)
ON CONFLICT (id) DO NOTHING;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '=== FASE 1: Datos seed en public schema ===';
  RAISE NOTICE 'Clientes: %', (SELECT COUNT(*) FROM public.clients);
  RAISE NOTICE 'Reca client data: %', (SELECT COUNT(*) FROM public.reca_client_data);
  RAISE NOTICE 'Reca transactions: %', (SELECT COUNT(*) FROM public.reca_transactions);
  RAISE NOTICE '';
  RAISE NOTICE 'Desglose por apps:';
  RAISE NOTICE '- RECABLIX: %', (SELECT COUNT(*) FROM public.clients WHERE ''recablix'' = ANY(apps));
  RAISE NOTICE '- FINBLIX: %', (SELECT COUNT(*) FROM public.clients WHERE ''finblix'' = ANY(apps));
END $$;
