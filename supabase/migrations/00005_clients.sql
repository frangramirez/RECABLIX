-- EPIC-01-S06: Tabla clients
-- Clientes monotributistas de cada estudio

-- Tipos de actividad principal
CREATE TYPE client_activity AS ENUM ('BIENES', 'SERVICIOS', 'LOCACION', 'SOLO_LOC_2_INM');

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

  -- Identificación
  name VARCHAR(200) NOT NULL,
  cuit VARCHAR(13) UNIQUE, -- XX-XXXXXXXX-X (puede ser null temporalmente)

  -- Parámetros de categorización
  activity client_activity NOT NULL DEFAULT 'SERVICIOS',
  province_code VARCHAR(3) NOT NULL DEFAULT '901', -- Código IIBB

  -- Condiciones especiales
  works_in_rd BOOLEAN DEFAULT false, -- Relación de dependencia
  is_retired BOOLEAN DEFAULT false,  -- Jubilado
  dependents SMALLINT DEFAULT 0 CHECK (dependents >= 0 AND dependents <= 6), -- Adherentes OS

  -- Parámetros físicos (pueden ser null)
  local_m2 SMALLINT CHECK (local_m2 IS NULL OR local_m2 >= 0),
  annual_rent DECIMAL(15,2) CHECK (annual_rent IS NULL OR annual_rent >= 0),
  annual_mw SMALLINT CHECK (annual_mw IS NULL OR annual_mw >= 0),

  -- Categoría anterior (de la reca previa)
  previous_category CHAR(1) CHECK (previous_category IS NULL OR previous_category IN ('A','B','C','D','E','F','G','H','I','J','K')),
  previous_fee DECIMAL(15,2),

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_clients_studio ON clients(studio_id);
CREATE INDEX idx_clients_cuit ON clients(cuit) WHERE cuit IS NOT NULL;
CREATE INDEX idx_clients_activity ON clients(activity);
CREATE INDEX idx_clients_province ON clients(province_code);
CREATE INDEX idx_clients_active ON clients(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Studios solo ven sus propios clientes
CREATE POLICY "clients_studio_access" ON clients
  FOR ALL USING (
    studio_id IN (SELECT id FROM studios WHERE auth_user_id = auth.uid())
    OR is_superadmin_user()
  );

-- Trigger updated_at
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comentario
COMMENT ON TABLE clients IS 'Clientes monotributistas de cada estudio contable';
