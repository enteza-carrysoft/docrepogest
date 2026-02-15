-- ============================================================
-- Entregas Firmadas - Políticas RLS multi-tenant
-- Anti-error #2: RLS desde Fase 1 en TODAS las tablas
-- ============================================================

-- 1. Helper: obtener tenant_id del usuario autenticado
-- ============================================================
create or replace function get_user_tenant_id()
returns uuid as $$
  select tenant_id
  from tenant_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$ language sql security definer stable;

-- 2. Helper: verificar si el usuario es admin de su tenant
-- ============================================================
create or replace function is_tenant_admin()
returns boolean as $$
  select exists (
    select 1
    from tenant_users
    where auth_user_id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$ language sql security definer stable;

-- 3. Helper: obtener client_global_id del usuario autenticado
-- ============================================================
create or replace function get_client_global_id()
returns uuid as $$
  select id
  from client_global
  where auth_user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;

-- ============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table client_global enable row level security;
alter table tenant_client enable row level security;
alter table sessions enable row level security;
alter table documents enable row level security;
alter table access_tokens enable row level security;
alter table audit_events enable row level security;

-- ============================================================
-- POLÍTICAS: tenants
-- Empleados ven solo su propio tenant
-- ============================================================
create policy "tenant_users can view own tenant"
  on tenants for select
  using (id = get_user_tenant_id());

create policy "admins can update own tenant"
  on tenants for update
  using (id = get_user_tenant_id() and is_tenant_admin());

-- ============================================================
-- POLÍTICAS: tenant_users
-- Empleados ven compañeros del mismo tenant
-- ============================================================
create policy "tenant_users can view same tenant members"
  on tenant_users for select
  using (tenant_id = get_user_tenant_id());

create policy "admins can insert tenant_users"
  on tenant_users for insert
  with check (tenant_id = get_user_tenant_id() and is_tenant_admin());

create policy "admins can update tenant_users"
  on tenant_users for update
  using (tenant_id = get_user_tenant_id() and is_tenant_admin());

-- ============================================================
-- POLÍTICAS: client_global
-- Clientes ven solo su propio registro
-- Empleados pueden insertar/ver clientes asociados a su tenant
-- ============================================================
create policy "clients can view own record"
  on client_global for select
  using (auth_user_id = auth.uid());

create policy "tenant_users can view associated clients"
  on client_global for select
  using (
    id in (
      select client_global_id
      from tenant_client
      where tenant_id = get_user_tenant_id()
    )
  );

create policy "tenant_users can insert clients"
  on client_global for insert
  with check (get_user_tenant_id() is not null);

create policy "tenant_users can update associated clients"
  on client_global for update
  using (
    id in (
      select client_global_id
      from tenant_client
      where tenant_id = get_user_tenant_id()
    )
  );

-- ============================================================
-- POLÍTICAS: tenant_client
-- Empleados ven las asociaciones de su tenant
-- Clientes ven sus propias asociaciones
-- ============================================================
create policy "tenant_users can view own tenant clients"
  on tenant_client for select
  using (tenant_id = get_user_tenant_id());

create policy "tenant_users can insert tenant_client"
  on tenant_client for insert
  with check (tenant_id = get_user_tenant_id());

create policy "clients can view own associations"
  on tenant_client for select
  using (client_global_id = get_client_global_id());

-- ============================================================
-- POLÍTICAS: sessions
-- Aislamiento total por tenant
-- ============================================================
create policy "tenant_users can view own tenant sessions"
  on sessions for select
  using (tenant_id = get_user_tenant_id());

create policy "tenant_users can insert sessions"
  on sessions for insert
  with check (tenant_id = get_user_tenant_id());

create policy "tenant_users can update own tenant sessions"
  on sessions for update
  using (tenant_id = get_user_tenant_id());

-- Clientes ven sesiones donde son el firmante
create policy "clients can view own sessions"
  on sessions for select
  using (
    tenant_client_id in (
      select id
      from tenant_client
      where client_global_id = get_client_global_id()
    )
  );

-- ============================================================
-- POLÍTICAS: documents
-- Aislamiento por tenant + acceso cliente a sus documentos
-- ============================================================
create policy "tenant_users can view own tenant documents"
  on documents for select
  using (tenant_id = get_user_tenant_id());

create policy "tenant_users can insert documents"
  on documents for insert
  with check (tenant_id = get_user_tenant_id());

create policy "clients can view own session documents"
  on documents for select
  using (
    session_id in (
      select s.id
      from sessions s
      join tenant_client tc on s.tenant_client_id = tc.id
      where tc.client_global_id = get_client_global_id()
    )
  );

-- ============================================================
-- POLÍTICAS: access_tokens
-- Gestión por tenant (validación pública vía API, no RLS)
-- ============================================================
create policy "tenant_users can view own tenant tokens"
  on access_tokens for select
  using (tenant_id = get_user_tenant_id());

create policy "tenant_users can insert tokens"
  on access_tokens for insert
  with check (tenant_id = get_user_tenant_id());

create policy "tenant_users can update tokens"
  on access_tokens for update
  using (tenant_id = get_user_tenant_id());

-- ============================================================
-- POLÍTICAS: audit_events
-- Solo lectura por tenant
-- ============================================================
create policy "tenant_users can view own tenant audit"
  on audit_events for select
  using (tenant_id = get_user_tenant_id());

create policy "system can insert audit events"
  on audit_events for insert
  with check (true);
