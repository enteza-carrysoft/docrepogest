import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/sessions/[id]/terminal - Marcar sesion para firma en terminal fijo
export async function POST(
  _request: NextRequest,
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

  // Verificar que es empleado del tenant
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  if (!tenantUser) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 403 },
    );
  }

  // Verificar que la sesion existe, pertenece al tenant y esta en estado valido
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, signature_path, tenant_id')
    .eq('id', sessionId)
    .eq('tenant_id', tenantUser.tenant_id)
    .single();

  if (!session) {
    return NextResponse.json(
      { error: 'Sesion no encontrada' },
      { status: 404 },
    );
  }

  if (!['CREATED', 'PDF_UPLOADED'].includes(session.status)) {
    return NextResponse.json(
      { error: 'La sesion no acepta firmas en este estado' },
      { status: 409 },
    );
  }

  if (session.signature_path) {
    return NextResponse.json(
      { error: 'La sesion ya tiene firma' },
      { status: 409 },
    );
  }

  // Marcar sesion para terminal
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ pending_terminal_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (updateError) {
    return NextResponse.json(
      { error: 'Error al activar terminal', detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/sessions/[id]/terminal - Cancelar firma en terminal
export async function DELETE(
  _request: NextRequest,
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

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  if (!tenantUser) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 403 },
    );
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ pending_terminal_at: null })
    .eq('id', sessionId)
    .eq('tenant_id', tenantUser.tenant_id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Error al cancelar terminal', detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
