import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sessions - Listar sesiones del tenant
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Obtener tenant_user del empleado autenticado
  const { data: tenantUser, error: tuError } = await supabase
    .from('tenant_users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  if (tuError || !tenantUser) {
    return NextResponse.json(
      { error: 'Usuario no asociado a un negocio' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');

  // Obtener sesiones del tenant con información del cliente
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      id,
      doc_num,
      status,
      created_at,
      tenant_client:tenant_client_id (
        client_global:client_global_id (
          full_name,
          email_norm
        )
      )
    `)
    .eq('tenant_id', tenantUser.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sessionsError) {
    return NextResponse.json(
      { error: 'Error al cargar sesiones', detail: sessionsError.message },
      { status: 500 },
    );
  }

  // Transformar datos para el frontend
  // Transformar datos para el frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformedSessions = sessions.map((s: any) => {
    const clientGlobal = s.tenant_client?.client_global;
    return {
      id: s.id,
      doc_num: s.doc_num,
      status: s.status,
      created_at: s.created_at,
      client_name: clientGlobal?.full_name || 'Sin nombre',
      client_email: clientGlobal?.email_norm || null,
    };
  });

  return NextResponse.json({ sessions: transformedSessions });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Obtener tenant_user del empleado autenticado
  const { data: tenantUser, error: tuError } = await supabase
    .from('tenant_users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  if (tuError || !tenantUser) {
    return NextResponse.json(
      { error: 'Usuario no asociado a un negocio' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { doc_num, tenant_client_id } = body;

  if (!tenant_client_id) {
    return NextResponse.json(
      { error: 'Cliente requerido' },
      { status: 400 },
    );
  }

  // Crear sesión
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      tenant_id: tenantUser.tenant_id,
      tenant_user_id: tenantUser.id,
      tenant_client_id,
      doc_num: doc_num || null,
      status: 'CREATED',
    })
    .select()
    .single();

  if (sessionError) {
    return NextResponse.json(
      { error: 'Error al crear sesión', detail: sessionError.message },
      { status: 500 },
    );
  }

  // Audit event
  await supabase.from('audit_events').insert({
    tenant_id: tenantUser.tenant_id,
    session_id: session.id,
    event_type: 'session_created',
    actor_type: 'employee',
    actor_id: user.id,
    metadata: { doc_num },
  });

  return NextResponse.json(session, { status: 201 });
}
