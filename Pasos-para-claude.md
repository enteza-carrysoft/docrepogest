# 🧠 MASTER PROMPT — CLAUDE CODE
## Desarrollo completo SaaS “Entregas Firmadas” (Next.js + Supabase)
### Optimizado para ejecución autónoma por Claude Code (nivel Senior/Staff Engineer)

---

# 🎯 OBJETIVO DEL AGENTE

Actúa como un **Staff Software Engineer + CTO fundador** construyendo un producto SaaS real listo para producción.

Debes desarrollar **de extremo a extremo** una plataforma SaaS que permita:

1. Capturar firmas manuscritas desde móvil/tablet.
2. Asociarlas a un documento PDF generado por un ERP externo.
3. Generar automáticamente un **PDF firmado certificado**.
4. Entregarlo instantáneamente al cliente mediante QR y email.
5. Mantener un repositorio documental compartido por cliente final entre múltiples negocios.
6. Operar en modo **multi-tenant SaaS**.

El sistema debe poder venderse comercialmente a miles de pymes.

---

# ⚠️ REGLAS DE EJECUCIÓN (CRÍTICAS PARA CLAUDE CODE)

## Debes trabajar en modo **AGENTIC LOOP**

En cada fase:

1. Analiza el problema.
2. Diseña arquitectura.
3. Implementa código real.
4. Valida coherencia técnica.
5. Refactoriza si detectas simplificación posible.
6. Continúa.

❗ NO avances si la fase anterior no está coherente.

---

## PRINCIPIOS OBLIGATORIOS

- Pensar como producto SaaS real, no demo.
- Minimizar fricción del usuario.
- Evitar sobreingeniería.
- Seguridad por diseño.
- Multi-tenant desde el inicio.
- Idempotencia en operaciones críticas.
- Código production-ready.

---

# 🧱 STACK TECNOLÓGICO (FIJO)

## Frontend + Backend
- Next.js (App Router)
- TypeScript obligatorio
- Server Actions + Route Handlers

## Backend Platform
- Supabase:
  - Postgres
  - Auth
  - Storage
  - Realtime (opcional)
  - RLS obligatorio

## Infraestructura
- Deploy compatible con Vercel
- Arquitectura serverless-first

---

# 🧠 CONCEPTO CENTRAL DEL PRODUCTO

NO es un sistema de firma.

Es:

> **Sistema SaaS de entrega digital certificada de documentos comerciales.**

---

# 🧭 FLUJO FUNCIONAL PRINCIPAL

## MOSTRADOR (empleado)
1. Crear sesión de entrega.
2. Mostrar QR.
3. Cliente firma.
4. Empleado arrastra PDF generado por ERP.
5. Sistema genera documento final.
6. Cliente recibe copia inmediata.

## CLIENTE FINAL
- Firma sin registro.
- Acceso inmediato por QR.
- Repositorio automático multi-negocio.

---

# 🧩 DECISIÓN ARQUITECTÓNICA CLAVE

❌ Nunca insertar firma dentro del PDF original.

✅ Siempre:


Esto debe implementarse desde el inicio.

---

# 📁 ESTRUCTURA DE REPO ESPERADA

Claude debe crear:

/app
/(counter)
/(sign)
/(portal)
/api
/lib
/supabase
/pdf
/auth
/tokens
/components
/database
schema.sql
rls.sql
/scripts


---

# 🧱 MODELO DE DATOS (OBLIGATORIO)

## tenants
Empresas SaaS.

## tenant_users
Usuarios empleados.

## client_global
Cliente final único global.

## tenant_client
Relación empresa ↔ cliente.

## sessions
Proceso de firma.

Estados:

CREATED
SIGNED
PDF_UPLOADED
FINALIZED
CLOSED
EXPIRED


## documents
PDF original y final.

## access_tokens
Tokens QR/email temporales.

---

# 🔐 SEGURIDAD (NO OPCIONAL)

- RLS activo en TODAS las tablas.
- tenant isolation total.
- tokens firmados y expirables.
- jamás exponer storage público directo.

---

# 🔄 SINCRONIZACIÓN ENTRE PANTALLAS

Claude debe implementar:

### MVP
Polling inteligente cada 1–2s.

### Arquitectura preparada para:
Supabase realtime posterior.

---

# ✍️ CAPTURA DE FIRMA

- Canvas HTML5
- Export blob PNG/JPEG
- Subida multipart
- Control tamaño
- Fondo blanco

---

# 📄 MOTOR PDF (CRÍTICO)

Claude debe implementar módulo:

/lib/pdf/composeSignedDocument.ts


Pipeline:

1. Descargar PDF original.
2. Calcular SHA256.
3. Generar página certificación.
4. Insertar firma.
5. Merge PDFs.
6. Subir resultado.
7. Actualizar estado FINALIZED.

Debe ser:
- idempotente
- tolerante a reintentos

---

# 📲 ENTREGA INMEDIATA

Cuando FINALIZED:

1. Generar access_token.
2. Crear QR dinámico.
3. Mostrar en pantalla firmante.
4. Enviar email si existe.

Ruta pública:

/d/[token]


---

# 👤 IDENTIDAD PROGRESIVA

NO pedir registro antes.

Crear usuario silencioso:

hash(email || telefono || dni)

hash(email || telefono || dni)


Activación opcional posterior.

---

# 🗂 PORTAL CLIENTE GLOBAL

Vista:



Mis documentos
├ Empresa A
├ Empresa B
└ Empresa C


---

# 💰 CAPA SAAS

Preparar estructura para:

- Stripe subscriptions
- planes
- límites por tenant
- periodo gratuito

(No implementar UI compleja aún.)

---

# 📊 OBSERVABILIDAD

Crear tabla:



audit_events


Registrar:
- firma subida
- pdf subido
- documento generado
- descarga
- email enviado

---

# 🚀 FASES DE IMPLEMENTACIÓN (ORDEN OBLIGATORIO)

## Fase 1
Schema SQL + RLS.

## Fase 2
Creación sesión + UI mostrador.

## Fase 3
Pantalla firma móvil.

## Fase 4
Subida firma.

## Fase 5
Subida PDF.

## Fase 6
Motor PDF.

## Fase 7
Entrega QR + descarga.

## Fase 8
Portal cliente.

## Fase 9
Hardening y cleanup.

---

# ✅ CRITERIOS DE FINALIZACIÓN

El sistema estará terminado cuando:

- Un negocio pueda crear sesión.
- Un cliente firme desde móvil.
- El empleado suba PDF ERP.
- Se genere PDF final certificado.
- Cliente lo descargue vía QR.
- Documento aparezca en portal cliente.

---

# 🧠 COMPORTAMIENTO ESPERADO DE CLAUDE

Claude debe:

- generar código completo
- crear migraciones SQL
- explicar decisiones críticas brevemente
- detectar inconsistencias
- autocorregirse
- mantener coherencia arquitectónica

NO generar explicaciones largas innecesarias.

Priorizar implementación funcional.

---

# 🚨 INSTRUCCIÓN FINAL

Comienza inmediatamente por:



FASE 1 — Diseño e implementación del esquema de base de datos y políticas RLS.


No avanzar hasta validar integridad multi-tenant.

el ANTI-ERRORES ARQUITECTÓNICOS (los 12 fallos que más suelen reventar este tipo de SaaS y cómo evitarlos desde el minuto 1). Guárdalo y pégaselo también a Claude Code antes de que empiece a picar.

1) Mezclar “cliente final” dentro del tenant

Error: tenant -> clientes -> documentos y duplicas el mismo cliente por negocio.
Solución: client_global independiente + tabla puente tenant_client.

2) No hacer RLS desde el principio

Error: “lo pongo después”. Luego no hay forma limpia de arreglarlo.
Solución: RLS en todas las tablas desde Fase 1, con políticas mínimas y testeadas.

3) “Sesión” en memoria (serverless)

Error: guardar estado en RAM o confiar en instancia.
Solución: estado en sessions con status + paths; todo idempotente.

4) Insertar la firma “en coordenadas” del PDF original

Error: cada ERP cambia el layout → soporte infinito.
Solución: añadir página final de certificado y merge universal (V1).

5) Rasterizar el PDF

Error: convertir a imágenes → baja calidad, peso, problemas legales.
Solución: mantener PDF original intacto; solo añades una página vectorial + PNG firma.

6) Dependencia del orden (firma primero / PDF primero)

Error: la UX falla si cambia el orden.
Solución: “join por sesión”: cuando existan signature_path y pdf_original_path → tryFinalize().

7) No hacer tryFinalize() idempotente

Error: reintentos o doble click generan 2 PDFs finales o estados corruptos.
Solución: lock lógico (p.ej. finalizing_at), o “compare-and-set” en DB; si ya FINALIZED, no haces nada.

8) Tokens de descarga inseguros o permanentes

Error: URL pública eterna → filtraciones.
Solución: access_tokens expirables + revocables; /d/[token] valida y sirve.

9) Guardar PII “en claro” sin normalizar

Error: emails con mayúsculas/espacios → duplicados; DNI expuesto.
Solución: normaliza y guarda hashes (dni_hash, email_norm), minimiza campos.

10) Hacer el motor PDF en el cliente

Error: el navegador no es fiable (memoria, seguridad, dispositivos).
Solución: motor PDF server-side (route handler) y subida a Storage.

11) Storage público directo

Error: bucket público y enlaces directos → no controlas acceso/retención.
Solución: bucket privado + firmas/URLs temporales generadas por backend o streaming vía endpoint.

12) Meter Stripe/billing demasiado pronto

Error: te frena el MVP.
Solución: prepara estructura (tenants.plan, quotas) pero integra Stripe cuando el flujo core funcione.


“Antes de codificar, revisa estos 12 puntos y confirma explícitamente que tu diseño los cumple.”

