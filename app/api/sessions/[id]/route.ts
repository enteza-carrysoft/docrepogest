import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sessions/[id] - Estado de sesión (polling desde mostrador)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .select(
      `
      *,
      tenant_client:tenant_client_id (
        id,
        internal_ref,
        client_global:client_global_id (
          id,
          full_name,
          email_norm
        )
      )
    `,
    )
    .eq('id', id)
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }

  // Si está FINALIZED, incluir el access_token activo para QR
  let access_token: { token: string; expires_at: string } | null = null;

  if (session.status === 'FINALIZED') {
    const { data: tokenData } = await supabase
      .from('access_tokens')
      .select('token, expires_at')
      .eq('session_id', id)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    access_token = tokenData;
  }

  return NextResponse.json({ ...session, access_token });
}
