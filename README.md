# RECABLIX

Asistente de recategorización de monotributo para estudios contables argentinos.

## Stack

- **Frontend:** Astro 5 + React 19 + TypeScript 5.7
- **Styling:** Tailwind CSS 4 + shadcn/ui + Lucide Icons
- **Backend:** Supabase (Auth + PostgreSQL)
- **PDF:** @react-pdf/renderer
- **Excel:** SheetJS (xlsx)
- **Testing:** Vitest + Playwright
- **Deploy:** Vercel

## Requisitos

- Node.js 20+
- pnpm 9+
- Cuenta Supabase

## Instalación

```bash
# Clonar repositorio
git clone https://github.com/frangramirez/RECA.git
cd app

# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus valores de Supabase

# Iniciar desarrollo
pnpm dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor desarrollo (localhost:4321) |
| `pnpm build` | Build producción |
| `pnpm preview` | Preview del build |
| `pnpm test` | Tests unitarios (watch mode) |
| `pnpm test:run` | Tests unitarios (single run) |
| `pnpm test:e2e` | Tests E2E con Playwright |
| `pnpm test:e2e:ui` | Tests E2E con UI interactiva |

## Estructura

```
src/
├── components/         # Componentes React
│   ├── ui/             # shadcn/ui (18 componentes)
│   ├── admin/          # Panel SuperAdmin
│   ├── studio/         # Panel Studio
│   ├── auth/           # Autenticación
│   └── providers/      # Context providers
├── layouts/            # Layouts Astro
│   ├── BaseLayout.astro
│   ├── AdminLayout.astro
│   └── StudioLayout.astro
├── pages/              # Rutas
│   ├── admin/          # /admin/* (SuperAdmin)
│   ├── studio/         # /studio/* (Estudios)
│   └── api/            # API endpoints
├── lib/
│   ├── calculations/   # Motor de cálculo
│   │   ├── category.ts
│   │   ├── fee-components.ts
│   │   └── index.ts
│   ├── supabase.ts     # Cliente Supabase
│   ├── auth.ts         # Utilidades de autenticación
│   └── utils.ts        # Utilidades generales
├── stores/             # Estado global (nanostores)
├── middleware.ts       # Middleware Astro (protección de rutas)
└── env.d.ts            # Tipos TypeScript
```

## Roles

- **SuperAdmin:** Configura períodos, escalas, componentes de cuota, y estudios
- **Studio:** Gestiona sus clientes y genera recategorizaciones

El SuperAdmin se define mediante la variable de entorno `SUPERADMIN_EMAIL`.

## Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave anónima Supabase | ✅ |
| `SUPABASE_SERVICE_KEY` | Clave servicio (solo server) | ✅ |
| `SUPERADMIN_EMAIL` | Email del SuperAdmin | ✅ |
| `PUBLIC_APP_URL` | URL de la app | ✅ |

Consulta `.env.example` para más detalles.

## Arquitectura

### Base de Datos Compartida

RECABLIX comparte base de datos con FINBLIX (proyecto Supabase):

- **Tablas compartidas:** `studios`, `studio_members`, `clients`
- **Tablas específicas:** prefijo `reca_` (períodos, escalas, componentes, etc.)
- **Multi-tenancy:** mediante `studio_id`

### Motor de Cálculo

El motor utiliza funciones puras para facilitar testing:

```typescript
// Función pura (sin BD, 100% testeable)
calculateCategoryFromScales(scales, clientData)

// Función pura de componentes
calculateFeeComponentsFromData(components, clientData)

// Wrapper que obtiene datos de Supabase
calculateRecategorization(clientId)
```

## Contribuir

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/mi-feature`
3. Commit: `git commit -m 'feat(epic-N): descripción'`
4. Push: `git push origin feature/mi-feature`
5. Crear Pull Request

## Licencia

Propietario - Contablix © 2025
