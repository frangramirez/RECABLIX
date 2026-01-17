# EPIC-01: Diagnóstico Exhaustivo

> **Puntos:** 8
> **Objetivo:** Identificar la causa raíz exacta del error "Invalid schema"

---

## Stories

### E01-S01: Verificar Existencia del Schema (2 pts)

**Objetivo:** Confirmar si el schema existe físicamente en PostgreSQL.

**Acciones:**
```sql
-- Ejecutar en Supabase SQL Editor o via MCP
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9';
```

**Validación:**
- ✅ Si retorna 1 fila → Schema existe, pasar a S02
- ❌ Si retorna 0 filas → Schema NO existe, documentar y pasar a E02-S01

**Output esperado:** Documentar resultado exacto en history.

---

### E01-S02: Verificar studios.schema_name (2 pts)

**Objetivo:** Confirmar si el registro en `studios` tiene `schema_name` correcto.

**Acciones:**
```sql
SELECT id, name, slug, schema_name, created_at
FROM studios
WHERE id = '7d3431b4-536f-41d3-aa87-28ffda66bdb9';
```

**Validación:**
- ✅ Si `schema_name` = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9' → OK
- ❌ Si `schema_name` IS NULL → Trigger falló, documentar
- ❌ Si `schema_name` tiene otro valor → Inconsistencia, documentar

**Output esperado:** Valor exacto de `schema_name`.

---

### E01-S03: Verificar Tablas en Tenant Schema (2 pts)

**Objetivo:** Confirmar que las tablas tenant existen dentro del schema.

**Acciones:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9'
ORDER BY table_name;
```

**Tablas esperadas:**
- `clients`
- `reca_client_data`
- `reca_transactions`

**Validación:**
- ✅ Si las 3 tablas existen → Estructura OK
- ❌ Si faltan tablas → Schema incompleto, documentar cuáles faltan

---

### E01-S04: Verificar PostgREST Schemas (2 pts)

**Objetivo:** Confirmar si PostgREST conoce el tenant schema.

**Acciones:**
```sql
-- Ver configuración actual de PostgREST
SHOW pgrst.db_schemas;

-- Alternativa: revisar si el schema está expuesto
SELECT current_setting('pgrst.db_schemas', true);
```

**Nota importante:** PostgREST en Supabase requiere que los schemas estén listados en `pgrst.db_schemas` para poder accederlos via API.

**Validación:**
- ✅ Si el tenant schema está en la lista → PostgREST OK
- ❌ Si NO está → **CAUSA RAÍZ ENCONTRADA**: PostgREST no puede acceder

**Si el schema NO está expuesto:**
```sql
-- Agregar schema a PostgREST (requiere reload)
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9';

-- Notificar a PostgREST para que recargue config
NOTIFY pgrst, 'reload config';
```

---

## Resumen de Diagnóstico

Después de ejecutar las 4 stories, completar esta tabla:

| Check | Resultado | Notas |
|-------|-----------|-------|
| Schema existe físicamente | ⏳ | |
| studios.schema_name correcto | ⏳ | |
| Tablas tenant existen | ⏳ | |
| PostgREST conoce el schema | ⏳ | |

### Diagnóstico Final

Basado en los resultados, la causa raíz es:

```
[ ] A. Schema no existe → Ir a E02-S01 (crear schema)
[ ] B. schema_name NULL → Ir a E02-S02 (actualizar registro)
[ ] C. Tablas faltantes → Ir a E02-S03 (crear tablas)
[ ] D. PostgREST no conoce schema → Ir a E02-S04 (exponer schema)
[ ] E. Múltiples problemas → Ejecutar todas las soluciones en orden
```

---

## Commit después de diagnóstico

```bash
# Solo si el diagnóstico revela algo que documentar
git add .
git commit -m "docs: diagnóstico tenant schema studio cx6

Resultados:
- Schema existe: [SI/NO]
- schema_name: [valor]
- Tablas: [lista]
- PostgREST: [expuesto/no expuesto]

Causa raíz identificada: [A/B/C/D/E]"
git push origin fix/invalid-tenant-schema
```
