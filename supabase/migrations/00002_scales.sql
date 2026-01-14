-- EPIC-01-S03: Tabla scales
-- Escalas de monotributo por categoría y período

CREATE TABLE scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reca_id UUID NOT NULL REFERENCES reca_periods(id) ON DELETE CASCADE,
  category CHAR(1) NOT NULL CHECK (category IN ('A','B','C','D','E','F','G','H','I','J','K')),

  -- Límites
  max_annual_income DECIMAL(15,2) NOT NULL,
  max_local_m2 SMALLINT NOT NULL DEFAULT 200,
  max_annual_mw SMALLINT NOT NULL DEFAULT 20000,
  max_annual_rent DECIMAL(15,2) NOT NULL,
  max_unit_sale DECIMAL(15,2), -- Solo para bienes muebles

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_scale_per_reca UNIQUE (reca_id, category)
);

-- Índices
CREATE INDEX idx_scales_reca ON scales(reca_id);
CREATE INDEX idx_scales_category ON scales(category);

-- RLS
ALTER TABLE scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scales_read" ON scales FOR SELECT USING (true);

-- Comentario
COMMENT ON TABLE scales IS 'Límites de facturación y parámetros por categoría A-K para cada período de recategorización';
