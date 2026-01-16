# CLAUDE.md - RECABLIX

## Reglas del Proyecto

### 1. Context Retrieval (OBLIGATORIO al inicio)

**ANTES de cualquier trabajo:**
1. Leer el Project Knowledge:
   ```
   /Users/francisco/Drive/Obsidian/CODE/RECABLIX/recablix-knowledge.md
   ```
2. Si hay dudas técnicas o contexto histórico, consultar también:
   ```
   /Users/francisco/Drive/Obsidian/CODE/RECABLIX/RECABLIX-historial-2.md
   /Users/francisco/Drive/Obsidian/CODE/RECABLIX/RECABLIX-historial.md (historial antiguo)
   ```
3. Para operaciones de base de datos, SIEMPRE consultar primero:
   ```
   /Users/francisco/Drive/Obsidian/CODE/RECABLIX/database-schema.md
   ```

---

### 2. Workflow de Cambios

#### Antes de escribir código
1. **Planear**: Explicar qué se va a hacer y por qué
2. **Consultar**: Si hay ambigüedad, preguntar al usuario
3. **Validar enfoque**: Si es un cambio significativo, confirmar antes de implementar

#### Durante la implementación
1. Trabajar en branch dedicado:
   - Fixes: `fix/descripcion-corta`
   - Features: `feature/descripcion-corta`
2. Commits atómicos con mensajes descriptivos
3. Validar: `pnpm lint && pnpm typecheck && pnpm build`

#### Después de cada fix o feature
1. **Push a branch** (NUNCA merge directo a main):
   ```bash
   git push origin fix/nombre-del-fix
   # o
   git push origin feature/nombre-de-la-feature
   ```

2. **Actualizar historial-2** en Obsidian (`CODE/RECABLIX/RECABLIX-historial-2.md`):
   ```markdown
   ## YYYY-MM-DD - [Título descriptivo]

   ### [fix/feature]: Descripción breve

   **Branch:** `fix/nombre`
   **Commit:** `hash` mensaje

   **Problema:**
   - Qué problema se resolvió

   **Solución:**
   - Cómo se resolvió

   **Archivos modificados:**
   - `ruta/archivo.ts` - qué cambió

   **Aprendizajes:**
   - Insights para el knowledge (si aplica)
   ```

3. **Si hubo aprendizajes relevantes**, actualizar también `recablix-knowledge.md`:
   - Nuevos patrones descubiertos
   - Errores comunes a evitar
   - Cambios en arquitectura o convenciones
   - Contradicciones con información previa (actualizar!)

---

### 3. Reglas de Git

| Acción | Permitido | Condición |
|--------|-----------|-----------|
| Commit | ✅ Sí | Después de validar lint/typecheck/build |
| Push a branch | ✅ Sí | Siempre a branch fix/ o feature/ |
| Merge a main | ❌ NO | Solo si el usuario lo pide explícitamente |
| Push --force | ❌ NO | Nunca |

---

### 4. Stack y Convenciones

| Tecnología | Detalles |
|------------|----------|
| Framework | Astro 5 SSR + React 19 |
| UI | Tailwind CSS + shadcn/ui |
| Estado | nanostores |
| Auth | Supabase SSR cookies |
| DB | Supabase PostgreSQL (tenant schemas) |
| Deploy | Vercel |

**TypeScript:**
- Strict mode activo
- NUNCA usar `any`
- Preferir tipos explícitos

**Componentes:**
- React: PascalCase
- Astro pages: kebab-case
- Funciones: camelCase

---

### 5. Supabase y Base de Datos

**Regla crítica:** ANTES de cualquier query a Supabase:
1. Leer `database-schema.md`
2. Identificar si la tabla es tenant (`tenant_*`) o public
3. Usar `getQueryBuilder(studioId, tableName)` para tablas tenant

**NUNCA:**
- Usar `list_tables` del MCP (consume +16k tokens)
- Hacer queries exploratorias sin propósito específico
- Queries a tablas tenant sin studioId

---

### 6. Estructura del Proyecto

```
RECABLIX/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn components
│   │   ├── admin/        # Panel SuperAdmin
│   │   └── studio/       # Panel Studio
│   ├── lib/
│   │   ├── calculations/ # Motor de cálculo (funciones puras)
│   │   ├── supabase.ts   # Clientes Supabase
│   │   └── config.ts     # Configuración tenant
│   ├── pages/
│   │   ├── admin/        # Rutas SuperAdmin
│   │   ├── studio/       # Rutas Studio
│   │   └── api/          # API Routes
│   └── middleware.ts     # Auth middleware
├── tests/
│   ├── unit/             # Vitest
│   └── e2e/              # Playwright
└── supabase/migrations/  # DDL
```

---

### 7. Educational Insights

Cuando trabajes en este proyecto, proveer insights educativos sobre:
- Decisiones de arquitectura (por qué tenant schemas, por qué nanostores)
- Patrones de Astro + React (islands, SSR)
- Lógica de negocio argentina (monotributo, categorías, IIBB)
- Buenas prácticas de Supabase (RLS, SECURITY DEFINER)

Formato:
```
★ Insight ─────────────────────────────────────
[2-3 puntos educativos relevantes]
─────────────────────────────────────────────────
```

---

### 8. Comandos Útiles

```bash
# Desarrollo
pnpm dev                    # Server en :4321

# Validación
pnpm lint && pnpm typecheck && pnpm build

# Tests
pnpm test                   # Unit tests (watch)
pnpm test:run               # Unit tests (single)
pnpm test:e2e               # E2E headless
```

---

### 9. Credenciales de Prueba

| Email | Password | Rol |
|-------|----------|-----|
| framirez@contablix.ar | 33767266 | SuperAdmin |
| test@prd3.com | testing123 | PRD3 Owner |

---

### 10. Recursos en Obsidian

| Archivo | Propósito |
|---------|-----------|
| `CODE/RECABLIX/recablix-knowledge.md` | Fuente de verdad técnica |
| `CODE/RECABLIX/RECABLIX-historial-2.md` | Registro de cambios activo |
| `CODE/RECABLIX/database-schema.md` | Schema de BD completo |
| `CODE/RECABLIX/test-users.md` | Usuarios de prueba |

---

*Este archivo guía el comportamiento de Claude Code en el proyecto RECABLIX.*
