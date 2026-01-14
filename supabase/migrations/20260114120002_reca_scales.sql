-- EPIC-01-S03: Tabla reca_scales
-- Escalas de monotributo por categoría y período

CREATE TABLE IF NOT EXISTS public.reca_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reca_id UUID NOT NULL REFERENCES public.reca_periods(id) ON DELETE CASCADE,
  category CHAR(1) NOT NULL CHECK (category IN ('A','B','C','D','E','F','G','H','I','J','K')),

  -- Límites
  max_annual_income DECIMAL(15,2) NOT NULL,
  max_local_m2 SMALLINT NOT NULL DEFAULT 200,
  max_annual_mw SMALLINT NOT NULL DEFAULT 20000,
  max_annual_rent DECIMAL(15,2) NOT NULL,
  max_unit_sale DECIMAL(15,2), -- Solo para bienes muebles

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_reca_scale_per_period UNIQUE (reca_id, category)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reca_scales_reca ON public.reca_scales(reca_id);
CREATE INDEX IF NOT EXISTS idx_reca_scales_category ON public.reca_scales(category);

-- RLS
ALTER TABLE public.reca_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reca_scales_read" ON public.reca_scales FOR SELECT USING (true);

-- Comentario
COMMENT ON TABLE public.reca_scales IS 'RECABLIX: Límites de facturación y parámetros por categoría A-K';
