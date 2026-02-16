import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/portal/sessions - List client's sessions with filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Use service client to bypass RLS for cross-table joins
  const service = createServiceClient();

  // Get the client_global_id for this auth user
  const { data: clientGlobal } = await service
    .from('client_global')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!clientGlobal) {
    return NextResponse.json([]);
  }

  // Get all tenant_client IDs for this person
  const { data: tenantClients } = await service
    .from('tenant_client')
    .select('id, client_company_id')
    .eq('client_global_id', clientGlobal.id);

  if (!tenantClients || tenantClients.length === 0) {
    return NextResponse.json([]);
  }

  const tcIds = tenantClients.map((tc) => tc.id);

  // Build query with filters
  let query = service
    .from('sessions')
    .select(
      `
      id,
      doc_num,
      status,
      created_at,
      finalized_at,
      tenant:tenant_id ( id, name ),
      tenant_client:tenant_client_id (
        client_global:client_global_id ( full_name ),
        client_company:client_company_id ( name )
      ),
      tenant_user:tenant_user_id ( name )
    `,
    )
    .in('tenant_client_id', tcIds)
    .in('status', ['SIGNED', 'PDF_UPLOADED', 'FINALIZED', 'CLOSED'])
    .order('created_at', { ascending: false });

  // Optional filters
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  if (from) {
    query = query.gte('created_at', from);
  }
  if (to) {
    query = query.lte('created_at', `${to}T23:59:59`);
  }

  const { data: sessions, error } = await query;

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
    tenant_id: s.tenant?.id || '',
    tenant_name: s.tenant?.name || '',
    client_name: s.tenant_client?.client_global?.full_name || '',
    company_name: s.tenant_client?.client_company?.name || null,
    employee_name: s.tenant_user?.name || '',
  }));

  return NextResponse.json(mapped);
}
