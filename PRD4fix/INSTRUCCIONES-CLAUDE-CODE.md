# Instrucciones de Ejecución para Claude Code

> **PRD:** Fix Invalid Schema en Multi-Tenant RECABLIX
> **Metodología:** Ralph Loops (máx 10 intentos por story)

---

## 🚀 INICIO

### Paso 0: Setup
```bash
cd /Users/francisco/Documents/Proyectos/RECABLIX
git checkout main
git pull origin main
git checkout -b fix/invalid-tenant-schema
```

### Paso 1: Verificar MCP
Confirmar que Supabase MCP está conectado al proyecto PACIOLI:
- Project ID: `csldhgebhtgfqomvekyo`
- Si no está conectado, solicitar al usuario que lo conecte

---

## 📋 EJECUCIÓN SECUENCIAL

### EPIC-01: Diagnóstico (OBLIGATORIO)

Ejecutar las 4 queries de diagnóstico en orden:

1. **E01-S01**: Verificar schema existe
2. **E01-S02**: Verificar studios.schema_name
3. **E01-S03**: Verificar tablas en schema
4. **E01-S04**: Verificar PostgREST schemas

**Documentar cada resultado antes de continuar.**

### EPIC-02: Solución (SEGÚN DIAGNÓSTICO)

Basado en los resultados de EPIC-01:

| Si el diagnóstico muestra... | Ejecutar... |
|------------------------------|-------------|
| Schema NO existe | E02-S01 + E02-S04 |
| schema_name es NULL | E02-S02 |
| Faltan tablas | E02-S03 |
| PostgREST no conoce schema | E02-S04 |
| Todo OK pero sigue fallando | E02-S05 + revisar código frontend |

---

## 🔄 RALPH LOOP POR STORY

Para cada story:

```
INTENTO 1-10:
  1. Ejecutar acciones de la story
  2. Verificar validación
  3. Si PASA → Continuar a siguiente story
  4. Si FALLA → Analizar error, ajustar, reintentar
  5. Si 10 intentos fallidos → ESCALAR al usuario
```

---

## 📝 DESPUÉS DE CADA ÉPICA

```bash
# Commit cambios
git add .
git commit -m "fix(tenant): [descripción de lo realizado]"
git push origin fix/invalid-tenant-schema

# Actualizar history en Obsidian
# Path: /Users/francisco/Documentos/Obsidian/CODE/RECABLIX/RECABLIX-historial-2.md
```

---

## ✅ VALIDACIÓN FINAL

Después de aplicar soluciones:

1. **Test manual en la app:**
   - URL: `http://localhost:4321/admin/my-studios/7d3431b4-536f-41d3-aa87-28ffda66bdb9/clients`
   - Crear un cliente de prueba
   - Verificar que se guarda sin error

2. **Si funciona:**
   ```bash
   git checkout main
   git merge fix/invalid-tenant-schema
   git push origin main
   ```

3. **Si NO funciona:**
   - Documentar el nuevo error
   - Volver a EPIC-01 para re-diagnosticar

---

## ⚠️ RESTRICCIONES

- **NO usar** `list_tables` de Supabase MCP (consume +16k tokens)
- **NO modificar** schemas de otros studios
- **NO eliminar** datos existentes
- **NO cambiar** arquitectura general multi-tenant

---

## 📞 ESCALACIÓN

Si después de 10 intentos el problema persiste:

1. Documentar todos los intentos y resultados
2. Crear issue con logs completos
3. Informar al usuario con:
   - Diagnóstico realizado
   - Soluciones intentadas
   - Error persistente
   - Recomendación de siguiente paso

---

## 🎯 CRITERIO DE ÉXITO

El fix está completo cuando:

- [x] Usuario superadmin puede crear clientes en studio `7d3431b4-536f-41d3-aa87-28ffda66bdb9`
- [x] No aparece error "Invalid schema"
- [x] Cambios mergeados a main
- [x] History actualizado
