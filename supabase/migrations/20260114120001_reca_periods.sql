-- EPIC-01-S02: Tabla reca_periods
-- Períodos de recategorización (ej: 251 = 2025 reca 1)
-- NOTA: Este proyecto comparte BD con FINBLIX, usa prefijo reca_

CREATE TABLE IF NOT EXISTS public.reca_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(3) UNIQUE NOT NULL, -- '251', '252', '261'
  year SMALLINT NOT NULL,
  semester SMALLINT NOT NULL CHECK (semester IN (1, 2)),
  sales_period_start VARCHAR(6) NOT NULL, -- '202401' (YYYYMM)
  sales_period_end VARCHAR(6) NOT NULL,
  fee_period_start VARCHAR(6) NOT NULL,
  fee_period_end VARCHAR(6) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_reca_periods CHECK (
    sales_period_start < sales_period_end AND
    fee_period_start < fee_period_end
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reca_periods_code ON public.reca_periods(code);
CREATE INDEX IF NOT EXISTS idx_reca_periods_active ON public.reca_periods(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.reca_periods ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer (datos públicos de ARCA)
CREATE POLICY "reca_periods_read" ON public.reca_periods
  FOR SELECT USING (true);

-- Trigger para updated_at (reusar función existente de FINBLIX)
DROP TRIGGER IF EXISTS reca_periods_updated_at ON public.reca_periods;
CREATE TRIGGER reca_periods_updated_at
  BEFORE UPDATE ON public.reca_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentario
COMMENT ON TABLE public.reca_periods IS 'RECABLIX: Períodos semestrales de recategorización de monotributo';
