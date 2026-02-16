import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper: get authenticated tenant user
async function getTenantUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  return tenantUser;
}

// GET /api/client-companies?q=term - Search companies for current tenant
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const tenantUser = await getTenantUser(supabase);

  if (!tenantUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q') || '';

  let query = supabase
    .from('client_companies')
    .select('id, name, cif_nif, contact_email, phone, active')
    .eq('tenant_id', tenantUser.tenant_id)
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(20);

  if (q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Error al buscar empresas' },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

// POST /api/client-companies - Create a new client company
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const tenantUser = await getTenantUser(supabase);

  if (!tenantUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { name, cif_nif, address, contact_email, phone } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: 'El nombre de la empresa es obligatorio' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('client_companies')
    .insert({
      tenant_id: tenantUser.tenant_id,
      name: name.trim(),
      cif_nif: cif_nif?.trim() || null,
      address: address?.trim() || null,
      contact_email: contact_email?.trim()?.toLowerCase() || null,
      phone: phone?.trim() || null,
    })
    .select('id, name, cif_nif')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Error al crear empresa', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
