import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !serviceKey || !anonKey) {
  console.error('Faltan variables de entorno. Asegurate de exportar .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Creando usuario admin via Admin API...\n');

  // 1. Crear usuario via Admin API
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: 'admin@demo.com',
    password: 'demo1234',
    email_confirm: true,
  });

  if (createErr) {
    console.error('Error creando usuario:', createErr.message);
    process.exit(1);
  }

  console.log('Usuario creado: %s (%s)', newUser.user.email, newUser.user.id);

  // 2. Buscar tenant demo
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', 'demo')
    .single();

  if (!tenant) {
    console.error('No existe el tenant demo. Ejecuta primero borrar_todo_el_sistema.sql');
    process.exit(1);
  }

  // 3. Vincular al tenant
  const { error: linkErr } = await supabase
    .from('tenant_users')
    .insert({
      tenant_id: tenant.id,
      auth_user_id: newUser.user.id,
      role: 'admin',
      name: 'Administrador',
      email: 'admin@demo.com',
    });

  if (linkErr) {
    console.error('Error vinculando al tenant:', linkErr.message);
    process.exit(1);
  }

  // 4. Verificar login
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: loginErr } = await anon.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'demo1234',
  });

  if (loginErr) {
    console.error('Verificacion de login fallo:', loginErr.message);
    process.exit(1);
  }

  console.log('Login verificado OK');
  console.log('\nCredenciales: admin@demo.com / demo1234');
}

main().catch((e) => console.error('FATAL:', e));
