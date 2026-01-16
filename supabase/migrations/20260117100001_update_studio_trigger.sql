-- ============================================================================
-- Migration: Update Studio Created Trigger
-- Description: Actualiza el trigger on_studio_created para que también
--              setee el campo schema_name en la tabla studios
--
-- El trigger original ya existía pero no actualizaba schema_name
-- ============================================================================

-- Recrear la función del trigger con la actualización de schema_name
CREATE OR REPLACE FUNCTION on_studio_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_name TEXT;
BEGIN
  -- Generar nombre del schema
  v_schema_name := get_tenant_schema(NEW.id);

  RAISE NOTICE 'Nuevo studio creado: % (%). Creando schema: %', NEW.name, NEW.id, v_schema_name;

  -- Crear schema del tenant completo (base + RECA)
  -- Esta función es idempotente y verifica si el schema ya existe
  PERFORM create_reca_tenant(NEW.id);

  -- Crear políticas RLS
  PERFORM create_tenant_rls_policies(NEW.id);

  -- Actualizar el campo schema_name en la tabla studios
  -- Esto es redundante con create_tenant_schema pero lo hacemos explícito
  -- para asegurar que siempre quede seteado
  UPDATE public.studios
  SET schema_name = v_schema_name
  WHERE id = NEW.id
  AND (schema_name IS NULL OR schema_name != v_schema_name);

  RAISE NOTICE 'Schema % creado exitosamente para studio %', v_schema_name, NEW.name;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_studio_created IS
  'Trigger function que crea automáticamente el tenant schema cuando se inserta un nuevo studio. '
  'Ejecuta create_reca_tenant, create_tenant_rls_policies y actualiza studios.schema_name.';

-- Recrear el trigger (DROP + CREATE para asegurar que use la nueva función)
DROP TRIGGER IF EXISTS trigger_create_tenant_on_studio ON public.studios;

CREATE TRIGGER trigger_create_tenant_on_studio
AFTER INSERT ON public.studios
FOR EACH ROW
EXECUTE FUNCTION on_studio_created();

COMMENT ON TRIGGER trigger_create_tenant_on_studio ON public.studios IS
  'Auto-crea tenant schema al insertar nuevo studio. Ejecuta después del INSERT para tener acceso al NEW.id.';
