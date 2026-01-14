-- EPIC-01-S10: Datos iniciales para RECABLIX
-- Migración idempotente: usa ON CONFLICT para evitar duplicados

-- 1. Período de recategorización activo (RECA 261)
INSERT INTO public.reca_periods (id, code, year, semester, sales_period_start, sales_period_end, fee_period_start, fee_period_end, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', '261', 2026, 1, '202501', '202512', '202602', '202607', true)
ON CONFLICT (code) DO UPDATE SET
  year = EXCLUDED.year,
  semester = EXCLUDED.semester,
  sales_period_start = EXCLUDED.sales_period_start,
  sales_period_end = EXCLUDED.sales_period_end,
  fee_period_start = EXCLUDED.fee_period_start,
  fee_period_end = EXCLUDED.fee_period_end,
  is_active = EXCLUDED.is_active;

-- 2. Escalas para RECA 261 (11 categorías A-K)
INSERT INTO public.reca_scales (reca_id, category, max_annual_income, max_local_m2, max_annual_mw, max_annual_rent, max_unit_sale) VALUES
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
('11111111-1111-1111-1111-111111111111', 'K', 107604500.00, 200, 20000, 7120883.00, 609231.08)
ON CONFLICT (reca_id, category) DO UPDATE SET
  max_annual_income = EXCLUDED.max_annual_income,
  max_local_m2 = EXCLUDED.max_local_m2,
  max_annual_mw = EXCLUDED.max_annual_mw,
  max_annual_rent = EXCLUDED.max_annual_rent,
  max_unit_sale = EXCLUDED.max_unit_sale;

-- 3. Componentes: Impositivo BIENES (B20)
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value) VALUES
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
('11111111-1111-1111-1111-111111111111', 'B20', 'IMP-Bienes', 'IMP', 'K', 399969.438)
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 4. Componentes: Impositivo SERVICIOS (S20)
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value) VALUES
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
('11111111-1111-1111-1111-111111111111', 'S20', 'IMP-Servicios', 'IMP', 'K', 622633.548)
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 5. Componentes: Jubilatorio NO jubilado (021)
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value) VALUES
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
('11111111-1111-1111-1111-111111111111', '021', 'JUB-Aporta', 'JUB', 'K', 35438.74)
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 6. Componentes: Jubilatorio JUBILADO (21J) - valor fijo para todas las categorías
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value)
SELECT '11111111-1111-1111-1111-111111111111', '21J', 'JUB-Jubilado', 'JUB', cat, 13663.17
FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K']) AS cat
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 7. Componentes: Obra Social (024)
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value) VALUES
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
('11111111-1111-1111-1111-111111111111', '024', 'Obra Social', 'OS', 'K', 67388.803)
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 8. Componentes: IIBB CABA (901) - $0 para todas las categorías
INSERT INTO public.reca_fee_components (reca_id, component_code, description, component_type, category, value, province_code, has_municipal)
SELECT '11111111-1111-1111-1111-111111111111', '901', 'IIBB CABA', 'IBP', cat, 0, '901', false
FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K']) AS cat
ON CONFLICT (reca_id, component_code, category) DO UPDATE SET
  value = EXCLUDED.value,
  province_code = EXCLUDED.province_code,
  has_municipal = EXCLUDED.has_municipal;
