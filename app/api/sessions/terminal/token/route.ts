import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sessions/terminal/token - Obtener token de emparejamiento del empleado logueado
export async function GET() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener tenant_user del empleado
    const { data: tenantUser, error } = await supabase
        .from('tenant_users')
        .select('id, terminal_token')
        .eq('auth_user_id', user.id)
        .eq('active', true)
        .single();

    if (error || !tenantUser) {
        return NextResponse.json(
            { error: 'Usuario no asociado a un negocio' },
            { status: 403 },
        );
    }

    return NextResponse.json({
        token: tenantUser.terminal_token
    });
}

// POST /api/sessions/terminal/token/reset - Regenerar token de emparejamiento
export async function POST() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

    if (!tenantUser) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const newToken = crypto.randomUUID().replace(/-/g, '');

    const { error: updateError } = await supabase
        .from('tenant_users')
        .update({ terminal_token: newToken })
        .eq('id', tenantUser.id);

    if (updateError) {
        return NextResponse.json(
            { error: 'Error al resetear token', detail: updateError.message },
            { status: 500 },
        );
    }

    return NextResponse.json({ token: newToken });
}
