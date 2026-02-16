-- ============================================================
-- RESET COMPLETO - Borrar todos los datos y reinicializar
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- IMPORTANTE: Despues de ejecutar este SQL, lanzar:
--   npx tsx scripts/create-admin.ts
-- para crear el usuario admin via la Admin API de Supabase.
--
-- NOTA: Los ficheros de Storage hay que borrarlos manualmente
--       desde Dashboard > Storage > session-files
-- ============================================================

-- 1. Borrar datos de todas las tablas (orden por dependencias FK)
TRUNCATE TABLE audit_events CASCADE;
TRUNCATE TABLE access_tokens CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE tenant_client CASCADE;
TRUNCATE TABLE client_companies CASCADE;
TRUNCATE TABLE client_global CASCADE;
TRUNCATE TABLE tenant_users CASCADE;
TRUNCATE TABLE tenants CASCADE;

-- 2. Borrar TODOS los usuarios de auth (CASCADE limpia sessions, identities, etc.)
TRUNCATE auth.users CASCADE;

-- 3. Crear tenant demo (el usuario admin se crea via scripts/create-admin.ts)
INSERT INTO tenants (name, slug, plan)
VALUES ('Empresa Demo', 'demo', 'free');
