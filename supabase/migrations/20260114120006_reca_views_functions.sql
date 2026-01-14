-- EPIC-01-S08/S09: Vistas y funciones de cálculo para RECABLIX

-- Vista de totales por cliente y período
CREATE OR REPLACE VIEW public.reca_client_period_totals AS
SELECT
  t.client_id,
  t.period,
  SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END) AS total_sales,
  SUM(CASE WHEN t.transaction_type = 'PURCHASE' THEN t.amount ELSE 0 END) AS total_purchases
FROM public.reca_transactions t
GROUP BY t.client_id, t.period;

-- Función para obtener totales en rango de períodos
CREATE OR REPLACE FUNCTION reca_get_client_totals(
  p_client_id UUID,
  p_period_start VARCHAR(6),
  p_period_end VARCHAR(6)
)
RETURNS TABLE (
  total_sales DECIMAL(15,2),
  total_purchases DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END), 0)::DECIMAL(15,2),
    COALESCE(SUM(CASE WHEN t.transaction_type = 'PURCHASE' THEN t.amount ELSE 0 END), 0)::DECIMAL(15,2)
  FROM public.reca_transactions t
  WHERE t.client_id = p_client_id
    AND t.period >= p_period_start
    AND t.period <= p_period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para determinar categoría por parámetro
CREATE OR REPLACE FUNCTION reca_get_category_for_value(
  p_reca_id UUID,
  p_value DECIMAL,
  p_param_type VARCHAR(10) -- 'income', 'm2', 'mw', 'rent'
)
RETURNS CHAR(1) AS $$
DECLARE
  v_category CHAR(1);
BEGIN
  SELECT s.category INTO v_category
  FROM public.reca_scales s
  WHERE s.reca_id = p_reca_id
    AND CASE p_param_type
      WHEN 'income' THEN s.max_annual_income >= p_value
      WHEN 'm2' THEN s.max_local_m2 >= p_value
      WHEN 'mw' THEN s.max_annual_mw >= p_value
      WHEN 'rent' THEN s.max_annual_rent >= p_value
    END
  ORDER BY
    CASE p_param_type
      WHEN 'income' THEN s.max_annual_income
      WHEN 'm2' THEN s.max_local_m2
      WHEN 'mw' THEN s.max_annual_mw
      WHEN 'rent' THEN s.max_annual_rent
    END ASC
  LIMIT 1;

  RETURN COALESCE(v_category, 'K');
END;
$$ LANGUAGE plpgsql;

-- Función para obtener categoría máxima
CREATE OR REPLACE FUNCTION reca_max_category(categories CHAR[])
RETURNS CHAR(1) AS $$
DECLARE
  cat_order VARCHAR(11) := 'ABCDEFGHIJK';
  max_idx INT := 1;
  curr_idx INT;
  cat CHAR(1);
BEGIN
  FOREACH cat IN ARRAY categories
  LOOP
    IF cat IS NOT NULL THEN
      curr_idx := POSITION(cat IN cat_order);
      IF curr_idx > max_idx THEN
        max_idx := curr_idx;
      END IF;
    END IF;
  END LOOP;
  RETURN SUBSTRING(cat_order FROM max_idx FOR 1);
END;
$$ LANGUAGE plpgsql;

-- Vista de resultados de recategorización (JOIN con tabla clients de FINBLIX)
CREATE OR REPLACE VIEW public.reca_results AS
WITH client_data AS (
  SELECT
    c.id AS client_id,
    c.studio_id,
    c.name,
    c.cuit,
    rcd.activity,
    rcd.province_code,
    rcd.works_in_rd,
    rcd.is_retired,
    rcd.dependents,
    rcd.local_m2,
    rcd.annual_rent,
    rcd.annual_mw,
    rcd.previous_category,
    rcd.previous_fee,
    rp.id AS reca_id,
    rp.code AS reca_code,
    rp.sales_period_start,
    rp.sales_period_end
  FROM public.clients c
  JOIN public.reca_client_data rcd ON rcd.client_id = c.id
  CROSS JOIN public.reca_periods rp
  WHERE rp.is_active = true
    AND 'recablix' = ANY(c.apps)
),
with_sales AS (
  SELECT
    cd.*,
    COALESCE((
      SELECT SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END)
      FROM public.reca_transactions t
      WHERE t.client_id = cd.client_id
        AND t.period >= cd.sales_period_start
        AND t.period <= cd.sales_period_end
    ), 0) AS period_sales
  FROM client_data cd
)
SELECT
  ws.*,
  reca_get_category_for_value(ws.reca_id, ws.period_sales, 'income') AS cat_by_income,
  reca_get_category_for_value(ws.reca_id, COALESCE(ws.local_m2, 0)::DECIMAL, 'm2') AS cat_by_m2,
  reca_get_category_for_value(ws.reca_id, COALESCE(ws.annual_mw, 0)::DECIMAL, 'mw') AS cat_by_mw,
  reca_get_category_for_value(ws.reca_id, COALESCE(ws.annual_rent, 0), 'rent') AS cat_by_rent,
  reca_max_category(ARRAY[
    reca_get_category_for_value(ws.reca_id, ws.period_sales, 'income'),
    reca_get_category_for_value(ws.reca_id, COALESCE(ws.local_m2, 0)::DECIMAL, 'm2'),
    reca_get_category_for_value(ws.reca_id, COALESCE(ws.annual_mw, 0)::DECIMAL, 'mw'),
    reca_get_category_for_value(ws.reca_id, COALESCE(ws.annual_rent, 0), 'rent')
  ]) AS new_category
FROM with_sales ws;

-- Comentario
COMMENT ON VIEW public.reca_results IS 'RECABLIX: Vista de resultados de recategorización con categoría calculada';
