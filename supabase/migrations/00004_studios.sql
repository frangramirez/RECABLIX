-- EPIC-01-S05: Tabla studios
-- Estudios contables (usuarios del sistema)

CREATE TABLE studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  cuit VARCHAR(13), -- XX-XXXXXXXX-X

  is_active BOOLEAN DEFAULT true,
  is_superadmin BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_studios_auth_user ON studios(auth_user_id);
CREATE INDEX idx_studios_email ON studios(email);
CREATE INDEX idx_studios_active ON studios(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;

-- Función helper para verificar superadmin
CREATE OR REPLACE FUNCTION is_superadmin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM studios
    WHERE auth_user_id = auth.uid()
    AND is_superadmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Los usuarios ven solo su propio studio (o todo si son superadmin)
CREATE POLICY "studios_select_own" ON studios
  FOR SELECT USING (auth.uid() = auth_user_id OR is_superadmin_user());

-- Solo pueden actualizar su propio studio
CREATE POLICY "studios_update_own" ON studios
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Trigger para updated_at
CREATE TRIGGER studios_updated_at
  BEFORE UPDATE ON studios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comentario
COMMENT ON TABLE studios IS 'Estudios contables registrados en el sistema';
