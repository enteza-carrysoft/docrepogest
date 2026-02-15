import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/portal/sessions - List client's sessions
// RLS handles filtering via get_client_global_id()
export async function GET(_request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // RLS policy "clients can view own sessions" filters automatically
  const { data: sessions, error } = await supabase
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
    .in('status', ['SIGNED', 'PDF_UPLOADED', 'FINALIZED', 'CLOSED'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Error al cargar entregas' },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (sessions || []).map((s: any) => ({
    id: s.id,
    doc_num: s.doc_num,
    status: s.status,
    created_at: s.created_at,
    finalized_at: s.finalized_at,
    tenant_name: s.tenant?.name || '',
    client_name: s.tenant_client?.client_global?.full_name || '',
  }));

  return NextResponse.json(mapped);
}
