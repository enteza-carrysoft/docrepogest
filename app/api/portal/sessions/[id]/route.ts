import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/portal/sessions/[id] - Session detail for client
// RLS handles access control via get_client_global_id()
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
      id,
      doc_num,
      status,
      created_at,
      finalized_at,
      tenant:tenant_id ( name ),
      tenant_client:tenant_client_id (
        client_global:client_global_id ( full_name )
      )
    `,
    )
    .eq('id', id)
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Entrega no encontrada' },
      { status: 404 },
    );
  }

  // Check for downloadable access_token
  let download_token: string | null = null;

  if (session.status === 'FINALIZED') {
    const { data: tokenData } = await supabase
      .from('access_tokens')
      .select('token')
      .eq('session_id', id)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    download_token = tokenData?.token || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = session.tenant as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tc = session.tenant_client as any;

  return NextResponse.json({
    id: session.id,
    doc_num: session.doc_num,
    status: session.status,
    created_at: session.created_at,
    finalized_at: session.finalized_at,
    tenant_name: tenant?.name || '',
    client_name: tc?.client_global?.full_name || '',
    download_token,
  });
}
