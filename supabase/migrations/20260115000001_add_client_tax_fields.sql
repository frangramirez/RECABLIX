-- Migración: Agregar campos tributarios y de local a reca_client_data
-- + campo has_integrated_iibb a reca_fee_components

-- ============================================
-- 1. CAMPOS EN reca_client_data
-- ============================================

-- C2: Es exento de ciertos impuestos
ALTER TABLE public.reca_client_data
ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.reca_client_data.is_exempt IS 'Cliente exento de ciertos impuestos';

-- C3: Sujeto a Convenio Multilateral
ALTER TABLE public.reca_client_data
ADD COLUMN IF NOT EXISTS has_multilateral BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.reca_client_data.has_multilateral IS 'Sujeto a Convenio Multilateral para IIBB';

-- C5: Tiene local comercial
ALTER TABLE public.reca_client_data
ADD COLUMN IF NOT EXISTS has_local BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.reca_client_data.has_local IS 'Tiene local o establecimiento comercial';

-- C5: Alquila el local
ALTER TABLE public.reca_client_data
ADD COLUMN IF NOT EXISTS rents_local BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.reca_client_data.rents_local IS 'Alquila el local (es locatario)';

-- C5: CUIT del locador (arrendador)
ALTER TABLE public.reca_client_data
ADD COLUMN IF NOT EXISTS lessor_cuit VARCHAR(13);

COMMENT ON COLUMN public.reca_client_data.lessor_cuit IS 'CUIT del locador/arrendador del local';

-- Validación formato CUIT para lessor_cuit
ALTER TABLE public.reca_client_data
DROP CONSTRAINT IF EXISTS valid_lessor_cuit_format;

ALTER TABLE public.reca_client_data
ADD CONSTRAINT valid_lessor_cuit_format CHECK (
  lessor_cuit IS NULL OR
  lessor_cuit ~ '^\d{2}-\d{8}-\d{1}$'
);

-- ============================================
-- 2. CAMPO EN reca_fee_components
-- ============================================

-- C4: Indica si la provincia tiene IIBB integrado en monotributo
ALTER TABLE public.reca_fee_components
ADD COLUMN IF NOT EXISTS has_integrated_iibb BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.reca_fee_components.has_integrated_iibb IS 'Provincia con IIBB integrado en cuota monotributo (solo para component_type=IBP)';

-- ============================================
-- 3. CONSTRAINT DE CONSISTENCIA
-- ============================================

-- Si rents_local es true, debería tener lessor_cuit (se valida en app, no en DB para flexibilidad)

-- ============================================
-- 4. VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migración completada: campos tributarios agregados';
  RAISE NOTICE '  - reca_client_data: is_exempt, has_multilateral, has_local, rents_local, lessor_cuit';
  RAISE NOTICE '  - reca_fee_components: has_integrated_iibb';
END $$;
