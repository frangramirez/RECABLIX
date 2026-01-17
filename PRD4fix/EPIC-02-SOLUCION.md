# EPIC-02: Implementación de Solución

> **Puntos:** 13
> **Prerequisito:** Completar EPIC-01 para identificar causa raíz

---

## Rama de Soluciones

Ejecutar SOLO las stories que correspondan según el diagnóstico de EPIC-01.

---

### E02-S01: Crear Schema Manualmente (3 pts)

**Aplica si:** Schema NO existe físicamente (EPIC-01-S01 falló)

**Acciones:**

```sql
-- 1. Crear el schema físicamente
SELECT create_reca_tenant('7d3431b4-536f-41d3-aa87-28ffda66bdb9');

-- 2. Verificar creación
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9';

-- 3. Verificar que studios.schema_name se actualizó
SELECT schema_name FROM studios 
WHERE id = '7d3431b4-536f-41d3-aa87-28ffda66bdb9';
```

**Si `create_reca_tenant` falla:**
```sql
-- Ejecutar paso a paso
SELECT create_tenant_schema('7d3431b4-536f-41d3-aa87-28ffda66bdb9');
SELECT extend_tenant_for_reca('7d3431b4-536f_41d3-aa87-28ffda66bdb9');
SELECT create_tenant_rls_policies('7d3431b4-536f-41d3-aa87-28ffda66bdb9');

-- Actualizar manualmente
UPDATE studios 
SET schema_name = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9'
WHERE id = '7d3431b4-536f-41d3-aa87-28ffda66bdb9';
```

**Validación:**
- ✅ Query a `information_schema.schemata` retorna 1 fila
- ✅ `studios.schema_name` tiene valor correcto

---

### E02-S02: Actualizar studios.schema_name (2 pts)

**Aplica si:** Schema existe pero `studios.schema_name` es NULL

**Acciones:**
```sql
-- Actualizar el registro
UPDATE studios 
SET schema_name = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9'
WHERE id = '7d3431b4-536f-41d3-aa87-28ffda66bdb9'
AND schema_name IS NULL;

-- Verificar
SELECT id, schema_name FROM studios 
WHERE id = '7d3431b4-536f-41d3-aa87-28ffda66bdb9';
```

**Validación:**
- ✅ `schema_name` = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9'

---

### E02-S03: Crear Tablas Faltantes (3 pts)

**Aplica si:** Schema existe pero faltan tablas (clients, reca_client_data, reca_transactions)

**Acciones:**
```sql
-- Verificar qué tablas faltan
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9';

-- Si falta clients:
CREATE TABLE IF NOT EXISTS tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studios(id),
  name VARCHAR(255) NOT NULL,
  cuit VARCHAR(13),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  apps VARCHAR(20)[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Si falta reca_client_data:
CREATE TABLE IF NOT EXISTS tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.reca_client_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  activity VARCHAR DEFAULT 'SERVICIOS',
  province_code VARCHAR(3) DEFAULT '901',
  works_in_rd BOOLEAN DEFAULT false,
  is_retired BOOLEAN DEFAULT false,
  is_exempt BOOLEAN DEFAULT false,
  has_multilateral BOOLEAN DEFAULT false,
  has_local BOOLEAN DEFAULT false,
  is_rented BOOLEAN DEFAULT false,
  dependents SMALLINT DEFAULT 0 CHECK (dependents >= 0 AND dependents <= 6),
  local_m2 SMALLINT CHECK (local_m2 >= 0),
  annual_rent DECIMAL(15,2) CHECK (annual_rent >= 0),
  landlord_cuit VARCHAR(13),
  annual_mw SMALLINT CHECK (annual_mw >= 0),
  previous_category CHAR(1) CHECK (previous_category IN ('A','B','C','D','E','F','G','H','I','J','K')),
  previous_fee DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Si falta reca_transactions:
CREATE TABLE IF NOT EXISTS tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.reca_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('SALE', 'PURCHASE')),
  period VARCHAR(6) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE,
  description VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_clients_studio 
  ON tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.clients(studio_id);
CREATE INDEX IF NOT EXISTS idx_reca_client_data_client 
  ON tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.reca_client_data(client_id);
CREATE INDEX IF NOT EXISTS idx_reca_transactions_client 
  ON tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9.reca_transactions(client_id);
```

**Validación:**
- ✅ Las 3 tablas aparecen en `information_schema.tables`

---

### E02-S04: Exponer Schema en PostgREST (3 pts)

**Aplica si:** PostgREST no conoce el schema

**IMPORTANTE:** Esta es probablemente la causa más común del error "Invalid schema".

**Acciones:**

```sql
-- 1. Ver configuración actual
SELECT current_setting('pgrst.db_schemas', true);

-- 2. Agregar el schema (esto requiere permisos de superuser en Supabase)
-- NOTA: En Supabase, esto se hace via Dashboard → Database → Roles
-- O mediante una función que ya debería existir:

-- 3. Verificar si existe función para exponer schemas
SELECT proname FROM pg_proc WHERE proname LIKE '%postgrest%' OR proname LIKE '%schema%';

-- 4. Si no hay función, crear una migración para manejar esto automáticamente
```

**Solución en Código (si SQL no es suficiente):**

Crear migración `20260117_expose_tenant_schemas.sql`:
```sql
-- Función para exponer schema en PostgREST
CREATE OR REPLACE FUNCTION expose_tenant_schema(p_studio_id UUID)
RETURNS VOID AS $$
DECLARE
  v_schema_name TEXT;
  v_current_schemas TEXT;
BEGIN
  v_schema_name := 'tenant_' || replace(p_studio_id::text, '-', '_');
  
  -- Obtener schemas actuales
  v_current_schemas := current_setting('pgrst.db_schemas', true);
  
  -- Si el schema no está en la lista, agregarlo
  IF v_current_schemas IS NULL OR v_current_schemas NOT LIKE '%' || v_schema_name || '%' THEN
    EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', 
      COALESCE(v_current_schemas || ', ', 'public, ') || v_schema_name);
    
    -- Notificar a PostgREST para recargar
    NOTIFY pgrst, 'reload config';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar para el studio problemático
SELECT expose_tenant_schema('7d3431b4-536f-41d3-aa87-28ffda66bdb9');
```

**Alternativa en Supabase Dashboard:**
1. Ir a Database → Roles
2. Seleccionar rol `authenticator`
3. En "Search Path" agregar el tenant schema

**Validación:**
- ✅ `SHOW pgrst.db_schemas` incluye el tenant schema
- ✅ Crear cliente en `/admin/my-studios/[studioId]/clients` funciona

---

### E02-S05: Fix Preventivo - Mejorar ensureTenantSchema (2 pts)

**Aplica siempre:** Mejorar el fallback TypeScript para futuros casos

**Archivo:** `src/lib/tenant.ts`

```typescript
// Agregar exposición de schema en PostgREST
export async function ensureTenantSchema(
  supabaseAdmin: SupabaseClient,
  studioId: string
): Promise<string> {
  const schemaName = getTenantSchemaName(studioId)
  
  // 1. Verificar si el studio tiene schema_name
  const { data: studio } = await supabaseAdmin
    .from('studios')
    .select('schema_name')
    .eq('id', studioId)
    .single()
  
  if (studio?.schema_name) {
    return studio.schema_name
  }
  
  // 2. Schema no existe, crearlo
  console.log(`[ensureTenantSchema] Creating schema for studio ${studioId}`)
  
  const { error: createError } = await supabaseAdmin.rpc('create_reca_tenant', {
    p_studio_id: studioId
  })
  
  if (createError) {
    console.error('[ensureTenantSchema] Error creating tenant:', createError)
    // Intentar método alternativo
    await supabaseAdmin.rpc('create_tenant_schema', { p_studio_id: studioId })
    await supabaseAdmin.rpc('extend_tenant_for_reca', { p_studio_id: studioId })
    await supabaseAdmin.rpc('create_tenant_rls_policies', { p_studio_id: studioId })
    
    // Actualizar manualmente
    await supabaseAdmin
      .from('studios')
      .update({ schema_name: schemaName })
      .eq('id', studioId)
  }
  
  // 3. Exponer en PostgREST (si la función existe)
  try {
    await supabaseAdmin.rpc('expose_tenant_schema', { p_studio_id: studioId })
  } catch (e) {
    console.warn('[ensureTenantSchema] expose_tenant_schema not available')
  }
  
  return schemaName
}
```

**Validación:**
- ✅ Build sin errores TypeScript
- ✅ Crear cliente en studio nuevo funciona automáticamente

---

## Validación Final (Obligatoria)

Después de aplicar las soluciones correspondientes:

### Test Manual
1. Ir a `/admin/my-studios/7d3431b4-536f-41d3-aa87-28ffda66bdb9/clients`
2. Click en "Nuevo Cliente"
3. Completar formulario con datos de prueba:
   - Nombre: "Test Fix Tenant"
   - CUIT: "20-12345678-9"
4. Guardar

### Criterios de Éxito
- [ ] Cliente se crea sin error "Invalid schema"
- [ ] Cliente aparece en la lista
- [ ] Se puede editar el cliente
- [ ] Se pueden agregar transacciones al cliente

### Si el test falla
Volver a EPIC-01 y verificar qué check está fallando ahora.

---

## Commit Final

```bash
git add .
git commit -m "fix(tenant): resolve invalid schema error for existing studios

- [Listar soluciones aplicadas]
- Mejorado ensureTenantSchema con fallbacks
- Agregada exposición de schema en PostgREST

Fixes: Invalid schema tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9
Tested: Crear cliente en studio cx6 ✓"

git push origin fix/invalid-tenant-schema
```

---

## Merge a Main (si todo OK)

```bash
git checkout main
git merge fix/invalid-tenant-schema
git push origin main
```
