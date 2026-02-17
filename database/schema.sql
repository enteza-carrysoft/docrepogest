-- ============================================================
-- Entregas Firmadas - Schema DDL completo
-- Fase 1: Todas las tablas, enums, indexes, triggers
-- ============================================================

-- 1. Extensiones
-- ============================================================
create extension if not exists "pgcrypto";

-- 2. Tipos ENUM
-- ============================================================
create type session_status as enum (
  'CREATED',
  'SIGNED',
  'PDF_UPLOADED',
  'FINALIZED',
  'CLOSED',
  'EXPIRED'
);

create type user_role as enum ('admin', 'employee');

create type doc_type as enum ('original', 'final');

create type token_type as enum ('qr', 'email');

create type actor_type as enum ('employee', 'client', 'system');

-- 3. Función trigger para updated_at automático
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 4. Tablas (en orden de dependencia)
-- ============================================================

-- 4.1 tenants - Empresas SaaS
-- ============================================================
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  plan        text not null default 'free',
  logo_url    text,
  settings    jsonb not null default '{}',
  max_sessions_month  int not null default 100,
  max_storage_mb      int not null default 500,
  retention_months    int not null default 12,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at();

-- 4.2 tenant_users - Empleados por tenant
-- ============================================================
create table tenant_users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  role          user_role not null default 'employee',
  name          text not null,
  email         text not null,
  active        boolean not null default true,
  terminal_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (tenant_id, auth_user_id)
);

create index idx_tenant_users_tenant on tenant_users(tenant_id);
create index idx_tenant_users_auth on tenant_users(auth_user_id);

create trigger tenant_users_updated_at
  before update on tenant_users
  for each row execute function update_updated_at();

-- 4.3 client_global - Clientes finales (INDEPENDIENTE de tenants)
-- Anti-error #1: NO dentro del tenant, tabla global + puente
-- ============================================================
create table client_global (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email_norm    text,
  phone_norm    text,
  dni_hash      text,
  auth_user_id  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_client_global_email on client_global(email_norm) where email_norm is not null;
create index idx_client_global_dni on client_global(dni_hash) where dni_hash is not null;
create index idx_client_global_auth on client_global(auth_user_id) where auth_user_id is not null;

-- 4.4 tenant_client - Puente tenant <-> cliente global
-- ============================================================
create table tenant_client (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  client_global_id  uuid not null references client_global(id) on delete cascade,
  internal_ref      text,
  created_at        timestamptz not null default now(),

  unique (tenant_id, client_global_id)
);

create index idx_tenant_client_tenant on tenant_client(tenant_id);
create index idx_tenant_client_client on tenant_client(client_global_id);

-- 4.5 sessions - Procesos de firma/entrega
-- Anti-error #3: Estado en DB, no en memoria (serverless)
-- Anti-error #6: Join por sesión (orden firma/PDF indiferente)
-- Anti-error #7: finalizing_at como lock idempotente
-- ============================================================
create table sessions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  tenant_user_id    uuid not null references tenant_users(id) on delete restrict,
  tenant_client_id  uuid not null references tenant_client(id) on delete restrict,
  doc_num           text,
  status            session_status not null default 'CREATED',
  signature_path    text,
  pdf_original_path text,
  pdf_final_path    text,
  pdf_original_hash_md5 text,
  finalizing_at     timestamptz,
  finalized_at      timestamptz,
  expires_at        timestamptz not null default (now() + interval '24 hours'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_sessions_tenant_status on sessions(tenant_id, status);
create index idx_sessions_tenant_created on sessions(tenant_id, created_at desc);
create index idx_sessions_tenant_client on sessions(tenant_client_id);
create index idx_sessions_expires on sessions(expires_at) where status not in ('FINALIZED', 'CLOSED', 'EXPIRED');

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- 4.6 documents - Registros de documentos PDF
-- ============================================================
create table documents (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  type          doc_type not null,
  storage_path  text not null,
  file_size     bigint,
  mime_type     text not null default 'application/pdf',
  hash_md5      text,
  created_at    timestamptz not null default now()
);

create index idx_documents_session on documents(session_id);
create index idx_documents_tenant on documents(tenant_id);

-- 4.7 access_tokens - Tokens temporales QR/email
-- Anti-error #8: Expirables y revocables
-- ============================================================
create table access_tokens (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  type        token_type not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_access_tokens_token on access_tokens(token);
create index idx_access_tokens_session on access_tokens(session_id);

-- 4.8 audit_events - Observabilidad
-- ============================================================
create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete set null,
  session_id  uuid references sessions(id) on delete set null,
  event_type  text not null,
  actor_type  actor_type not null,
  actor_id    uuid,
  metadata    jsonb not null default '{}',
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_tenant_created on audit_events(tenant_id, created_at desc);
create index idx_audit_event_type on audit_events(event_type);
