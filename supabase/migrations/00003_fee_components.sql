-- EPIC-01-S04: Tabla fee_components
-- Componentes de cuota de monotributo

-- Tipos de componente
CREATE TYPE fee_component_type AS ENUM ('IMP', 'JUB', 'OS', 'IBP');

CREATE TABLE fee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reca_id UUID NOT NULL REFERENCES reca_periods(id) ON DELETE CASCADE,

  component_code VARCHAR(10) NOT NULL, -- 'B20', 'S20', '021', '21J', '024', '901', etc.
  description VARCHAR(100) NOT NULL,
  component_type fee_component_type NOT NULL,
  category CHAR(1) NOT NULL CHECK (category IN ('A','B','C','D','E','F','G','H','I','J','K')),

  value DECIMAL(15,5) NOT NULL,

  -- Para IIBB provincial
  province_code VARCHAR(3), -- '901' = CABA, '904' = Córdoba, etc.
  has_municipal BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_fee_component UNIQUE (reca_id, component_code, category)
);

-- Índices
CREATE INDEX idx_fee_components_reca ON fee_components(reca_id);
CREATE INDEX idx_fee_components_type ON fee_components(component_type);
CREATE INDEX idx_fee_components_code ON fee_components(component_code);
CREATE INDEX idx_fee_components_province ON fee_components(province_code) WHERE province_code IS NOT NULL;

-- RLS
ALTER TABLE fee_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_components_read" ON fee_components FOR SELECT USING (true);

-- Comentarios
COMMENT ON TABLE fee_components IS 'Valores de componentes de cuota mensual de monotributo';
COMMENT ON COLUMN fee_components.component_code IS 'Códigos: B20=IMP Bienes, S20=IMP Servicios, 021=JUB Aporta, 21J=JUB Jubilado, 024=OS, 9XX=IIBB Provincial';
