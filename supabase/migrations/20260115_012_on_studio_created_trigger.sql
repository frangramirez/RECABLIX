-- EPIC-01: Trigger para auto-crear tenant schema al crear studio
-- Cuando se inserta un nuevo studio, automáticamente:
-- 1. Crea el tenant schema con estructura base
-- 2. Extiende el schema con tablas RECA
-- 3. Aplica políticas RLS

CREATE OR REPLACE FUNCTION on_studio_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_name TEXT;
BEGIN
  -- Generar nombre del schema
  schema_name := get_tenant_schema(NEW.id);

  RAISE NOTICE 'Nuevo studio creado: % (%). Creando schema: %', NEW.name, NEW.id, schema_name;

  -- Crear schema del tenant (función existente)
  PERFORM create_tenant_schema(NEW.id);

  -- Extender con tablas RECA (función existente)
  PERFORM extend_tenant_for_reca(NEW.id);

  -- Crear políticas RLS (función nueva)
  PERFORM create_tenant_rls_policies(NEW.id);

  RAISE NOTICE 'Schema % creado exitosamente para studio %', schema_name, NEW.name;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_studio_created IS 'Trigger function que crea automáticamente el tenant schema cuando se inserta un nuevo studio. Ejecuta create_tenant_schema, extend_tenant_for_reca y create_tenant_rls_policies.';

-- Crear el trigger
DROP TRIGGER IF NOT EXISTS trigger_create_tenant_on_studio ON public.studios;

CREATE TRIGGER trigger_create_tenant_on_studio
AFTER INSERT ON public.studios
FOR EACH ROW
EXECUTE FUNCTION on_studio_created();

COMMENT ON TRIGGER trigger_create_tenant_on_studio ON public.studios IS 'Auto-crea tenant schema al insertar nuevo studio. Ejecuta después del INSERT para tener acceso al NEW.id.';
