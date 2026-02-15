-- ============================================================
-- Entregas Firmadas - Seed data para desarrollo
-- Ejecutar DESPUÉS de schema.sql y rls.sql
-- ============================================================

-- Tenant de prueba
insert into tenants (id, name, slug, plan)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Empresa S.L.',
  'demo-empresa',
  'free'
);

-- NOTA: tenant_users requiere un auth.users real de Supabase.
-- Crear un usuario en Supabase Auth primero, luego:
--
-- insert into tenant_users (tenant_id, auth_user_id, role, name, email)
-- values (
--   '00000000-0000-0000-0000-000000000001',
--   'AUTH_USER_UUID_HERE',
--   'admin',
--   'Admin Demo',
--   'admin@demo.com'
-- );
