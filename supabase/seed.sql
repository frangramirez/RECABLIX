-- EPIC-01-S10: Seeds con datos de ejemplo
-- Ejecutar después de aplicar todas las migraciones

-- Limpiar datos existentes (en orden de dependencias)
TRUNCATE transactions, clients, studios, fee_components, scales, reca_periods CASCADE;

-- 1. Período de recategorización activo (RECA 261)
INSERT INTO reca_periods (id, code, year, semester, sales_period_start, sales_period_end, fee_period_start, fee_period_end, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', '261', 2026, 1, '202501', '202512', '202602', '202607', true);

-- 2. Escalas para RECA 261 (valores reales enero 2026)
INSERT INTO scales (reca_id, category, max_annual_income, max_local_m2, max_annual_mw, max_annual_rent, max_unit_sale) VALUES
('11111111-1111-1111-1111-111111111111', 'A', 10206600.00, 30, 3330, 2373628.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'B', 14953850.00, 45, 5000, 2373628.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'C', 20967040.00, 60, 6700, 3243958.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'D', 26030780.00, 85, 10000, 3243958.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'E', 30619800.00, 110, 13000, 4114288.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'F', 38373650.00, 150, 16500, 4114288.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'G', 45890130.00, 200, 20000, 4905497.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'H', 69626410.00, 200, 20000, 7120883.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'I', 77934110.00, 200, 20000, 7120883.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'J', 89248400.00, 200, 20000, 7120883.00, 609231.08),
('11111111-1111-1111-1111-111111111111', 'K', 107604500.00, 200, 20000, 7120883.00, 609231.08);

-- 3. Componentes de cuota - Impositivo BIENES (B20)
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value) VALUES
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'A', 4747.251),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'B', 9019.788),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'C', 14241.764),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'D', 23578.036),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'E', 37661.559),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'F', 49054.972),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'G', 60764.858),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'H', 174066.018),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'I', 276923.213),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'J', 332307.865),
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'K', 399969.438);

-- Componentes Impositivo SERVICIOS (S20)
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value) VALUES
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'A', 7596.402),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'B', 14231.660),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'C', 23577.987),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'D', 37661.559),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'E', 60764.866),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'F', 84917.685),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'G', 113223.607),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'H', 267230.176),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'I', 432384.397),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'J', 518861.284),
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'K', 622633.548);

-- Componentes Jubilatorio NO jubilado (021)
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value) VALUES
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'A', 13663.17),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'B', 15029.48),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'C', 16532.43),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'D', 18185.68),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'E', 20004.24),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'F', 22004.67),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'G', 24205.13),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'H', 26625.65),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'I', 29288.21),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'J', 32217.03),
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'K', 35438.74);

-- Componente Jubilatorio JUBILADO (21J) - valor fijo mínimo para todas las categorías
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value)
SELECT '11111111-1111-1111-1111-111111111111', '21J', 'JUB-Jubilado', 'JUB', cat, 13663.17
FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K']) AS cat;

-- Componentes Obra Social (024)
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value) VALUES
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'A', 31437.374),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'B', 31437.374),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'C', 31437.374),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'D', 34581.111),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'E', 38039.222),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'F', 41843.145),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'G', 46027.459),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'H', 50630.205),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'I', 55693.226),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'J', 61262.548),
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'K', 67388.803);

-- IIBB CABA (901)
INSERT INTO fee_components (reca_id, component_code, description, component_type, category, value, province_code, has_municipal)
SELECT '11111111-1111-1111-1111-111111111111', '901', 'IIBB CABA', 'IBP', cat, 0, '901', false
FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K']) AS cat;

-- 4. Studio de prueba (SuperAdmin)
INSERT INTO studios (id, name, email, is_superadmin, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', 'Contablix', 'framirez@contablix.ar', true, true);

-- Studio demo (normal)
INSERT INTO studios (id, name, email, is_superadmin, is_active)
VALUES ('33333333-3333-3333-3333-333333333333', 'Estudio Demo', 'demo@ejemplo.com', false, true);

-- 5. Clientes de prueba
INSERT INTO clients (id, studio_id, name, cuit, activity, province_code, works_in_rd, is_retired, dependents, local_m2, annual_rent, annual_mw, previous_category, previous_fee)
VALUES
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Agustina Ollivier', '20-37203648-7', 'BIENES', '904', false, true, 2, 65, 7000000, 2500, 'F', 125000),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Brenda Luka', '27-12345678-9', 'SERVICIOS', '901', false, false, 1, NULL, NULL, NULL, 'A', 52697),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'Carlos Szechet', '20-98765432-1', 'LOCACION', '913', true, false, 0, 100, 5000000, NULL, 'D', 61824);

-- 6. Transacciones de prueba (ventas del período 261)
INSERT INTO transactions (client_id, transaction_type, period, amount, transaction_date, description) VALUES
-- Agustina: ventas altas
('44444444-4444-4444-4444-444444444444', 'SALE', '202510', 1500000, '2025-10-17', 'Venta octubre'),
('44444444-4444-4444-4444-444444444444', 'SALE', '202511', 9000000, '2025-11-17', 'Venta noviembre'),
('44444444-4444-4444-4444-444444444444', 'PURCHASE', '202511', 70000, '2025-11-17', 'Compra noviembre'),
('44444444-4444-4444-4444-444444444444', 'SALE', '202512', 9000000, '2025-12-12', 'Venta diciembre'),
('44444444-4444-4444-4444-444444444444', 'SALE', '202512', -20000, '2025-12-14', 'NC diciembre'),
-- Brenda: ventas bajas
('55555555-5555-5555-5555-555555555555', 'SALE', '202510', 500000, '2025-10-15', 'Honorarios oct'),
('55555555-5555-5555-5555-555555555555', 'SALE', '202511', 600000, '2025-11-15', 'Honorarios nov'),
('55555555-5555-5555-5555-555555555555', 'SALE', '202512', 550000, '2025-12-15', 'Honorarios dic'),
-- Carlos: ventas medias
('66666666-6666-6666-6666-666666666666', 'SALE', '202510', 2000000, '2025-10-01', 'Alquiler oct'),
('66666666-6666-6666-6666-666666666666', 'SALE', '202511', 2000000, '2025-11-01', 'Alquiler nov'),
('66666666-6666-6666-6666-666666666666', 'SALE', '202512', 2000000, '2025-12-01', 'Alquiler dic');

-- Verificación
DO $$
BEGIN
  RAISE NOTICE 'Seeds completados:';
  RAISE NOTICE '  - Períodos: %', (SELECT COUNT(*) FROM reca_periods);
  RAISE NOTICE '  - Escalas: %', (SELECT COUNT(*) FROM scales);
  RAISE NOTICE '  - Componentes: %', (SELECT COUNT(*) FROM fee_components);
  RAISE NOTICE '  - Studios: %', (SELECT COUNT(*) FROM studios);
  RAISE NOTICE '  - Clientes: %', (SELECT COUNT(*) FROM clients);
  RAISE NOTICE '  - Transacciones: %', (SELECT COUNT(*) FROM transactions);
END $$;
