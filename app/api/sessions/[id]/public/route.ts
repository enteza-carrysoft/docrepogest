import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/sessions/[id]/public - Info pública de sesión (para firmante)
// No requiere autenticación - usa service role client
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = createServiceClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .select(
      `
      id,
      doc_num,
      status,
      signature_path,
      created_at,
      tenant:tenant_id (
        name
      ),
      tenant_client:tenant_client_id (
        client_global:client_global_id (
          full_name
        )
      )
    `,
    )
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }

  // Solo exponer datos mínimos (nunca paths internos ni PII completa)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = session.tenant as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tc = session.tenant_client as any;

  return NextResponse.json({
    id: session.id,
    doc_num: session.doc_num,
    status: session.status,
    has_signature: !!session.signature_path,
    created_at: session.created_at,
    tenant_name: tenant?.name || '',
    client_name: tc?.client_global?.full_name || '',
  });
}
