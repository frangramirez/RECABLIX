# Deployment Guide - PRD3 a Producción

**Branch**: feature/prd3-schemas → main
**Dominio de Producción**: https://reca.pacioli.ar
**Fecha**: 2026-01-15

---

## Pre-requisitos

- [ ] Testing E2E completado exitosamente (ver TESTING-PRD3.md)
- [ ] Todos los bugs críticos resueltos
- [ ] Build local pasa sin errores: `npm run build`
- [ ] Acceso a Vercel Dashboard (proyecto RECABLIX)
- [ ] Acceso a Supabase Dashboard

---

## Fase 1: Verificar Variables de Entorno en Vercel

### 1.1 Variables Requeridas

Las siguientes variables **deben** estar configuradas en Vercel (Production):

#### Supabase (Obligatorias)
```bash
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (SECRET)
```

#### Configuración de Aplicación
```bash
PUBLIC_APP_URL=https://reca.pacioli.ar
NODE_ENV=production
```

#### Email (si aplica)
```bash
SMTP_HOST=smtp.gmail.com (ejemplo)
SMTP_PORT=587
SMTP_USER=noreply@recablix.com (ejemplo)
SMTP_PASSWORD=****** (SECRET)
```

### 1.2 Cómo Verificar en Vercel

1. Ir a: https://vercel.com/frangramirez/recablix (ajustar URL según tu proyecto)
2. Settings → Environment Variables
3. Verificar que **Production** tiene todas las variables listadas arriba
4. Si faltan variables:
   - Click "Add New"
   - Name: [nombre variable]
   - Value: [valor]
   - Environments: ✅ Production (solo Production para este deploy)
   - Save

### 1.3 Checklist de Variables

- [ ] `PUBLIC_SUPABASE_URL` configurada
- [ ] `PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada (SECRET)
- [ ] `PUBLIC_APP_URL` = https://reca.pacioli.ar
- [ ] Variables de email configuradas (si aplica)
- [ ] `NODE_ENV` = production (opcional, Vercel lo setea automáticamente)

---

## Fase 2: Mergear Branch a Main

### 2.1 Verificar Estado del Branch

```bash
# Verificar que estás en el branch correcto
git branch --show-current
# Debe mostrar: feature/prd3-schemas

# Verificar que no hay cambios sin commitear
git status
# Debe mostrar: nothing to commit, working tree clean

# Verificar últimos commits
git log --oneline -5
```

### 2.2 Actualizar Branch con Main (Rebase)

```bash
# Asegurarse de tener main actualizado
git checkout main
git pull origin main

# Volver a feature/prd3-schemas
git checkout feature/prd3-schemas

# Rebase sobre main (para tener un historial limpio)
git rebase main

# Si hay conflictos, resolverlos y continuar:
# git add .
# git rebase --continue
```

### 2.3 Merge a Main

```bash
# Cambiar a main
git checkout main

# Mergear feature/prd3-schemas (fast-forward si el rebase fue limpio)
git merge feature/prd3-schemas

# Verificar que merge fue exitoso
git log --oneline -3
```

### 2.4 Push a Main

```bash
# Push a origin/main (esto trigger el deploy automático en Vercel)
git push origin main

# Verificar que push fue exitoso
git log origin/main --oneline -3
```

### 2.5 Monitorear Deploy en Vercel

1. Ir a Vercel Dashboard → Deployments
2. Verificar que se inició nuevo deployment desde main
3. Click en el deployment para ver logs en tiempo real
4. Esperar a que status sea: ✅ Ready

**Tiempo estimado**: 2-5 minutos

### 2.6 Checklist de Merge

- [ ] Branch actualizado con main (rebase)
- [ ] Merge a main exitoso
- [ ] Push a origin/main exitoso
- [ ] Deploy en Vercel iniciado
- [ ] Deploy completado sin errores
- [ ] Preview URL funciona correctamente

---

## Fase 3: Configurar Dominio reca.pacioli.ar

### 3.1 Verificar DNS Actual

Primero, verificar que el dominio `pacioli.ar` está bajo tu control:

```bash
# Verificar nameservers actuales
dig pacioli.ar NS

# Verificar si reca.pacioli.ar ya existe
dig reca.pacioli.ar A
```

### 3.2 Agregar Dominio en Vercel

1. Ir a Vercel Dashboard → Settings → Domains
2. Click "Add Domain"
3. Ingresar: `reca.pacioli.ar`
4. Click "Add"

Vercel mostrará instrucciones de configuración DNS:
- **Tipo A**: Apuntar a IP de Vercel (ej: `76.76.21.21`)
- **O Tipo CNAME**: Apuntar a `cname.vercel-dns.com`

### 3.3 Configurar DNS (opción recomendada: CNAME)

**Si tu DNS está en Cloudflare, GoDaddy, etc:**

1. Ir al panel de DNS de tu proveedor
2. Agregar registro CNAME:
   - **Name**: `reca`
   - **Target**: `cname.vercel-dns.com`
   - **TTL**: 300 (5 min) o Auto
   - **Proxy**: ❌ Deshabilitado (si es Cloudflare, debe ser "DNS only")
3. Guardar cambios

**Alternativa (registro A):**
- **Name**: `reca`
- **Type**: A
- **Value**: `76.76.21.21` (verificar IP actual en Vercel docs)

### 3.4 Verificar Propagación DNS

```bash
# Esperar 5-10 minutos, luego verificar:
dig reca.pacioli.ar

# Debe resolver a IP de Vercel o mostrar CNAME
# Si no resuelve, esperar más tiempo (puede tardar hasta 48h)
```

Herramientas online:
- https://dnschecker.org (ingresar `reca.pacioli.ar`)
- Verificar propagación global

### 3.5 Configurar HTTPS (SSL)

Vercel configura SSL automáticamente con Let's Encrypt:

1. Una vez que DNS propague, Vercel detectará el dominio
2. SSL se provisionará automáticamente (1-5 min)
3. Verificar en Vercel Dashboard que dominio muestra: ✅ Valid Configuration

### 3.6 Configurar como Dominio Principal (opcional)

Si querés que `reca.pacioli.ar` sea el dominio principal:

1. Vercel Dashboard → Settings → Domains
2. Encontrar `reca.pacioli.ar`
3. Click en "…" → Set as Primary Domain
4. Confirmar

Esto redirigirá automáticamente:
- `recablix-xxx.vercel.app` → `reca.pacioli.ar`
- `www.reca.pacioli.ar` → `reca.pacioli.ar` (si agregaste ambos)

### 3.7 Checklist de Dominio

- [ ] Dominio agregado en Vercel
- [ ] DNS configurado (CNAME a `cname.vercel-dns.com`)
- [ ] DNS propagado (verificado con dig/dnschecker)
- [ ] SSL provisionado (HTTPS funciona)
- [ ] Dominio setea do como primario (opcional)
- [ ] Redirecciones funcionan correctamente

---

## Fase 4: Validar Producción

### 4.1 Verificar URL Principal

- [ ] Abrir https://reca.pacioli.ar
- [ ] Verificar que carga la aplicación
- [ ] Verificar que no hay errores de SSL
- [ ] Verificar que redirecciona de HTTP a HTTPS

### 4.2 Testing Funcional en Producción

Repetir testing crítico de TESTING-PRD3.md en producción:

#### Login
- [ ] Login como superadmin funciona
- [ ] Login como miembro de studio funciona
- [ ] Redirección correcta según rol

#### Panel Admin
- [ ] `/admin` muestra lista de studios
- [ ] Impersonación funciona
- [ ] Banner de impersonación visible
- [ ] Salir de impersonación funciona

#### Panel Studio
- [ ] `/studio` carga correctamente
- [ ] Lista de clientes se muestra
- [ ] CRUD de clientes funciona
- [ ] Transacciones cargan y calculan totales
- [ ] Recategorización muestra datos correctos
- [ ] Export a Excel funciona

#### Permisos
- [ ] Gestión de miembros funciona
- [ ] Edición de permisos funciona
- [ ] Validación de roles funciona

### 4.3 Verificar Performance

```bash
# Lighthouse desde CLI (opcional)
npx lighthouse https://reca.pacioli.ar --view

# O usar: https://pagespeed.web.dev/
```

Métricas esperadas:
- **Performance**: > 80
- **Accessibility**: > 90
- **Best Practices**: > 90
- **SEO**: > 90

### 4.4 Verificar Logs de Errores

1. Vercel Dashboard → Runtime Logs
2. Filtrar por errors (últimas 24 horas)
3. Verificar que no hay errores críticos

### 4.5 Verificar Analytics (opcional)

Si tenés Vercel Analytics habilitado:
- Verificar que página está registrando visitas
- Verificar Core Web Vitals

### 4.6 Checklist de Validación

- [ ] URL principal carga sin errores
- [ ] SSL/HTTPS funciona correctamente
- [ ] Login y autenticación funcional
- [ ] Todas las funcionalidades críticas funcionan
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en Runtime Logs de Vercel
- [ ] Performance aceptable (Lighthouse > 80)
- [ ] Responsive en mobile/tablet/desktop

---

## Fase 5: Rollback Plan (si algo falla)

### 5.1 Rollback Inmediato en Vercel

Si detectás un bug crítico en producción:

1. Vercel Dashboard → Deployments
2. Buscar el deployment anterior estable
3. Click en "…" → Promote to Production
4. Confirmar

Esto hace rollback instantáneo al deployment anterior.

### 5.2 Rollback en Git

Si necesitás revertir el merge:

```bash
# Ver últimos commits en main
git log main --oneline -5

# Identificar commit ANTES del merge de PRD3
# Ejemplo: abc1234

# Crear branch de rollback
git checkout -b rollback/prd3

# Revertir al commit anterior
git reset --hard abc1234

# Force push a main (CUIDADO: esto reescribe historia)
git push origin main --force

# Vercel auto-deployrá el código anterior
```

**⚠️ WARNING**: `--force` reescribe historia. Solo usar en emergencias.

### 5.3 Notificar Usuarios (si aplica)

Si el rollback afecta a usuarios:
- Enviar email a studios activos
- Publicar en status page (si existe)
- Comunicar ETA de fix

---

## Post-Deployment

### Actualizar Documentación

- [ ] Actualizar `/Users/francisco/Drive/Obsidian/CODE/RECABLIX/recablix-knowledge.md`
  - Agregar entrada en "Historia Reciente" con fecha
  - Documentar que PRD3 está en producción
  - Incluir URL de producción

- [ ] Actualizar `/Users/francisco/Drive/Obsidian/CODE/0.PROYECTOScc.md`
  - Cambiar **Último act.** a fecha de hoy
  - Cambiar **Deploy** a `https://reca.pacioli.ar`
  - Actualizar **Branch** a `main`
  - Actualizar **Siguiente Paso** con próximas tareas (EPIC-08 o siguiente feature)
  - Actualizar **Contexto** con estado de PRD3 en producción

### Limpiar Branches

```bash
# Opcional: eliminar branch feature/prd3-schemas (ya mergeado)
git branch -d feature/prd3-schemas
git push origin --delete feature/prd3-schemas
```

### Monitoreo Post-Deploy

Durante las primeras 24-48 horas:
- [ ] Revisar Runtime Logs diariamente
- [ ] Monitorear errores de usuarios (si hay sistema de reportes)
- [ ] Verificar métricas de uso (Analytics)
- [ ] Estar disponible para hotfixes

---

## Contactos de Emergencia

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **DNS Provider**: [tu proveedor de DNS]

---

## Notas Finales

- No deployar en viernes por la tarde (en caso de bugs)
- Tener plan de rollback claro antes de deployar
- Comunicar con equipo/usuarios antes de deploy mayor
- Documentar cualquier issue encontrado durante deploy
- Celebrar cuando todo funcione 🎉
