import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/portal/link - Auto-link client_global by email on first login
// Uses service client to bypass RLS (client has no auth_user_id yet)
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const service = createServiceClient();

  // Check if already linked
  const { data: existing } = await service
    .from('client_global')
    .select('id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ linked: true, client_id: existing.id });
  }

  // Find client_global by email
  const emailNorm = user.email.toLowerCase().trim();

  const { data: client } = await service
    .from('client_global')
    .select('id, auth_user_id')
    .eq('email_norm', emailNorm)
    .is('auth_user_id', null)
    .limit(1)
    .single();

  if (!client) {
    return NextResponse.json(
      { linked: false, error: 'No se encontraron entregas asociadas a este email' },
      { status: 404 },
    );
  }

  // Link auth_user_id
  await service
    .from('client_global')
    .update({ auth_user_id: user.id })
    .eq('id', client.id);

  return NextResponse.json({ linked: true, client_id: client.id });
}
