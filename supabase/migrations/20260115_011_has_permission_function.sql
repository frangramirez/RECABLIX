-- EPIC-01: Función para verificar permisos granulares
-- Verifica si un usuario tiene un permiso específico en un studio
-- Superadmins y owners siempre tienen todos los permisos

CREATE OR REPLACE FUNCTION has_permission(
  uid UUID,
  sid UUID,
  permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    CASE
      -- Superadmin tiene todos los permisos
      WHEN is_active_superadmin(uid) THEN true
      -- Owner tiene todos los permisos
      WHEN (SELECT role FROM public.studio_members WHERE user_id = uid AND studio_id = sid) = 'owner' THEN true
      -- Otros roles según permissions JSON
      ELSE COALESCE(
        (SELECT (permissions->>permission_name)::boolean
         FROM public.studio_members
         WHERE user_id = uid AND studio_id = sid),
        false
      )
    END
$$;

COMMENT ON FUNCTION has_permission IS 'Verifica si un usuario tiene un permiso específico en un studio. Retorna true para superadmins y owners automáticamente.';

-- Ejemplos de permisos granulares (según PRD3):
-- - can_view_billing
-- - can_manage_subscriptions
-- - can_delete_members
-- - can_delete_clients
-- - can_export_data
-- - can_import_data
-- - can_generate_reports
