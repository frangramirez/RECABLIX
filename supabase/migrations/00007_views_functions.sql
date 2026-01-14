-- EPIC-01-S08 y S09: Vistas y funciones de cálculo

-- Vista de totales por cliente y período
CREATE OR REPLACE VIEW client_period_totals AS
SELECT
  t.client_id,
  t.period,
  SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END) AS total_sales,
  SUM(CASE WHEN t.transaction_type = 'PURCHASE' THEN t.amount ELSE 0 END) AS total_purchases
FROM transactions t
GROUP BY t.client_id, t.period;

-- Función para obtener totales de un cliente en un rango de períodos
CREATE OR REPLACE FUNCTION get_client_totals_for_reca(
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
    COALESCE(SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END), 0) AS total_sales,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'PURCHASE' THEN t.amount ELSE 0 END), 0) AS total_purchases
  FROM transactions t
  WHERE t.client_id = p_client_id
    AND t.period >= p_period_start
    AND t.period <= p_period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para determinar categoría por parámetro
CREATE OR REPLACE FUNCTION get_category_for_value(
  p_reca_id UUID,
  p_value DECIMAL,
  p_param_type VARCHAR(10) -- 'income', 'm2', 'mw', 'rent'
)
RETURNS CHAR(1) AS $$
DECLARE
  v_category CHAR(1);
BEGIN
  SELECT s.category INTO v_category
  FROM scales s
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

  -- Si excede todas las categorías, retorna K
  RETURN COALESCE(v_category, 'K');
END;
$$ LANGUAGE plpgsql;

-- Función para comparar categorías y obtener la mayor
CREATE OR REPLACE FUNCTION max_category(categories CHAR[])
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

-- Vista de resultados de recategorización
CREATE OR REPLACE VIEW recategorization_results AS
WITH client_sales AS (
  SELECT
    c.id AS client_id,
    c.studio_id,
    c.name,
    c.cuit,
    c.activity,
    c.province_code,
    c.works_in_rd,
    c.is_retired,
    c.dependents,
    c.local_m2,
    c.annual_rent,
    c.annual_mw,
    c.previous_category,
    c.previous_fee,
    rp.id AS reca_id,
    rp.code AS reca_code,
    COALESCE((
      SELECT SUM(CASE WHEN t.transaction_type = 'SALE' THEN t.amount ELSE 0 END)
      FROM transactions t
      WHERE t.client_id = c.id
        AND t.period >= rp.sales_period_start
        AND t.period <= rp.sales_period_end
    ), 0) AS period_sales
  FROM clients c
  CROSS JOIN reca_periods rp
  WHERE rp.is_active = true
    AND c.is_active = true
)
SELECT
  cs.*,
  get_category_for_value(cs.reca_id, cs.period_sales, 'income') AS cat_by_income,
  get_category_for_value(cs.reca_id, COALESCE(cs.local_m2, 0)::DECIMAL, 'm2') AS cat_by_m2,
  get_category_for_value(cs.reca_id, COALESCE(cs.annual_mw, 0)::DECIMAL, 'mw') AS cat_by_mw,
  get_category_for_value(cs.reca_id, COALESCE(cs.annual_rent, 0), 'rent') AS cat_by_rent,
  max_category(ARRAY[
    get_category_for_value(cs.reca_id, cs.period_sales, 'income'),
    get_category_for_value(cs.reca_id, COALESCE(cs.local_m2, 0)::DECIMAL, 'm2'),
    get_category_for_value(cs.reca_id, COALESCE(cs.annual_mw, 0)::DECIMAL, 'mw'),
    get_category_for_value(cs.reca_id, COALESCE(cs.annual_rent, 0), 'rent')
  ]) AS new_category
FROM client_sales cs;

-- Comentario
COMMENT ON VIEW recategorization_results IS 'Vista con cálculo de nueva categoría para cada cliente basado en el período de reca activo';
