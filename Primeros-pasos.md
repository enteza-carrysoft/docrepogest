# Prompt maestro (por fases) — SaaS de “Entregas firmadas” con repositorio documental (Next.js + Supabase)

> **Rol y nivel esperado**: Actúa como un **CTO + arquitecto + desarrollador senior full-stack** (Top 1%) con mentalidad de producto SaaS vendible.  
> **Objetivo**: Construir de **0 a 100** un sistema SaaS completo que digitaliza comprobantes de entrega: captura firma en móvil/tablet, permite subir/arrastrar el PDF del ERP, genera un PDF final firmado (sin modificar el original, añadiendo página de firma), lo guarda en un repositorio por cliente final y por negocio, y entrega instantánea por QR + email.  
> **Tecnologías**: **Next.js (App Router)** como frontend y backend (API routes / server actions), **Supabase** como base de datos Postgres + Auth + Storage + Realtime opcional.  
> **Restricción clave**: El ERP/gestión del negocio (p.ej. Visual FoxPro) **NO se modifica**. La integración es por **drag & drop de PDF** y/o archivo en carpeta compartida (opcional más adelante).  
> **Modo de trabajo obligatorio**: **Bucle agéntico iterativo**: planifica → implementa → valida → revisa → mejora. No avances a la siguiente fase sin checklist de validación.

---

## Índice de fases
- **Fase 0**: Requisitos, supuestos, definición de MVP
- **Fase 1**: Producto, modelo de negocio, multi-tenant y roles
- **Fase 2**: Arquitectura técnica end-to-end (Next.js + Supabase)
- **Fase 3**: Modelo de datos Postgres + RLS (seguridad por diseño)
- **Fase 4**: Flujos UX/UI (empleado y firmante) + sincronización
- **Fase 5**: Firma (canvas) + envío + optimización de tamaño
- **Fase 6**: Subida de PDF (drag & drop) + “join” por sesión
- **Fase 7**: Motor PDF (página de firma + merge universal) + hash
- **Fase 8**: Entrega inmediata: QR y enlace temporal + email
- **Fase 9**: Repositorio cliente global federado (multi-negocio)
- **Fase 10**: Observabilidad, logs, auditoría, retención y RGPD
- **Fase 11**: Suscripciones SaaS (Stripe), cuotas y planes
- **Fase 12**: Despliegue, dominios, hardening y checklist producción
- **Fase 13**: Roadmap V2 (agente local opcional, integraciones, etc.)

---

# FASE 0 — Requisitos, supuestos y definición de MVP

## Contexto
Construimos un servicio SaaS para negocios (ferreterías, fontanerías, pintura, electricidad, etc.) que entregan material y generan albaranes/facturas desde su ERP. Hoy imprimen, el cliente firma en papel y luego archivan/escanean. El sistema reduce el proceso a:
1) Firma en móvil/tablet
2) Empleado arrastra PDF al sistema
3) Sistema genera PDF final firmado (con evidencia) y lo almacena
4) Cliente obtiene el PDF firmado al instante (QR + email)
5) Cliente final tiene repositorio federado por negocios (mismo usuario global)

## MVP (debe salir primero)
- Multi-tenant (negocio)
- UI empleado (mostrador) para crear sesión y subir PDF
- UI firmante para firmar en canvas
- Estado de sesión y sincronización (polling MVP; realtime opcional)
- Motor PDF: **NO** insertar firma sobre el PDF original; **añadir página extra de “Certificado de entrega firmada”** y hacer merge
- Repositorio por cliente final (mínimo): listado de PDFs por negocio
- Entrega: QR de descarga inmediata + email opcional
- RLS en Supabase
- Despliegue en modo SaaS con dominios y branding base

## Supuestos
- El PDF original se genera fuera (ERP).  
- El firmante puede tener o no email/teléfono en el momento (identidad progresiva).  
- La firma se captura como PNG (o JPEG si se decide).  
- El sistema debe funcionar sin instalar nada en el negocio (V1).  
- (V2) Agente local Windows para guardar en carpeta fija si se desea.

### Output de la fase 0 (obligatorio)
1) Documento de requisitos + MVP/No-MVP
2) Riesgos y decisiones
3) Backlog de historias de usuario

Checklist validación fase 0
- [ ] MVP definido en 3 pantallas (mostrador, firmante, repositorio/descarga)
- [ ] Decisión: página de firma añadida (universal)
- [ ] Identidad progresiva (sin registro obligatorio)
- [ ] Flujo “firma y PDF en cualquier orden” definido

---

# FASE 1 — Producto, modelo de negocio y posicionamiento

## Propuesta de valor (copy)
No vender “firma digital”; vender:
- “**Archivo digital automático de entregas firmadas**”
- “**Nunca más pierdas un albarán firmado**”
- “**Copia digital inmediata para el cliente (QR + email)**”

## Mercado objetivo inicial
- Comercios de suministros y materiales con alto volumen de albaranes
- Negocios locales (estrategia de arranque: periodo gratuito)

## Modelo de negocio SaaS
Definir planes (ejemplo):
- Básico: X documentos/mes, Y GB storage, retención Z meses
- Pro: ilimitado o más cuota, branding, notificaciones, multi-tienda
- Distribuidor: múltiples tenants

Definir pricing y límites técnicos:
- nº documentos/mes
- almacenamiento
- retención
- nº empleados
- nº clientes finales
- nº notificaciones email

## Diferenciadores V1
- “Página de certificado” universal (sin configurar posiciones)
- Entrega instantánea QR
- Repositorio federado por negocios para el cliente final
- Cero integración ERP

### Output fase 1
- Documento de producto (PRD)
- Planes, límites, pricing, periodo gratuito, onboarding
- MVP comercial (cómo se vende, proceso de alta)

Checklist fase 1
- [ ] Mensaje comercial claro
- [ ] Planes y límites definidos
- [ ] Onboarding sin fricción definido

---

# FASE 2 — Arquitectura técnica end-to-end (Next.js + Supabase)

## Arquitectura
Un único monorepo Next.js con:
- Rutas UI “mostrador” y “firmante”
- API routes / server actions para operaciones críticas
- Supabase:
  - Auth (empleados)
  - DB (sesiones, docs, clientes, tokens)
  - Storage (pdfs y firmas)
  - Realtime opcional (cambios de estado)

## Separación de UIs
- `/counter/new` (crear entrega)
- `/counter/[sessionId]` (estado + dropzone PDF)
- `/sign/[sessionId]` (firmar)
- `/d/[accessToken]` (descarga directa del PDF final, token temporal)
- `/portal` (cliente final: listado por negocio)

## Sincronización
- MVP: polling en `/counter/[sessionId]` a `/api/sessions/:id`
- Opcional: Supabase Realtime para cambios en `sessions.status`

## Storage
Buckets:
- `signatures/` (PNG firma, opcional borrar tras final)
- `docs-original/` (PDF ERP)
- `docs-final/` (PDF final firmado)

### Output fase 2
- Diagrama arquitectura
- Decisiones: polling vs realtime, server actions vs api routes
- Estructura de carpetas Next.js

Checklist fase 2
- [ ] Rutas definidas
- [ ] Responsabilidades claras (UI vs API vs DB vs Storage)
- [ ] Estrategia sincronización MVP elegida

---

# FASE 3 — Modelo de datos Postgres + RLS (seguridad por diseño)

## Entidades (mínimo)
- `tenants` (negocios)
- `tenant_users` (empleados por tenant)
- `client_global` (cliente final global)
- `tenant_client` (relación negocio↔cliente final)
- `sessions` (entrega en curso)
- `documents` (PDF original + final)
- `access_tokens` (QR/email, expirables)
- `audit_events` (opcional V1 o V1.1)

## Estados sesión y “join”
`CREATED`, `OPEN`, `SIGNED`, `PDF_UPLOADED`, `FINALIZED`, `CLOSED`, `EXPIRED`

Regla “join”:
- si `signature_path` y `pdf_original_path` existen → generar final y set `FINALIZED`

## RLS (obligatorio)
- Empleados solo ven filas con su `tenant_id`
- Cliente final solo ve docs asociados a su `client_global_id`
- Acceso por token: endpoint público valida `access_tokens` y sirve PDF (no bypass directo a Storage público salvo presigned URLs)

### Output fase 3
- SQL (DDL) completo con índices
- Políticas RLS
- Triggers opcionales (updated_at) y TTL fields

Checklist fase 3
- [ ] Multi-tenant aislado con RLS
- [ ] Cliente global federado sin mezclar privacidad
- [ ] Estados y campos mínimos implementados

---

# FASE 4 — Flujos UX/UI (empleado y firmante) + sincronización

## UX mostrador (1 pantalla)
Objetivo: que el empleado no cambie su proceso.
Pantalla:
- input doc_num
- select/crear cliente (mínimo: nombre, DNI, email opcional)
- botón “Mostrar firma”
- al crear sesión: QR + link + estado (Firma/PDF)
- dropzone PDF siempre visible (“arrastrar aquí”)
- cuando `FINALIZED`: mostrar “Listo” + botón reenviar email + mostrar QR final

## UX firmante
- muestra datos (doc, empresa, nombre, DNI parcial)
- canvas + limpiar
- “Enviar firma”
- al enviar: “procesando”
- si finalizado: mostrar QR descarga (o mensaje “listo en mostrador”)

## Sincronización
- polling: 1–2s en mostrador
- idempotencia: subidas repetidas no rompen el flujo

### Output fase 4
- Wireframes (texto/ASCII) + componentes listados
- Lógica de estados en UI
- Estrategia de errores: reintentos, offline

Checklist fase 4
- [ ] 3 pantallas MVP definidas con detalle
- [ ] UX sin fricción para empleado
- [ ] Firmante sin registro obligatorio

---

# FASE 5 — Firma (canvas) + envío + optimización

## Captura
- canvas adaptativo
- evitar base64 si posible (multipart o blob)
- limitar tamaño: resolución razonable (p.ej. 800x300)
- fondo blanco

## API
- `POST /api/sessions/:id/signature` (blob/png)
Valida:
- estado permitido
- tamaño
- tipo MIME
Guarda en `signatures/` y set `signature_path`, `status=SIGNED` (o mantiene PDF_UPLOADED si ya subió PDF)

### Output fase 5
- Código UI canvas
- Código API subida firma
- Pruebas manuales y límites de tamaño

Checklist fase 5
- [ ] Firma se captura y sube estable
- [ ] Tamaño controlado
- [ ] Idempotencia (reenvío firma)

---

# FASE 6 — Subida de PDF (drag & drop) + “join” por sesión

## Subida PDF original
- `POST /api/sessions/:id/pdf` (multipart)
Validar:
- PDF real
- tamaño razonable
Guardar en `docs-original/` y set `pdf_original_path`, `status=PDF_UPLOADED` si no hay firma aún

### Output fase 6
- Componente dropzone
- API subida PDF
- Manejo de múltiples páginas y tamaños

Checklist fase 6
- [ ] Se sube PDF sin fricción
- [ ] Orden firma/PDF indiferente
- [ ] Estado correcto en DB

---

# FASE 7 — Motor PDF universal (página de firma + merge) + hash

## Requisito clave
**No** insertar firma en coordenadas del PDF original.  
Generar `signature_page.pdf` con:
- datos de entrega
- imagen firma
- hash SHA-256 del PDF original
- timestamp
- identificador de sesión
y hacer merge: `original + signature_page`.

## Implementación
- En backend (API route):
  1) descargar original desde Storage
  2) calcular SHA-256
  3) generar página extra con librería PDF
  4) merge y subir final a `docs-final/`
  5) set `pdf_final_path`, `status=FINALIZED`
  6) generar `access_token` para QR/email

## Trigger de composición
- cuando se detecte que ambos (firma+pdf) existen:
  - al subir firma o al subir pdf, llamar a `tryFinalize(session_id)` idempotente

### Output fase 7
- Código del motor PDF
- Función `tryFinalize` idempotente
- Tests con PDFs variados

Checklist fase 7
- [ ] PDF final se genera siempre
- [ ] Original intacto
- [ ] Hash incluido y verificable
- [ ] Idempotencia al reintentar

---

# FASE 8 — Entrega inmediata: QR y enlace temporal + email

## QR
- se muestra en firmante y/o mostrador cuando `FINALIZED`
- contiene URL: `/d/{accessToken}`

## Access token
- tabla `access_tokens` con expiración (24–72h)
- “single_use” opcional

## Email
- si hay email del cliente:
  - enviar email con enlace a `/d/{accessToken}`
- plantillas por tenant (branding simple)

### Output fase 8
- Generación QR
- Endpoint descarga `/d/:token`
- Servicio de emails (Resend/SendGrid) + plantilla

Checklist fase 8
- [ ] QR descarga funciona
- [ ] Token expira y es revocable
- [ ] Email se envía y tiene tracking básico

---

# FASE 9 — Repositorio cliente global federado (multi-negocio)

## Portal cliente final
- Identidad progresiva:
  - acceso inicial por token
  - opción de “activar cuenta” después (crear contraseña o magic link)
- Vista:
  - lista de negocios (tenants) con documentos
  - filtros por fecha/doc_num

## Privacidad
- Cliente solo ve sus documentos
- Tenants solo ven los suyos

### Output fase 9
- UI portal cliente
- Flujos de activación progresiva
- Políticas RLS reforzadas

Checklist fase 9
- [ ] Cliente ve documentos por negocio
- [ ] Acceso sin registro inicial funciona
- [ ] Activación opcional posterior

---

# FASE 10 — Observabilidad, auditoría, retención y RGPD

## Auditoría mínima
Registrar eventos:
- session_created
- signature_uploaded
- pdf_uploaded
- finalized
- token_generated
- downloaded
- emailed
- closed/expired

## Retención y borrado
- definir política por plan
- borrar firma PNG tras final (opcional)
- expiración sesiones no finalizadas (TTL)
- endpoint/admin para borrado

## RGPD
- minimización de datos
- hashing de DNI
- exportación y borrado por cliente
- logs sin datos sensibles

### Output fase 10
- Tabla audit_events
- Jobs/cron (si aplica) o limpieza “lazy”
- Documento RGPD/seguridad

Checklist fase 10
- [ ] Trazabilidad
- [ ] TTL implementado
- [ ] Minimización datos

---

# FASE 11 — Suscripciones SaaS (Stripe), cuotas y planes

## Stripe
- checkout
- webhook `invoice.paid`, `customer.subscription.updated`, etc.
- sincronizar plan en `tenants.plan`
- enforcement de límites (docs/mes, storage)

### Output fase 11
- Integración Stripe completa
- Middleware de límites (rate limits / quotas)
- Panel admin tenant (billing)

Checklist fase 11
- [ ] Alta y pago funcional
- [ ] Webhooks robustos e idempotentes
- [ ] Límites aplicados correctamente

---

# FASE 12 — Despliegue, dominios, hardening y checklist producción

## Despliegue
- Next.js en Vercel (u otro)
- Supabase project (EU region si posible)
- Variables entorno
- Storage buckets y policies

## Dominios
- `app.tudominio.com` (empleados)
- `docs.tudominio.com` (cliente final / tokens)
- subdominios por tenant opcional (branding)

## Hardening
- rate limiting (por IP/token)
- validaciones
- CSP/headers
- protección de endpoints públicos

### Output fase 12
- Guía deploy paso a paso
- Checklist de producción
- Plan de rollback

Checklist fase 12
- [ ] Entorno prod listo
- [ ] Seguridad básica aplicada
- [ ] Monitorización mínima

---

# FASE 13 — Roadmap V2 (opcional)

- Agente local Windows para guardar en carpeta fija (solo si se requiere automatización total en red local)
- OCR / extracción de datos del PDF
- Plantillas de página de firma por tenant
- Integración con WhatsApp
- API pública para ERPs modernos
- Firma avanzada (certificado) si se decide

---

# INSTRUCCIÓN DE EJECUCIÓN (para la IA)

1) **Empieza en Fase 0** y produce los outputs exigidos.
2) En cada fase, entrega:
   - decisiones (con pros/contras)
   - código listo para pegar (cuando aplique)
   - checklist de validación y pruebas manuales
3) No avances de fase hasta que el checklist de la fase esté completo.

---

# CRITERIOS DE ÉXITO (Definition of Done)

- Un negocio puede:
  1) crear sesión
  2) obtener firma en móvil/tablet
  3) subir PDF del ERP por drag & drop
  4) obtener PDF final firmado con página de certificado
  5) entregar al cliente por QR/email
- El cliente final puede:
  - acceder sin registro inicial
  - ver sus documentos por negocio en un portal
- El sistema está desplegado en modo SaaS con multi-tenant, RLS y billing.

---

# NOTAS IMPORTANTES
- Prioriza **MVP vendible** en 3 pantallas.
- Evita features no esenciales hasta que V1 esté estable.
- Mantén todo multi-tenant desde el minuto 1 (RLS).
- La firma se anexa como página extra para universalidad.



