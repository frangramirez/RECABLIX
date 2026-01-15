-- Seed completo: Clientes diversos con transacciones para testing
-- Studio: Contablix (4d973279-d551-4032-927e-120a3f02bd27)
-- User: test@contablix.ar (7eb59890-a564-4cd2-9a08-a4fbe39f4fce)

-- ============================================
-- 1. CLIENTES DIVERSOS (5 casos diferentes)
-- ============================================

-- Cliente 1: Servicios Cat C (~18M anual)
INSERT INTO public.clients (id, studio_id, name, cuit, fiscal_year, apps)
VALUES ('cccccccc-0001-0001-0001-000000000001', '4d973279-d551-4032-927e-120a3f02bd27',
  'Juan Perez - Servicios Cat C', '20-12345678-9', 2026, ARRAY['recablix'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuit = EXCLUDED.cuit, apps = EXCLUDED.apps;

-- Cliente 2: Bienes Cat E (~28M anual)
INSERT INTO public.clients (id, studio_id, name, cuit, fiscal_year, apps)
VALUES ('cccccccc-0002-0002-0002-000000000002', '4d973279-d551-4032-927e-120a3f02bd27',
  'Maria Garcia - Bienes Cat E', '27-98765432-1', 2026, ARRAY['recablix'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuit = EXCLUDED.cuit, apps = EXCLUDED.apps;

-- Cliente 3: Solo Locador 2 Inmuebles
INSERT INTO public.clients (id, studio_id, name, cuit, fiscal_year, apps)
VALUES ('cccccccc-0003-0003-0003-000000000003', '4d973279-d551-4032-927e-120a3f02bd27',
  'Pedro Martinez - Locador 2 Inm', '23-11111111-9', 2026, ARRAY['recablix'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuit = EXCLUDED.cuit, apps = EXCLUDED.apps;

-- Cliente 4: Jubilada Cat A
INSERT INTO public.clients (id, studio_id, name, cuit, fiscal_year, apps)
VALUES ('cccccccc-0004-0004-0004-000000000004', '4d973279-d551-4032-927e-120a3f02bd27',
  'Ana Lopez - Jubilada Cat A', '27-22222222-3', 2026, ARRAY['recablix'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuit = EXCLUDED.cuit, apps = EXCLUDED.apps;

-- Cliente 5: Trabaja en RD Cat B
INSERT INTO public.clients (id, studio_id, name, cuit, fiscal_year, apps)
VALUES ('cccccccc-0005-0005-0005-000000000005', '4d973279-d551-4032-927e-120a3f02bd27',
  'Carlos Ruiz - RD Cat B', '20-33333333-7', 2026, ARRAY['recablix'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cuit = EXCLUDED.cuit, apps = EXCLUDED.apps;

-- ============================================
-- 2. DATOS RECABLIX PARA CADA CLIENTE
-- ============================================

INSERT INTO public.reca_client_data (client_id, activity, province_code, works_in_rd, is_retired, dependents, local_m2, annual_rent, annual_mw, previous_category, previous_fee)
VALUES
  -- Juan Perez: Servicios, CABA, local 40m2, alquila
  ('cccccccc-0001-0001-0001-000000000001', 'SERVICIOS', '901', false, false, 2, 40, 500000.00, 4000, 'B', 55000.00),
  -- Maria Garcia: Bienes, Buenos Aires, local grande
  ('cccccccc-0002-0002-0002-000000000002', 'BIENES', '902', false, false, 0, 80, 1200000.00, 8000, 'D', 85000.00),
  -- Pedro Martinez: Solo locador (sin local propio)
  ('cccccccc-0003-0003-0003-000000000003', 'SOLO_LOC_2_INM', '901', false, false, 0, NULL, NULL, NULL, NULL, NULL),
  -- Ana Lopez: Jubilada, Córdoba, local chico
  ('cccccccc-0004-0004-0004-000000000004', 'SERVICIOS', '904', false, true, 0, 25, 200000.00, 2000, 'A', 45000.00),
  -- Carlos Ruiz: RD, Santa Fe
  ('cccccccc-0005-0005-0005-000000000005', 'SERVICIOS', '921', true, false, 3, 30, 300000.00, 3000, 'A', 12000.00)
ON CONFLICT (client_id) DO UPDATE SET
  activity = EXCLUDED.activity,
  province_code = EXCLUDED.province_code,
  works_in_rd = EXCLUDED.works_in_rd,
  is_retired = EXCLUDED.is_retired,
  dependents = EXCLUDED.dependents,
  local_m2 = EXCLUDED.local_m2,
  annual_rent = EXCLUDED.annual_rent,
  annual_mw = EXCLUDED.annual_mw,
  previous_category = EXCLUDED.previous_category,
  previous_fee = EXCLUDED.previous_fee;

-- ============================================
-- 3. TRANSACCIONES (12 meses - 2025)
-- ============================================

-- Limpiar transacciones previas de estos clientes para evitar duplicados
DELETE FROM public.reca_transactions WHERE client_id IN (
  'cccccccc-0001-0001-0001-000000000001',
  'cccccccc-0002-0002-0002-000000000002',
  'cccccccc-0003-0003-0003-000000000003',
  'cccccccc-0004-0004-0004-000000000004',
  'cccccccc-0005-0005-0005-000000000005'
);

-- Juan Perez: ~18M anual (Cat C)
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount, description)
VALUES
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202501', 1500000.00, 'Honorarios enero'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202502', 1400000.00, 'Honorarios febrero'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202503', 1600000.00, 'Honorarios marzo'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202504', 1500000.00, 'Honorarios abril'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202505', 1550000.00, 'Honorarios mayo'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202506', 1600000.00, 'Honorarios junio'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202507', 1500000.00, 'Honorarios julio'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202508', 1450000.00, 'Honorarios agosto'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202509', 1600000.00, 'Honorarios septiembre'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202510', 1700000.00, 'Honorarios octubre'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202511', 1500000.00, 'Honorarios noviembre'),
  ('cccccccc-0001-0001-0001-000000000001', 'SALE', '202512', 1100000.00, 'Honorarios diciembre');

-- Maria Garcia: ~28M anual (Cat E)
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount, description)
VALUES
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202501', 2300000.00, 'Ventas enero'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202502', 2200000.00, 'Ventas febrero'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202503', 2400000.00, 'Ventas marzo'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202504', 2350000.00, 'Ventas abril'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202505', 2300000.00, 'Ventas mayo'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202506', 2500000.00, 'Ventas junio'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202507', 2400000.00, 'Ventas julio'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202508', 2350000.00, 'Ventas agosto'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202509', 2200000.00, 'Ventas septiembre'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202510', 2500000.00, 'Ventas octubre'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202511', 2300000.00, 'Ventas noviembre'),
  ('cccccccc-0002-0002-0002-000000000002', 'SALE', '202512', 2200000.00, 'Ventas diciembre');

-- Pedro Martinez: Solo locador (~5.4M anual)
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount, description)
VALUES
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202501', 450000.00, 'Alquiler enero'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202502', 450000.00, 'Alquiler febrero'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202503', 450000.00, 'Alquiler marzo'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202504', 450000.00, 'Alquiler abril'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202505', 450000.00, 'Alquiler mayo'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202506', 450000.00, 'Alquiler junio'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202507', 450000.00, 'Alquiler julio'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202508', 450000.00, 'Alquiler agosto'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202509', 450000.00, 'Alquiler septiembre'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202510', 450000.00, 'Alquiler octubre'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202511', 450000.00, 'Alquiler noviembre'),
  ('cccccccc-0003-0003-0003-000000000003', 'SALE', '202512', 450000.00, 'Alquiler diciembre');

-- Ana Lopez: Jubilada (~8.4M anual, Cat A)
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount, description)
VALUES
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202501', 700000.00, 'Honorarios enero'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202502', 700000.00, 'Honorarios febrero'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202503', 700000.00, 'Honorarios marzo'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202504', 700000.00, 'Honorarios abril'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202505', 700000.00, 'Honorarios mayo'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202506', 700000.00, 'Honorarios junio'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202507', 700000.00, 'Honorarios julio'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202508', 700000.00, 'Honorarios agosto'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202509', 700000.00, 'Honorarios septiembre'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202510', 700000.00, 'Honorarios octubre'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202511', 700000.00, 'Honorarios noviembre'),
  ('cccccccc-0004-0004-0004-000000000004', 'SALE', '202512', 700000.00, 'Honorarios diciembre');

-- Carlos Ruiz: RD (~12M anual, Cat B)
INSERT INTO public.reca_transactions (client_id, transaction_type, period, amount, description)
VALUES
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202501', 1000000.00, 'Honorarios enero'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202502', 1000000.00, 'Honorarios febrero'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202503', 1000000.00, 'Honorarios marzo'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202504', 1000000.00, 'Honorarios abril'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202505', 1000000.00, 'Honorarios mayo'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202506', 1000000.00, 'Honorarios junio'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202507', 1000000.00, 'Honorarios julio'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202508', 1000000.00, 'Honorarios agosto'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202509', 1000000.00, 'Honorarios septiembre'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202510', 1000000.00, 'Honorarios octubre'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202511', 1000000.00, 'Honorarios noviembre'),
  ('cccccccc-0005-0005-0005-000000000005', 'SALE', '202512', 1000000.00, 'Honorarios diciembre');

-- ============================================
-- 4. VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  v_clients INT;
  v_reca_data INT;
  v_transactions INT;
BEGIN
  SELECT COUNT(*) INTO v_clients FROM public.clients WHERE id LIKE 'cccccccc%';
  SELECT COUNT(*) INTO v_reca_data FROM public.reca_client_data WHERE client_id LIKE 'cccccccc%';
  SELECT COUNT(*) INTO v_transactions FROM public.reca_transactions WHERE client_id LIKE 'cccccccc%';

  RAISE NOTICE 'Seed completado:';
  RAISE NOTICE '  - Clientes: %', v_clients;
  RAISE NOTICE '  - Datos RECABLIX: %', v_reca_data;
  RAISE NOTICE '  - Transacciones: %', v_transactions;
END $$;
