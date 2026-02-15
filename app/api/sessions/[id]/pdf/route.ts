import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryFinalize } from '@/lib/pdf/try-finalize';

// POST /api/sessions/[id]/pdf - Subir PDF original del ERP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Verificar sesión existe y pertenece al tenant
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, tenant_id, status, pdf_original_path')
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
      { error: 'La sesión ya no acepta archivos' },
      { status: 409 },
    );
  }

  // Idempotencia: si ya tiene PDF, ignorar
  if (session.pdf_original_path) {
    return NextResponse.json({ message: 'PDF ya subido', session_id: sessionId });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Solo se permiten archivos PDF' },
      { status: 400 },
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'El archivo excede 20MB' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${session.tenant_id}/${sessionId}/original.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('docs-original')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: 'Error al subir archivo', detail: uploadError.message },
      { status: 500 },
    );
  }

  // Actualizar sesión con path del PDF
  await supabase
    .from('sessions')
    .update({
      pdf_original_path: storagePath,
      status: 'PDF_UPLOADED',
    })
    .eq('id', sessionId);

  // Registrar documento
  await supabase.from('documents').insert({
    session_id: sessionId,
    tenant_id: session.tenant_id,
    type: 'original',
    storage_path: storagePath,
    file_size: file.size,
    mime_type: 'application/pdf',
  });

  // Audit
  await supabase.from('audit_events').insert({
    tenant_id: session.tenant_id,
    session_id: sessionId,
    event_type: 'pdf_uploaded',
    actor_type: 'employee',
    actor_id: user.id,
    metadata: { file_size: file.size },
  });

  // tryFinalize: si ya tiene firma, generar PDF final
  const result = await tryFinalize(supabase, sessionId);

  return NextResponse.json({
    message: 'PDF subido',
    session_id: sessionId,
    finalized: result.finalized,
  });
}
