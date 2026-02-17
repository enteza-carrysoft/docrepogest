# DocRepoGest - Contexto de Desarrollo

## Estado del Proyecto (2026-02-17)

### Fases Completadas
1. **Fase 1**: Schema SQL + RLS + Proyecto Next.js
2. **Fase 2**: Creacion sesiones + UI mostrador + API routes
3. **Fase 3**: Pantalla firma movil
4. **Fase 4**: Subida de firma (signature upload)
5. **Fase 5**: Subida de PDF (pdf upload)
6. **Fase 6**: PDF Engine (`composeSignedDocument.ts`)
7. **Fase 7**: QR delivery + download (tokens + landing pages)
8. **Fase 8**: Client Portal (email login + session list + download)
9. **Fase 10**: Email con Resend (envio automatico al finalizar)
10. **Redesign**: Empresas cliente, portal agrupado por empresa, fuzzy search, fix auth, QR clicables

### Deploy
- **GitHub**: https://github.com/enteza-carrysoft/docrepogest
- **Vercel**: https://docrepogest-ghz3a8yeg-francisco-jose-carrions-projects.vercel.app
- **Supabase**: project-ref `gednvgqouchjjarohxkl`

### Credenciales de Test
- **Email**: admin@demo.com
- **Password**: demo1234
- **Creacion**: Via `scripts/create-admin.ts` (Admin API de Supabase)

---

## Tech Stack

- **Monorepo**: Next.js 16.1.6 (App Router) + TypeScript
- **Backend**: API Routes + Server Actions (dentro de Next.js)
- **Database/Auth/Storage**: Supabase (Postgres + Auth + Storage + RLS)
- **Email**: Resend (lazy init en `lib/email/send-delivery-email.ts`)
- **PDF**: pdf-lib (`lib/pdf/compose-signed-document.ts`)
- **QR**: qrcode.react (`QRCodeSVG`)
- **Deploy**: Vercel (serverless-first)

---

## Rutas de la Aplicacion

### Counter (Empleado)
- `/login` - Login empleado
- `/counter` - Dashboard mostrador
- `/counter/nueva` - Crear nueva sesion (empresa -> persona con fuzzy search)
- `/counter/sesion/[id]` - Detalle sesion (polling 2s, QR firma, dropzone PDF, QR descarga)

### Firma
- `/firmar/[sessionId]` - Pantalla firma movil (sin auth, service client)

### Portal (Cliente)
- `/portal/login` - Login/signup con verificacion email
- `/portal` - Dashboard entregas (agrupado por empresa, filtros fecha/empresa)
- `/portal/sesion/[id]` - Detalle entrega + descarga

### Otros
- `/auth/confirm` - Callback verificacion email (PKCE + code + redirect)
- `/d/[token]` - Pagina descarga publica (validacion token)

---

## API Routes

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/sessions` | Empleado | Crear sesion |
| GET | `/api/sessions/[id]` | Empleado | Estado sesion (polling) + access_token |
| POST | `/api/sessions/[id]/pdf` | Empleado | Subir PDF original |
| POST | `/api/sessions/[id]/signature` | No (service) | Recibir firma PNG |
| GET | `/api/sessions/[id]/public` | No (service) | Info publica sesion |
| GET | `/api/client-companies?q=` | Empleado | Buscar empresas cliente |
| POST | `/api/client-companies` | Empleado | Crear empresa cliente |
| GET | `/api/clients?q=&company_id=` | Empleado | Buscar clientes del tenant |
| POST | `/api/clients` | Empleado | Crear cliente (con company_id) |
| GET | `/api/download/[token]` | No (token) | Descargar PDF firmado |
| GET | `/api/download/[token]/info` | No (token) | Info publica descarga |
| POST | `/api/portal/link` | Cliente | Auto-link client_global por email |
| GET | `/api/portal/sessions` | Cliente | Lista entregas (service client) |
| GET | `/api/portal/sessions/[id]` | Cliente | Detalle entrega + download_token |

---

## Flujo de Firma Actual

```
EMPLEADO                              CLIENTE
───────────────────────────────────────────────────
1. Crea sesion (CREATED)
2. Muestra QR en pantalla
3. Polling cada 2s              →     Escanea QR con movil
                                      Abre /firmar/[sessionId]
                                      Dibuja firma en canvas
                                      POST /api/sessions/[id]/signature
                                      → tryFinalize() si PDF existe
4. Sube PDF (drag & drop)
   POST /api/sessions/[id]/pdf
   → tryFinalize() si firma existe
5. Si ambos existen:
   - composeSignedDocument()
   - Genera PDF final
   - Genera tokens (QR 24h + email 7d)
   - Envia email con Resend
6. Muestra QR descarga          →     Recibe email con link /d/[token]
```

### Estados de Sesion
```
CREATED → SIGNED → PDF_UPLOADED → FINALIZED → CLOSED
                                            → EXPIRED (24h)
```

### tryFinalize() (lib/pdf/try-finalize.ts)
- Idempotente y agnostica del orden (firma primero o PDF primero)
- Lock con `finalizing_at` (compare-and-set)
- Genera PDF final con `composeSignedDocument()`
- Crea access_tokens (QR 24h + email 7d)
- Envia email via Resend

---

## Archivos Clave

### Base de Datos
- `database/schema.sql` - DDL completo (8 tablas + enums + triggers)
- `database/rls.sql` - Politicas RLS + helper functions (SECURITY DEFINER)
- `database/migrations/002_add_client_companies.sql` - Tabla empresas + FK + RLS
- `database/borrar_todo_el_sistema.sql` - Reset SQL (dashboard)

### Scripts
- `scripts/create-admin.ts` - Crear admin via Admin API (post-reset)

### Lib
- `lib/supabase/client.ts` - Browser client (createBrowserClient)
- `lib/supabase/server.ts` - Server client (createServerClient + cookies)
- `lib/supabase/service.ts` - Service client (bypasses RLS)
- `lib/supabase/middleware.ts` - Session refresh + limpieza cookies invalidas
- `lib/pdf/try-finalize.ts` - Orquestador finalizacion
- `lib/pdf/compose-signed-document.ts` - Motor PDF (original + firma + certificado)
- `lib/email/send-delivery-email.ts` - Email via Resend (lazy init)

### Componentes
- `components/signature-canvas.tsx` - Canvas HTML5 firma (mouse + touch)
- `components/fuzzy-search.tsx` - Autocomplete generico con debounce 300ms

### Types
- `types/database.ts` - Interfaces TS (Session, TenantClient, ClientCompany, etc.)

---

## Bugs Importantes Documentados

1. **NO INSERT directo en auth.users**: GoTrue requiere campos internos. INSERT manual corrompe la tabla auth. SIEMPRE usar `supabase.auth.admin.createUser()`.

2. **TRUNCATE auth.users CASCADE**: Para reset limpio de auth. `DELETE FROM auth.users` puede dejar datos huerfanos en tablas auth internas.

3. **SECURITY DEFINER en funciones RLS**: `get_user_tenant_id()`, `is_tenant_admin()`, `get_client_global_id()` requieren `SECURITY DEFINER` para funcionar en politicas RLS.

4. **Trigger function**: El nombre correcto es `update_updated_at()` (NO `set_updated_at()`).

5. **Middleware resiliente**: Si `getUser()` falla (ej: usuario borrado tras reset), limpiar cookies `sb-*` automaticamente.

6. **Supabase "Invalid login credentials"**: Devuelve este error generico tanto por password incorrecta como por email no confirmado. Manejar ambos casos en el UI.

7. **Resend lazy init**: No instanciar `new Resend()` a nivel de modulo (falla en build sin API key). Instanciar dentro de la funcion.

8. **.gitignore excluia lib/**: El gitignore template de Python tenia `lib/` que excluia `lib/supabase/`, `lib/email/`, `lib/pdf/`.

---

## Proceso de Reset de Base de Datos

### Paso 1: SQL en Supabase Dashboard
Ejecutar `database/borrar_todo_el_sistema.sql` en SQL Editor:
- TRUNCATE de todas las tablas (orden FK)
- TRUNCATE auth.users CASCADE
- INSERT tenant demo

### Paso 2: Crear admin via script
```bash
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
npx tsx scripts/create-admin.ts
```
Crea `admin@demo.com / demo1234` via Admin API + vincula al tenant demo.

### Paso 3: Storage (manual)
Borrar ficheros desde Dashboard > Storage > session-files (si hay).

---

## Variables de Entorno (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://gednvgqouchjjarohxkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Todas configuradas tambien en Vercel (produccion).

---

## Feature Pendiente: Terminal Fijo de Firma

### Concepto
Segunda modalidad de firma ademas del QR movil. Un dispositivo fijo (tablet en mostrador) muestra una pantalla de espera. Cuando el empleado activa la firma desde su pantalla, el dispositivo cambia automaticamente al canvas de captura. Tras firmar, vuelve a "Esperando...". El dispositivo no necesita manipulacion.

### Diseno Propuesto

#### Flujo
```
TERMINAL (tablet fijo)                    EMPLEADO (counter)
──────────────────────────────────────────────────────────
Muestra "Esperando inicio de firma..."
Polling cada 2s                     →     Crea sesion
                                          En detalle sesion, pulsa
                                          "Firmar en terminal"
                                          → POST marca pending_terminal_at
Terminal detecta sesion pendiente
Muestra canvas de firma
Cliente firma en tablet fijo
POST /api/sessions/[id]/signature
Terminal vuelve a "Esperando..."    →     Empleado ve firma recibida
```

#### Implementacion (pendiente)
1. **Migracion SQL**: `ALTER TABLE sessions ADD COLUMN pending_terminal_at timestamptz`
2. **API**: `POST /api/sessions/[id]/terminal` - marca sesion para terminal
3. **API**: `GET /api/sessions/terminal/active` - devuelve sesion pendiente del tenant
4. **Pagina**: `/firmar/terminal` - login empleado + polling + canvas
5. **UI**: Boton "Firmar en terminal" en `/counter/sesion/[id]`
6. **Limpieza**: Tras firma, `pending_terminal_at` se limpia automaticamente

#### Principios
- Reusar `components/signature-canvas.tsx` existente
- Polling consistente con patrones actuales (no Realtime)
- Requiere login de empleado (seguridad)
- No rompe flujo QR existente (ambas opciones disponibles)
