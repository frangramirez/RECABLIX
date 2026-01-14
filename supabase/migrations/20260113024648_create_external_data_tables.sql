-- ============================================
-- FINBLIX - External Data Tables Migration
-- Version: 002
-- Description: Creates tables for exchange rates, market prices, and tax treatments
-- ============================================

-- ============================================
-- EXCHANGE_RATES TABLE (Tipos de Cambio BNA)
-- ============================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  usd_buy DECIMAL(12, 4) NOT NULL,
  usd_sell DECIMAL(12, 4) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'dolarapi',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validaciones basicas
  CONSTRAINT valid_rates CHECK (usd_buy > 0 AND usd_sell > 0 AND usd_sell >= usd_buy)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON public.exchange_rates(date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_source ON public.exchange_rates(source);

-- ============================================
-- MARKET_PRICES TABLE (Cotizaciones de Mercado)
-- ============================================
CREATE TABLE IF NOT EXISTS public.market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  price_usd DECIMAL(18, 6),
  price_ars DECIMAL(18, 6),
  source VARCHAR(50) DEFAULT 'yahoo',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un solo precio por ticker/fecha
  CONSTRAINT unique_ticker_date UNIQUE (ticker, date),
  -- Al menos un precio debe existir
  CONSTRAINT at_least_one_price CHECK (price_usd IS NOT NULL OR price_ars IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_prices_ticker ON public.market_prices(ticker);
CREATE INDEX IF NOT EXISTS idx_market_prices_date ON public.market_prices(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_ticker_date ON public.market_prices(ticker, date DESC);

-- ============================================
-- TAX_TREATMENTS TABLE (Tratamientos Impositivos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tax_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(50) NOT NULL,
  ticker_plus VARCHAR(50) NOT NULL UNIQUE,
  asset_type VARCHAR(20) NOT NULL CHECK (
    asset_type IN ('accion', 'bono', 'cedear', 'fci', 'caucion', 'on', 'etf')
  ),
  origin VARCHAR(20) NOT NULL CHECK (origin IN ('argentina', 'exterior')),
  ig_cv_treatment VARCHAR(255),
  ig_dividend_treatment VARCHAR(255),
  bbpp_treatment VARCHAR(255),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- valid_to debe ser >= valid_from si existe
  CONSTRAINT valid_date_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_treatments_ticker ON public.tax_treatments(ticker);
CREATE INDEX IF NOT EXISTS idx_tax_treatments_ticker_plus ON public.tax_treatments(ticker_plus);
CREATE INDEX IF NOT EXISTS idx_tax_treatments_asset_type ON public.tax_treatments(asset_type);
CREATE INDEX IF NOT EXISTS idx_tax_treatments_origin ON public.tax_treatments(origin);

-- ============================================
-- API_SYNC_LOG TABLE (Log de Sincronizaciones)
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('exchange_rates', 'market_prices')),
  source VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'success', 'partial', 'error')),
  records_synced INTEGER DEFAULT 0,
  date_from DATE,
  date_to DATE,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_api_sync_log_type_date ON public.api_sync_log(sync_type, started_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_sync_log ENABLE ROW LEVEL SECURITY;

-- Exchange rates: Public read for authenticated users
CREATE POLICY "Authenticated users can read exchange rates" ON public.exchange_rates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Market prices: Public read for authenticated users
CREATE POLICY "Authenticated users can read market prices" ON public.market_prices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Tax treatments: Public read for authenticated users
CREATE POLICY "Authenticated users can read tax treatments" ON public.tax_treatments
  FOR SELECT USING (auth.role() = 'authenticated');

-- API sync log: Only readable by authenticated users
CREATE POLICY "Authenticated users can read sync log" ON public.api_sync_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================
CREATE TRIGGER update_tax_treatments_updated_at
  BEFORE UPDATE ON public.tax_treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Common Argentine Tickers
-- ============================================
INSERT INTO public.tax_treatments (ticker, ticker_plus, asset_type, origin, ig_cv_treatment, ig_dividend_treatment, bbpp_treatment, notes)
VALUES
  -- CEDEARs (representan acciones extranjeras)
  ('AAPL', 'CEAAPL', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Apple Inc - CEDEAR'),
  ('GOOGL', 'CEGOOGL', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Alphabet Inc - CEDEAR'),
  ('MSFT', 'CEMSFT', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Microsoft Corp - CEDEAR'),
  ('AMZN', 'CEAMZN', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Amazon.com Inc - CEDEAR'),
  ('TSLA', 'CETSLA', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Tesla Inc - CEDEAR'),
  ('NVDA', 'CENVDA', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'NVIDIA Corp - CEDEAR'),
  ('META', 'CEMETA', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Meta Platforms - CEDEAR'),
  ('MELI', 'CEMELI', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'MercadoLibre - CEDEAR'),
  ('KO', 'CEKO', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Coca-Cola - CEDEAR'),
  ('GLOB', 'CEGLOB', 'cedear', 'argentina', 'Exento Art. 98 inc a)', 'Gravado 7%', 'Exento Art. 21 inc w)', 'Globant - CEDEAR'),

  -- Acciones Argentinas
  ('GGAL', 'GGAL', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Grupo Financiero Galicia'),
  ('YPF', 'YPF', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'YPF SA'),
  ('PAMP', 'PAMP', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Pampa Energia'),
  ('BBAR', 'BBAR', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Banco BBVA Argentina'),
  ('BMA', 'BMA', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Banco Macro'),
  ('SUPV', 'SUPV', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Grupo Supervielle'),
  ('TXAR', 'TXAR', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Ternium Argentina'),
  ('ALUA', 'ALUA', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Aluar'),
  ('CEPU', 'CEPU', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Central Puerto'),
  ('LOMA', 'LOMA', 'accion', 'argentina', 'Exento Art. 98 inc a)', 'Exento Art. 64 inc a)', 'Exento Art. 21 inc w)', 'Loma Negra'),

  -- Bonos Soberanos
  ('AL30', 'AL30', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Ley Argentina 2030'),
  ('GD30', 'GD30', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Global 2030'),
  ('AL35', 'AL35', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Ley Argentina 2035'),
  ('GD35', 'GD35', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Global 2035'),
  ('AL29', 'AL29', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Ley Argentina 2029'),
  ('GD29', 'GD29', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Global 2029'),
  ('AE38', 'AE38', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Ley Argentina 2038'),
  ('GD38', 'GD38', 'bono', 'argentina', 'Exento Art. 98 inc b)', 'Exento Art. 36 bis', 'Exento Art. 21 inc h)', 'Bono Global 2038'),

  -- Acciones Exterior (prefijo AE)
  ('AAPL', 'AEAAPL', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Apple Inc - Exterior'),
  ('TSLA', 'AETSLA', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Tesla Inc - Exterior'),
  ('MSFT', 'AEMSFT', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Microsoft Corp - Exterior'),
  ('GOOGL', 'AEGOOGL', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Alphabet Inc - Exterior'),
  ('AMZN', 'AEAMZN', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Amazon.com Inc - Exterior'),
  ('NVDA', 'AENVDA', 'accion', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'NVIDIA Corp - Exterior'),

  -- ETFs Exterior
  ('SPY', 'AESPY', 'etf', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'SPDR S&P 500 ETF'),
  ('QQQ', 'AEQQQ', 'etf', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Invesco QQQ Trust'),
  ('VOO', 'AEVOO', 'etf', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Vanguard S&P 500 ETF'),
  ('VTI', 'AEVTI', 'etf', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'Vanguard Total Stock Market ETF'),
  ('EEM', 'AEEEM', 'etf', 'exterior', 'Gravado 15%', 'Gravado 7% (neto retencion)', 'Gravado 0.5%', 'iShares MSCI Emerging Markets ETF'),

  -- Cauciones
  ('CAUCION', 'CAUCION', 'caucion', 'argentina', 'Exento Art. 98', 'Exento Art. 36 bis', 'N/A', 'Cauciones bursatiles')
ON CONFLICT (ticker_plus) DO NOTHING;
