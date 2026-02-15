import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/download/[token]/info - Info pública del documento (sin descargar)
// Usado por la página /d/[token] para mostrar datos antes de descargar
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: accessToken, error: tokenError } = await supabase
    .from('access_tokens')
    .select('session_id, expires_at, revoked_at')
    .eq('token', token)
    .single();

  if (tokenError || !accessToken) {
    return NextResponse.json(
      { error: 'Token no encontrado', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  if (accessToken.revoked_at) {
    return NextResponse.json(
      { error: 'Token revocado', code: 'REVOKED' },
      { status: 410 },
    );
  }

  const expired = new Date(accessToken.expires_at) < new Date();
  if (expired) {
    return NextResponse.json(
      { error: 'Token expirado', code: 'EXPIRED' },
      { status: 410 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(
      `
      id,
      doc_num,
      status,
      finalized_at,
      tenant:tenant_id ( name ),
      tenant_client:tenant_client_id (
        client_global:client_global_id ( full_name )
      )
    `,
    )
    .eq('id', accessToken.session_id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Sesion no encontrada', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = session.tenant as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tc = session.tenant_client as any;

  return NextResponse.json({
    doc_num: session.doc_num,
    tenant_name: tenant?.name || '',
    client_name: tc?.client_global?.full_name || '',
    finalized_at: session.finalized_at,
    expires_at: accessToken.expires_at,
  });
}
