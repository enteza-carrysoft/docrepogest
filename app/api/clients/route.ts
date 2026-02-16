import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/clients - Crear o buscar cliente + asociar al tenant
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

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
  const { full_name, email, phone, dni, internal_ref, client_company_id } = body;

  if (!full_name) {
    return NextResponse.json(
      { error: 'Nombre del cliente requerido' },
      { status: 400 },
    );
  }

  // Normalizar PII
  const email_norm = email ? email.toLowerCase().trim() : null;
  const phone_norm = phone ? phone.replace(/\s/g, '') : null;
  const dni_clean = dni ? dni.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;

  // Buscar cliente existente por email_norm o dni
  let clientGlobal = null;

  if (email_norm) {
    const { data } = await supabase
      .from('client_global')
      .select('id')
      .eq('email_norm', email_norm)
      .single();
    clientGlobal = data;
  }

  if (!clientGlobal && dni_clean) {
    const { data } = await supabase
      .from('client_global')
      .select('id')
      .eq('dni_hash', dni_clean)
      .single();
    clientGlobal = data;
  }

  // Si no existe, crear
  if (!clientGlobal) {
    const { data, error: insertError } = await supabase
      .from('client_global')
      .insert({
        full_name,
        email_norm,
        phone_norm,
        dni_hash: dni_clean,
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Error al crear cliente', detail: insertError.message },
        { status: 500 },
      );
    }
    clientGlobal = data;
  }

  // Asociar al tenant (upsert por unique constraint)
  const { data: tenantClient, error: tcError } = await supabase
    .from('tenant_client')
    .upsert(
      {
        tenant_id: tenantUser.tenant_id,
        client_global_id: clientGlobal.id,
        internal_ref: internal_ref || null,
        client_company_id: client_company_id || null,
      },
      { onConflict: 'tenant_id,client_global_id' },
    )
    .select()
    .single();

  if (tcError) {
    return NextResponse.json(
      { error: 'Error al asociar cliente', detail: tcError.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      client_global_id: clientGlobal.id,
      tenant_client_id: tenantClient.id,
      full_name,
    },
    { status: 201 },
  );
}

// GET /api/clients?company_id=X&q=term - Listar clientes del tenant
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .single();

  if (!tenantUser) {
    return NextResponse.json(
      { error: 'Usuario no asociado a un negocio' },
      { status: 403 },
    );
  }

  const companyId = request.nextUrl.searchParams.get('company_id');
  const q = request.nextUrl.searchParams.get('q') || '';

  let query = supabase
    .from('tenant_client')
    .select(
      `
      id,
      internal_ref,
      client_company_id,
      client_global:client_global_id (
        id,
        full_name,
        email_norm,
        phone_norm
      )
    `,
    )
    .eq('tenant_id', tenantUser.tenant_id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (companyId) {
    query = query.eq('client_company_id', companyId);
  }

  const { data: clients, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Error al obtener clientes' },
      { status: 500 },
    );
  }

  // Filter by name client-side if q is provided (Supabase nested ilike not supported easily)
  let filtered = clients || [];
  if (q.trim()) {
    const lowerQ = q.trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filtered = filtered.filter((c: any) =>
      c.client_global?.full_name?.toLowerCase().includes(lowerQ),
    );
  }

  return NextResponse.json(filtered);
}
