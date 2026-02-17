import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sessions/terminal/active - Obtener sesion pendiente de firma en terminal
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const terminalToken = searchParams.get('terminalToken');

  let tenantUserId: string;
  let tenantId: string;

  if (terminalToken) {
    // Auth por Token (Tablet física)
    const { data: tenantUser, error } = await supabase
      .from('tenant_users')
      .select('id, tenant_id')
      .eq('terminal_token', terminalToken)
      .eq('active', true)
      .single();

    if (error || !tenantUser) {
      return NextResponse.json({ error: 'Token de terminal inválido' }, { status: 401 });
    }
    tenantUserId = tenantUser.id;
    tenantId = tenantUser.tenant_id;
  } else {
    // Auth por Sesión (Navegador normal)
    const { data: { user } } = await supabase.auth.getUser();

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
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    tenantUserId = tenantUser.id;
    tenantId = tenantUser.tenant_id;
  }

  // Buscar sesión pendiente de terminal (1:1 con el empleado/terminal)
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id,
      doc_num,
      status,
      pending_terminal_at,
      tenant_client:tenant_client_id (
        id,
        client_global:client_global_id (
          full_name
        )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('tenant_user_id', tenantUserId) // Emparejamiento 1:1
    .not('pending_terminal_at', 'is', null)
    .in('status', ['CREATED', 'PDF_UPLOADED'])
    .order('pending_terminal_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ session: null });
  }

  // Aplanar datos para el terminal
  const tc = session.tenant_client as any;
  const clientName: string = tc?.client_global?.full_name ?? 'Cliente';

  return NextResponse.json({
    session: {
      id: session.id,
      doc_num: session.doc_num,
      status: session.status,
      client_name: clientName,
      pending_terminal_at: session.pending_terminal_at,
    },
  });
}
