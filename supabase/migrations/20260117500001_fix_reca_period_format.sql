-- Migration: Fix reca_periods date range
-- Problem: sales_period_start/end (DATE columns) had incorrect range (Jul-Dec instead of Jan-Dec)
--          reca_transactions.period uses YYYYMM varchar format
--          Frontend normalizes DATE to YYYYMM for comparison
-- Solution: Update reca_periods to cover full year range

-- Update RECA-261 to full year range (was Jul-Dec, should be Jan-Dec)
UPDATE public.reca_periods
SET
  sales_period_start = '2025-01-01'::date,
  sales_period_end = '2025-12-31'::date
WHERE code = 'RECA-261' AND is_active = true;

-- Add comments to clarify the date-to-YYYYMM conversion happens in frontend
COMMENT ON COLUMN public.reca_periods.sales_period_start IS 'Start date for sales aggregation period. Frontend converts to YYYYMM for comparison with reca_transactions.period';
COMMENT ON COLUMN public.reca_periods.sales_period_end IS 'End date for sales aggregation period. Frontend converts to YYYYMM for comparison with reca_transactions.period';
