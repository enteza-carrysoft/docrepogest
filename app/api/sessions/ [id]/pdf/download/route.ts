import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/sessions/[id]/pdf/download?type=original|final
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'original' | 'final';

    if (!['original', 'final'].includes(type)) {
        return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener sesión y path
    const { data: session, error } = await supabase
        .from('sessions')
        .select('pdf_original_path, pdf_final_path, tenant_id')
        .eq('id', sessionId)
        .single();

    if (error || !session) {
        return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    const filePath = type === 'original' ? session.pdf_original_path : session.pdf_final_path;
    const bucketName = type === 'original' ? 'docs-original' : 'docs-final';

    if (!filePath) {
        return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
    }

    // Generar URL firmada de descarga (60 segundos)
    const { data: downloadData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60);

    if (downloadError || !downloadData) {
        return NextResponse.json({ error: 'Error al generar link de descarga' }, { status: 500 });
    }

    return NextResponse.json({ url: downloadData.signedUrl });
}
