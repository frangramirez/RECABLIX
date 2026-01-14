-- ============================================
-- FINBLIX - Core Tables Migration
-- Version: 001
-- Description: Creates all core tables for client management and import system
-- ============================================

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cuit VARCHAR(13),
  email VARCHAR(255),
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- CUIT format validation: XX-XXXXXXXX-X
  CONSTRAINT valid_cuit_format CHECK (
    cuit IS NULL OR
    cuit ~ '^\d{2}-\d{8}-\d{1}$'
  ),

  -- Unique CUIT per studio (allow NULL)
  CONSTRAINT unique_cuit_per_studio UNIQUE NULLS NOT DISTINCT (studio_id, cuit)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_studio_id ON public.clients(studio_id);
CREATE INDEX IF NOT EXISTS idx_clients_fiscal_year ON public.clients(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients USING gin(to_tsvector('spanish', name));

-- ============================================
-- CASH_ACCOUNTS TABLE (Movimientos Monetarios)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  broker_code VARCHAR(50) NOT NULL,
  is_foreign BOOLEAN NOT NULL DEFAULT false,
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('ARS', 'USD_MEP', 'USD_CCL')),
  date DATE NOT NULL,
  concept TEXT,
  reference VARCHAR(255),
  debit DECIMAL(18, 2) NOT NULL DEFAULT 0,
  credit DECIMAL(18, 2) NOT NULL DEFAULT 0,
  balance DECIMAL(18, 2),
  counterpart_ticker VARCHAR(50),
  tc_bna DECIMAL(12, 4),
  raw_data JSONB,
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_accounts_client_id ON public.cash_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_date ON public.cash_accounts(date);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_batch ON public.cash_accounts(import_batch_id);

-- ============================================
-- SECURITIES_ACCOUNTS TABLE (Movimientos de Títulos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.securities_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  broker_code VARCHAR(50) NOT NULL,
  is_foreign BOOLEAN NOT NULL DEFAULT false,
  date DATE NOT NULL,
  settlement_date DATE,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('compra', 'venta', 'dividendo', 'renta', 'split', 'transferencia')),
  ticker VARCHAR(50) NOT NULL,
  ticker_plus VARCHAR(50),
  quantity DECIMAL(18, 8),
  unit_price_original DECIMAL(18, 6),
  currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
  unit_price_ars DECIMAL(18, 6),
  total_original DECIMAL(18, 2),
  total_ars DECIMAL(18, 2),
  fees DECIMAL(18, 2) NOT NULL DEFAULT 0,
  tc_bna DECIMAL(12, 4),
  raw_data JSONB,
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_securities_accounts_client_id ON public.securities_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_securities_accounts_date ON public.securities_accounts(date);
CREATE INDEX IF NOT EXISTS idx_securities_accounts_ticker ON public.securities_accounts(ticker);
CREATE INDEX IF NOT EXISTS idx_securities_accounts_ticker_plus ON public.securities_accounts(ticker_plus);
CREATE INDEX IF NOT EXISTS idx_securities_accounts_batch ON public.securities_accounts(import_batch_id);

-- ============================================
-- IMPORT_BUFFER TABLE (Staging para Preview)
-- ============================================
CREATE TABLE IF NOT EXISTS public.import_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  table_target VARCHAR(50) NOT NULL CHECK (table_target IN ('cash_accounts', 'securities_accounts')),
  row_data JSONB NOT NULL,
  row_number INTEGER,
  validation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'warning', 'error')),
  validation_messages JSONB DEFAULT '[]'::jsonb,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_buffer_client_id ON public.import_buffer(client_id);
CREATE INDEX IF NOT EXISTS idx_import_buffer_batch_id ON public.import_buffer(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_buffer_status ON public.import_buffer(validation_status);

-- ============================================
-- CLIENT_WARNINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  warning_type VARCHAR(50) NOT NULL CHECK (warning_type IN ('missing_account', 'price_discrepancy', 'unmatched_operation', 'unknown_ticker')),
  severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  context JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_warnings_client_id ON public.client_warnings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_warnings_unresolved ON public.client_warnings(client_id) WHERE is_resolved = false;

-- ============================================
-- BROKER_TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.broker_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name VARCHAR(100) NOT NULL,
  broker_code VARCHAR(50) NOT NULL,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('cuenta_monetaria', 'cuenta_titulos')),
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  parsing_rules JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique broker + type combination
  CONSTRAINT unique_broker_template UNIQUE (broker_code, template_type)
);

-- ============================================
-- FIFO_LOTS TABLE (Para cálculo FIFO)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fifo_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticker_plus VARCHAR(50) NOT NULL,
  purchase_date DATE NOT NULL,
  original_quantity DECIMAL(18, 8) NOT NULL,
  remaining_quantity DECIMAL(18, 8) NOT NULL,
  unit_cost_usd DECIMAL(18, 6) NOT NULL,
  unit_cost_ars DECIMAL(18, 6) NOT NULL,
  tc_at_purchase DECIMAL(12, 4),
  source_operation_id UUID REFERENCES public.securities_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fifo_lots_client_id ON public.fifo_lots(client_id);
CREATE INDEX IF NOT EXISTS idx_fifo_lots_ticker ON public.fifo_lots(ticker_plus);
CREATE INDEX IF NOT EXISTS idx_fifo_lots_available ON public.fifo_lots(client_id, ticker_plus) WHERE remaining_quantity > 0;

-- ============================================
-- DETERMINATIONS TABLE (Resultados Calculados)
-- ============================================
CREATE TABLE IF NOT EXISTS public.determinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  ticker VARCHAR(50) NOT NULL,
  ticker_plus VARCHAR(50) NOT NULL,

  -- Posición inicial
  initial_quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  initial_cost_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  initial_cost_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,

  -- Movimientos del período
  purchases_quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  purchases_cost_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  purchases_cost_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,

  sales_quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  sales_proceeds_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  sales_proceeds_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,
  sales_cost_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  sales_cost_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,

  -- Resultados
  realized_gain_loss_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  realized_gain_loss_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,
  exchange_difference DECIMAL(18, 2) NOT NULL DEFAULT 0,

  -- Dividendos/Rendimientos
  dividends_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  dividends_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,
  withholding_tax DECIMAL(18, 2) NOT NULL DEFAULT 0,

  -- Posición final
  final_quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  final_cost_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
  final_cost_ars DECIMAL(18, 2) NOT NULL DEFAULT 0,
  final_market_value_usd DECIMAL(18, 2),
  final_market_value_ars DECIMAL(18, 2),
  unrealized_gain_loss DECIMAL(18, 2),

  -- Tratamiento impositivo
  ig_treatment VARCHAR(100),
  bbpp_treatment VARCHAR(100),

  -- Validaciones
  is_balanced BOOLEAN,
  balance_diff DECIMAL(18, 2),
  price_warnings JSONB DEFAULT '[]'::jsonb,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per client/year/ticker
  CONSTRAINT unique_determination UNIQUE (client_id, fiscal_year, ticker_plus)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_determinations_client_id ON public.determinations(client_id);
CREATE INDEX IF NOT EXISTS idx_determinations_year ON public.determinations(fiscal_year);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.securities_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fifo_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.determinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_templates ENABLE ROW LEVEL SECURITY;

-- Clients policies
CREATE POLICY "Users can view studio clients" ON public.clients
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create studio clients" ON public.clients
  FOR INSERT WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update studio clients" ON public.clients
  FOR UPDATE USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete studio clients" ON public.clients
  FOR DELETE USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Cash accounts policies (via client relationship)
CREATE POLICY "Users can view client cash accounts" ON public.cash_accounts
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage client cash accounts" ON public.cash_accounts
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Securities accounts policies (via client relationship)
CREATE POLICY "Users can view client securities" ON public.securities_accounts
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage client securities" ON public.securities_accounts
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Import buffer policies
CREATE POLICY "Users can view import buffer" ON public.import_buffer
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage import buffer" ON public.import_buffer
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Client warnings policies
CREATE POLICY "Users can view client warnings" ON public.client_warnings
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage client warnings" ON public.client_warnings
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- FIFO lots policies
CREATE POLICY "Users can view fifo lots" ON public.fifo_lots
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage fifo lots" ON public.fifo_lots
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Determinations policies
CREATE POLICY "Users can view determinations" ON public.determinations
  FOR SELECT USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage determinations" ON public.determinations
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Broker templates - public read, admin write
CREATE POLICY "Anyone can view broker templates" ON public.broker_templates
  FOR SELECT USING (is_active = true);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broker_templates_updated_at
  BEFORE UPDATE ON public.broker_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Balanz Broker Template
-- ============================================
INSERT INTO public.broker_templates (broker_name, broker_code, template_type, column_mapping, parsing_rules)
VALUES
  (
    'Balanz',
    'balanz',
    'cuenta_monetaria',
    '{
      "Fecha": "date",
      "Concepto": "concept",
      "Referencia": "reference",
      "Débito": "debit",
      "Crédito": "credit",
      "Saldo": "balance"
    }'::jsonb,
    '{
      "dateFormat": "DD/MM/YYYY",
      "decimalSeparator": ",",
      "thousandsSeparator": ".",
      "skipRows": 0
    }'::jsonb
  ),
  (
    'Balanz',
    'balanz',
    'cuenta_titulos',
    '{
      "Fecha": "date",
      "Fecha Liquidación": "settlement_date",
      "Tipo Operación": "operation_type",
      "Especie": "ticker",
      "Cantidad": "quantity",
      "Precio": "unit_price_original",
      "Monto": "total_original",
      "Comisión": "fees"
    }'::jsonb,
    '{
      "dateFormat": "DD/MM/YYYY",
      "decimalSeparator": ",",
      "thousandsSeparator": ".",
      "skipRows": 0,
      "operationTypeMapping": {
        "COMPRA": "compra",
        "VENTA": "venta",
        "DIVIDENDO": "dividendo",
        "RENTA": "renta"
      }
    }'::jsonb
  )
ON CONFLICT (broker_code, template_type) DO NOTHING;
