import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { tryFinalize } from '@/lib/pdf/try-finalize';

// POST /api/sessions/[id]/signature - Subir firma (blob PNG)
// No requiere autenticación: el firmante accede por link directo
// Usa service role client porque el firmante no tiene sesión auth
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = createServiceClient();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, tenant_id, status, signature_path')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }

  if (['FINALIZED', 'CLOSED', 'EXPIRED'].includes(session.status)) {
    return NextResponse.json(
      { error: 'La sesión ya no acepta firmas' },
      { status: 409 },
    );
  }

  // Idempotencia: si ya tiene firma, retornar ok
  if (session.signature_path) {
    return NextResponse.json({
      message: 'Firma ya registrada',
      session_id: sessionId,
      status: session.status,
    });
  }

  const formData = await request.formData();
  const file = formData.get('signature') as File | null;

  if (!file) {
    return NextResponse.json(
      { error: 'Firma requerida' },
      { status: 400 },
    );
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Solo se permiten imágenes' },
      { status: 400 },
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'La firma excede 2MB' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
  const storagePath = `${session.tenant_id}/${sessionId}/signature.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: 'Error al subir firma', detail: uploadError.message },
      { status: 500 },
    );
  }

  // Actualizar sesión con path de firma
  await supabase
    .from('sessions')
    .update({
      signature_path: storagePath,
      status: 'SIGNED',
    })
    .eq('id', sessionId);

  // Audit
  await supabase.from('audit_events').insert({
    tenant_id: session.tenant_id,
    session_id: sessionId,
    event_type: 'signature_uploaded',
    actor_type: 'client',
    metadata: { file_size: file.size, mime_type: file.type },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
  });

  // tryFinalize: si ya tiene PDF, generar PDF final
  const result = await tryFinalize(supabase, sessionId);

  return NextResponse.json({
    message: 'Firma registrada',
    session_id: sessionId,
    finalized: result.finalized,
  });
}
