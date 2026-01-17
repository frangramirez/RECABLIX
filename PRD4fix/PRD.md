# PRD: Fix Invalid Schema en Multi-Tenant RECABLIX

> **Tipo:** Hotfix / Diagnóstico y Corrección
> **Proyecto:** RECABLIX
> **Fecha:** 2026-01-17
> **Prioridad:** CRÍTICA

---

## 🎯 Objetivo

Resolver definitivamente el error `Invalid schema: tenant_xxx` que impide a usuarios superadmin crear clientes en sus estudios asociados.

---

## 📋 Contexto del Problema

### Síntoma
- Usuario superadmin con múltiples estudios asociados
- Al intentar crear clientes en `/admin/my-studios/[studioId]/clients` 
- Error: `Invalid schema: tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9`

### Causas Potenciales (según diagnóstico)
1. **Schema no existe físicamente** en PostgreSQL
2. **PostgREST no conoce el schema** (no está en `pgrst.db_schemas`)
3. **`studios.schema_name` es NULL** (trigger falló)
4. **Permisos insuficientes** del rol `authenticator` sobre el schema
5. **Race condition** entre creación de studio y primera query

### Arquitectura Actual
```
USE_TENANT_SCHEMAS=true
Tablas tenant: clients, reca_client_data, reca_transactions
Trigger: on_studio_created() → create_reca_tenant()
Fallback: ensureTenantSchema() en TypeScript
```

---

## 📁 Estructura del PRD

```
PRD-FIX-TENANT-SCHEMAS/
├── PRD.md                    # Este archivo (índice)
├── EPIC-01-DIAGNOSTICO.md    # Diagnóstico completo
├── EPIC-02-SOLUCION.md       # Implementación de fix
└── VALIDACION.md             # Criterios de aceptación finales
```

---

## 📊 Épicas

| ID | Nombre | Puntos | Status |
|----|--------|--------|--------|
| E01 | Diagnóstico Exhaustivo | 8 | ⏳ Pendiente |
| E02 | Implementación de Solución | 13 | ⏳ Pendiente |

**Total:** 21 puntos

---

## 🔄 Metodología Ralph Loops

### Reglas de Ejecución
1. **Máximo 10 intentos por story** antes de escalar
2. **Validación objetiva** antes de marcar como completado
3. **Commit + push después de cada story exitosa**
4. **Actualizar history después de cada épica**
5. **NO preguntar al usuario** - ejecutar autónomamente

### Archivos a Mantener
- **Knowledge:** `/Users/francisco/Documentos/Obsidian/CODE/RECABLIX/recablix-knowledge.md`
- **History:** `/Users/francisco/Documentos/Obsidian/CODE/RECABLIX/RECABLIX-historial-2.md`

### Branch de Trabajo
```bash
git checkout -b fix/invalid-tenant-schema
```

---

## 🚀 Inicio de Ejecución

### Checklist Pre-Ejecución
- [ ] Verificar MCP Supabase conectado
- [ ] Confirmar acceso a proyecto PACIOLI (`csldhgebhtgfqomvekyo`)
- [ ] Verificar branch actual
- [ ] Leer EPIC-01 completo antes de comenzar

### Comando de Inicio
```
Leer EPIC-01-DIAGNOSTICO.md y ejecutar todas las stories secuencialmente.
```

---

## 📝 Notas Importantes

### Studio Afectado para Testing
- **Studio ID:** `7d3431b4-536f-41d3-aa87-28ffda66bdb9`
- **Schema esperado:** `tenant_7d3431b4_536f_41d3_aa87_28ffda66bdb9`
- **Nombre:** "cx6" (probablemente)

### NO HACER
- NO modificar estructura de tenant schemas existentes que funcionan
- NO eliminar datos de otros studios
- NO cambiar la arquitectura multi-tenant general
- NO usar `list_tables` de Supabase MCP (consume +16k tokens)

### Referencias
- [[recablix-knowledge]] - Arquitectura general
- [[RECABLIX-historial-2]] - Fixes previos relacionados
- [[database-schema]] - Estructura de BD
