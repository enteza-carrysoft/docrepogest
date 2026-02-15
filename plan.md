# Plan de Implementación - Fase 1: Schema SQL + RLS + Proyecto Next.js

## Resumen
Inicializar el proyecto Next.js como monorepo y crear el esquema completo de base de datos con políticas RLS multi-tenant.

---

## Paso 1: Inicializar proyecto Next.js

Crear el proyecto Next.js con App Router + TypeScript en la raíz del repo (NO en subcarpeta frontend/).

**Comando:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

**Dependencias adicionales:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Archivos de configuración:**
- `tsconfig.json` - ajustar path aliases
- `.env.local.example` - template de variables de entorno (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- Actualizar `.gitignore` para Next.js

---

## Paso 2: Crear estructura de carpetas del proyecto

```
/app
  /(counter)/          # Route group - UI empleado mostrador
    layout.tsx         # Layout counter (placeholder)
    page.tsx           # Redirect o landing counter
  /(sign)/             # Route group - UI firmante móvil
    layout.tsx         # Layout sign (placeholder)
  /(portal)/           # Route group - Portal cliente final
    layout.tsx         # Layout portal (placeholder)
  /api/                # Route handlers
    /health/route.ts   # Health check endpoint
  layout.tsx           # Root layout
  page.tsx             # Landing page
/lib
  /supabase/
    client.ts          # Browser Supabase client
    server.ts          # Server-side Supabase client
    middleware.ts      # Supabase middleware helper
  /pdf/                # Placeholder para motor PDF
  /auth/               # Auth utilities placeholder
  /tokens/             # Token management placeholder
/components/           # Shared UI components placeholder
/database/
  schema.sql           # DDL completo (ENTREGABLE PRINCIPAL)
  rls.sql              # Políticas RLS (ENTREGABLE PRINCIPAL)
  seed.sql             # Datos semilla para desarrollo
/types/
  database.ts          # TypeScript types generados del schema
```

Cada carpeta placeholder tendrá un archivo mínimo (index.ts o .gitkeep) para que Git la trackee.

---

## Paso 3: Crear schema.sql - DDL completo

### 3.1 Extensiones y tipos
- Habilitar `pgcrypto` (gen_random_uuid)
- Crear ENUM `session_status`: CREATED, SIGNED, PDF_UPLOADED, FINALIZED, CLOSED, EXPIRED
- Crear ENUM `user_role`: admin, employee
- Crear ENUM `doc_type`: original, final
- Crear ENUM `token_type`: qr, email
- Crear ENUM `actor_type`: employee, client, system

### 3.2 Función trigger updated_at
- Trigger function `update_updated_at()` para timestamps automáticos

### 3.3 Tablas (en orden de dependencia)

**tenants**
- `id` UUID PK DEFAULT gen_random_uuid()
- `name` TEXT NOT NULL
- `slug` TEXT UNIQUE NOT NULL (para URLs)
- `plan` TEXT DEFAULT 'free' (preparado para Stripe)
- `logo_url` TEXT
- `settings` JSONB DEFAULT '{}'
- `max_sessions_month` INT DEFAULT 100
- `max_storage_mb` INT DEFAULT 500
- `retention_months` INT DEFAULT 12
- `active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**tenant_users**
- `id` UUID PK
- `tenant_id` UUID FK → tenants NOT NULL
- `auth_user_id` UUID FK → auth.users NOT NULL (Supabase Auth)
- `role` user_role DEFAULT 'employee'
- `name` TEXT NOT NULL
- `email` TEXT NOT NULL
- `active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- UNIQUE(tenant_id, auth_user_id)

**client_global** (INDEPENDIENTE de tenants - Anti-error #1)
- `id` UUID PK
- `full_name` TEXT NOT NULL
- `email_norm` TEXT (lowercase, trimmed)
- `phone_norm` TEXT
- `dni_hash` TEXT (SHA256 del DNI)
- `auth_user_id` UUID FK → auth.users (NULL = identidad progresiva)
- `created_at` TIMESTAMPTZ
- INDEX en email_norm, dni_hash

**tenant_client** (tabla puente)
- `id` UUID PK
- `tenant_id` UUID FK → tenants NOT NULL
- `client_global_id` UUID FK → client_global NOT NULL
- `internal_ref` TEXT (referencia interna del negocio)
- `created_at` TIMESTAMPTZ
- UNIQUE(tenant_id, client_global_id)

**sessions**
- `id` UUID PK
- `tenant_id` UUID FK → tenants NOT NULL
- `tenant_user_id` UUID FK → tenant_users NOT NULL
- `tenant_client_id` UUID FK → tenant_client NOT NULL
- `doc_num` TEXT (número albarán/factura)
- `status` session_status DEFAULT 'CREATED'
- `signature_path` TEXT (ruta en Storage)
- `pdf_original_path` TEXT
- `pdf_final_path` TEXT
- `pdf_original_hash` TEXT (SHA256)
- `finalizing_at` TIMESTAMPTZ (lock idempotente - Anti-error #7)
- `finalized_at` TIMESTAMPTZ
- `expires_at` TIMESTAMPTZ DEFAULT now() + interval '24 hours'
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- INDEX en (tenant_id, status), (tenant_id, created_at)

**documents**
- `id` UUID PK
- `session_id` UUID FK → sessions NOT NULL
- `tenant_id` UUID FK → tenants NOT NULL
- `type` doc_type NOT NULL
- `storage_path` TEXT NOT NULL
- `file_size` BIGINT
- `mime_type` TEXT DEFAULT 'application/pdf'
- `hash_sha256` TEXT
- `created_at` TIMESTAMPTZ

**access_tokens** (Anti-error #8)
- `id` UUID PK
- `session_id` UUID FK → sessions NOT NULL
- `tenant_id` UUID FK → tenants NOT NULL
- `token` TEXT UNIQUE NOT NULL (generado con gen_random_uuid)
- `type` token_type NOT NULL
- `expires_at` TIMESTAMPTZ NOT NULL
- `used_at` TIMESTAMPTZ
- `revoked_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ
- INDEX en token

**audit_events**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `session_id` UUID FK → sessions
- `event_type` TEXT NOT NULL
- `actor_type` actor_type NOT NULL
- `actor_id` UUID
- `metadata` JSONB DEFAULT '{}'
- `ip_address` INET
- `created_at` TIMESTAMPTZ DEFAULT now()
- INDEX en (tenant_id, created_at), event_type

---

## Paso 4: Crear rls.sql - Políticas RLS

### Estrategia
- Helper function `get_user_tenant_id()` que busca el tenant_id del usuario autenticado en tenant_users
- Todas las tablas tienen RLS habilitado
- Políticas separadas por operación (SELECT, INSERT, UPDATE, DELETE)

### Políticas por tabla

**tenants**: tenant_users pueden ver su propio tenant
**tenant_users**: solo ven compañeros del mismo tenant
**client_global**: clientes ven solo su propio registro (por auth_user_id)
**tenant_client**: tenant users ven sus asociaciones; clients ven las suyas
**sessions**: aislamiento por tenant_id
**documents**: aislamiento por tenant_id + acceso cliente a sus sesiones
**access_tokens**: aislamiento por tenant_id (validación pública vía API, no RLS directo)
**audit_events**: lectura por tenant_id

---

## Paso 5: Crear types/database.ts

TypeScript types que reflejan el schema SQL para uso en la app:
- Interface para cada tabla
- Enum types para status, roles, etc.
- Insert/Update types parciales

---

## Paso 6: Crear Supabase client helpers

- `lib/supabase/client.ts` - createBrowserClient()
- `lib/supabase/server.ts` - createServerClient() para server components/actions
- `lib/supabase/middleware.ts` - middleware para refresh de tokens

---

## Paso 7: Health check endpoint

- `app/api/health/route.ts` - GET que retorna status del sistema

---

## Paso 8: Verificación

- [ ] SQL sin errores de sintaxis
- [ ] Todas las FK tienen ON DELETE apropiado
- [ ] RLS habilitado en TODAS las tablas
- [ ] Los 12 anti-patrones están cubiertos
- [ ] Multi-tenant isolation verificado
- [ ] Indexes en columnas de consulta frecuente
- [ ] TypeScript types consistentes con SQL
- [ ] Proyecto Next.js arranca sin errores (`npm run dev`)
- [ ] Health check endpoint responde

---

## Anti-Patrones Verificados

| # | Patrón | Cubierto |
|---|--------|----------|
| 1 | client_global independiente | ✅ Tabla separada + puente |
| 2 | RLS desde Fase 1 | ✅ Todas las tablas |
| 3 | Estado en DB | ✅ sessions.status + paths |
| 4 | Página certificado extra | ✅ Diseño preparado |
| 5 | No rasterizar PDF | ✅ Arquitectura prevista |
| 6 | Join por sesión | ✅ signature_path + pdf_original_path |
| 7 | tryFinalize idempotente | ✅ finalizing_at como lock |
| 8 | Tokens expirables | ✅ access_tokens con TTL |
| 9 | PII normalizada | ✅ dni_hash, email_norm |
| 10 | Motor PDF server-side | ✅ /lib/pdf/ placeholder |
| 11 | Storage privado | ✅ Diseño con signed URLs |
| 12 | Stripe después | ✅ tenants.plan preparado |

---

## Entregables Fase 1

1. Proyecto Next.js funcional con estructura de carpetas
2. `database/schema.sql` - DDL completo (8 tablas + indexes + triggers)
3. `database/rls.sql` - Políticas RLS completas
4. `types/database.ts` - TypeScript types
5. `lib/supabase/` - Client helpers configurados
6. Health check endpoint funcional
