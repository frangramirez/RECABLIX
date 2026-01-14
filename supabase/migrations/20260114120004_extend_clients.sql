-- EPIC-01-S05/S06: Agregar campo apps a clients + tabla reca_client_data
-- Extiende la tabla clients existente de FINBLIX con datos de RECABLIX

-- 1. Agregar campo apps a clients para indicar qué aplicaciones usan este cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS apps VARCHAR(20)[] DEFAULT '{}';

-- Índice GIN para búsqueda eficiente en arrays
CREATE INDEX IF NOT EXISTS idx_clients_apps ON public.clients USING gin(apps);

-- Comentario
COMMENT ON COLUMN public.clients.apps IS 'Aplicaciones que usan este cliente: finblix, recablix';

-- 2. Tabla de extensión con datos específicos de monotributo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reca_client_activity') THEN
    CREATE TYPE reca_client_activity AS ENUM ('BIENES', 'SERVICIOS', 'LOCACION', 'SOLO_LOC_2_INM');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.reca_client_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Parámetros de categorización
  activity reca_client_activity NOT NULL DEFAULT 'SERVICIOS',
  province_code VARCHAR(3) NOT NULL DEFAULT '901', -- Código IIBB

  -- Condiciones especiales
  works_in_rd BOOLEAN DEFAULT false, -- Relación de dependencia
  is_retired BOOLEAN DEFAULT false,  -- Jubilado
  dependents SMALLINT DEFAULT 0 CHECK (dependents >= 0 AND dependents <= 6),

  -- Parámetros físicos
  local_m2 SMALLINT CHECK (local_m2 IS NULL OR local_m2 >= 0),
  annual_rent DECIMAL(15,2) CHECK (annual_rent IS NULL OR annual_rent >= 0),
  annual_mw SMALLINT CHECK (annual_mw IS NULL OR annual_mw >= 0),

  -- Categoría anterior
  previous_category CHAR(1) CHECK (previous_category IS NULL OR previous_category IN ('A','B','C','D','E','F','G','H','I','J','K')),
  previous_fee DECIMAL(15,2),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reca_client_data_client ON public.reca_client_data(client_id);
CREATE INDEX IF NOT EXISTS idx_reca_client_data_activity ON public.reca_client_data(activity);
CREATE INDEX IF NOT EXISTS idx_reca_client_data_province ON public.reca_client_data(province_code);

-- RLS
ALTER TABLE public.reca_client_data ENABLE ROW LEVEL SECURITY;

-- Política: Acceso via client (heredar permisos de FINBLIX)
CREATE POLICY "reca_client_data_via_client" ON public.reca_client_data
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS reca_client_data_updated_at ON public.reca_client_data;
CREATE TRIGGER reca_client_data_updated_at
  BEFORE UPDATE ON public.reca_client_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Función helper para agregar RECABLIX a un cliente
CREATE OR REPLACE FUNCTION add_recablix_to_client(p_client_id UUID)
RETURNS UUID AS $$
DECLARE
  v_reca_data_id UUID;
BEGIN
  -- Agregar 'recablix' al array de apps si no está
  UPDATE public.clients
  SET apps = array_append(
    COALESCE(apps, '{}'),
    'recablix'
  )
  WHERE id = p_client_id
    AND NOT ('recablix' = ANY(COALESCE(apps, '{}')));

  -- Crear registro en reca_client_data si no existe
  INSERT INTO public.reca_client_data (client_id)
  VALUES (p_client_id)
  ON CONFLICT (client_id) DO NOTHING
  RETURNING id INTO v_reca_data_id;

  IF v_reca_data_id IS NULL THEN
    SELECT id INTO v_reca_data_id FROM public.reca_client_data WHERE client_id = p_client_id;
  END IF;

  RETURN v_reca_data_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON TABLE public.reca_client_data IS 'RECABLIX: Datos específicos de monotributo para clientes';
