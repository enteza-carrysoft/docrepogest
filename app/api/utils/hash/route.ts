import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/utils/hash - Utility to calculate MD5 of a file for comparison
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const md5Hash = crypto.createHash('md5').update(buffer).digest('hex');

        return NextResponse.json({ hash: md5Hash });
    } catch (_err) {
        return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 });
    }
}
