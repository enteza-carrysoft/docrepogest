import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/download/[token] - Descargar PDF final por token
// Endpoint público: no requiere autenticación
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceClient();

  // 1. Buscar token
  const { data: accessToken, error: tokenError } = await supabase
    .from('access_tokens')
    .select('id, session_id, tenant_id, expires_at, used_at, revoked_at')
    .eq('token', token)
    .single();

  if (tokenError || !accessToken) {
    return NextResponse.json(
      { error: 'Token no encontrado' },
      { status: 404 },
    );
  }

  // 2. Validar token
  if (accessToken.revoked_at) {
    return NextResponse.json(
      { error: 'Token revocado' },
      { status: 410 },
    );
  }

  if (new Date(accessToken.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Token expirado' },
      { status: 410 },
    );
  }

  // 3. Obtener sesión con pdf_final_path
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, pdf_final_path, doc_num, status')
    .eq('id', accessToken.session_id)
    .single();

  if (sessionError || !session || !session.pdf_final_path) {
    return NextResponse.json(
      { error: 'Documento no disponible' },
      { status: 404 },
    );
  }

  // 4. Descargar PDF desde Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('docs-final')
    .download(session.pdf_final_path);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: 'Error al descargar documento' },
      { status: 500 },
    );
  }

  // 5. Marcar token como usado (primera descarga)
  if (!accessToken.used_at) {
    await supabase
      .from('access_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', accessToken.id);
  }

  // 6. Audit
  await supabase.from('audit_events').insert({
    tenant_id: accessToken.tenant_id,
    session_id: accessToken.session_id,
    event_type: 'document_downloaded',
    actor_type: 'client',
    metadata: { token_id: accessToken.id },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
  });

  // 7. Retornar PDF como descarga
  const filename = session.doc_num
    ? `entrega-${session.doc_num}.pdf`
    : `entrega-${session.id.slice(0, 8)}.pdf`;

  const buffer = await fileData.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.byteLength.toString(),
    },
  });
}
