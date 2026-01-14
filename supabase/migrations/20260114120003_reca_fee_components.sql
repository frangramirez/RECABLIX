-- EPIC-01-S04: Tabla reca_fee_components
-- Componentes de cuota de monotributo

-- Tipos de componente (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reca_fee_component_type') THEN
    CREATE TYPE reca_fee_component_type AS ENUM ('IMP', 'JUB', 'OS', 'IBP');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.reca_fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reca_id UUID NOT NULL REFERENCES public.reca_periods(id) ON DELETE CASCADE,

  component_code VARCHAR(10) NOT NULL, -- 'B20', 'S20', '021', '21J', '024', '901', etc.
  description VARCHAR(100) NOT NULL,
  component_type reca_fee_component_type NOT NULL,
  category CHAR(1) NOT NULL CHECK (category IN ('A','B','C','D','E','F','G','H','I','J','K')),

  value DECIMAL(15,5) NOT NULL,

  -- Para IIBB provincial
  province_code VARCHAR(3), -- '901' = CABA, '904' = Córdoba, etc.
  has_municipal BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_reca_fee_component UNIQUE (reca_id, component_code, category)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reca_fee_components_reca ON public.reca_fee_components(reca_id);
CREATE INDEX IF NOT EXISTS idx_reca_fee_components_type ON public.reca_fee_components(component_type);
CREATE INDEX IF NOT EXISTS idx_reca_fee_components_code ON public.reca_fee_components(component_code);
CREATE INDEX IF NOT EXISTS idx_reca_fee_components_province ON public.reca_fee_components(province_code) WHERE province_code IS NOT NULL;

-- RLS
ALTER TABLE public.reca_fee_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reca_fee_components_read" ON public.reca_fee_components FOR SELECT USING (true);

-- Comentarios
COMMENT ON TABLE public.reca_fee_components IS 'RECABLIX: Valores de componentes de cuota mensual de monotributo';
COMMENT ON COLUMN public.reca_fee_components.component_code IS 'Códigos: B20=IMP Bienes, S20=IMP Servicios, 021=JUB, 21J=JUB Jubilado, 024=OS, 9XX=IIBB Provincial';
