import { SupabaseClient } from '@supabase/supabase-js';
import { composeSignedDocument } from './compose-signed-document';
import { sendDeliveryEmail } from '@/lib/email/send-delivery-email';

interface TryFinalizeResult {
  finalized: boolean;
  reason: string;
}

/**
 * tryFinalize - Intenta generar el PDF final si ambos artefactos existen
 *
 * Anti-error #7: Idempotente con lock lógico (finalizing_at)
 * Anti-error #6: Join por sesión (orden indiferente)
 *
 * Flujo:
 * 1. Verificar que ambos (signature_path + pdf_original_path) existen
 * 2. Adquirir lock (finalizing_at) via compare-and-set
 * 3. Descargar firma + PDF original de Storage
 * 4. Ejecutar composeSignedDocument
 * 5. Subir PDF final a Storage
 * 6. Actualizar sesión: pdf_final_path, pdf_original_hash, status=FINALIZED
 * 7. Registrar documento + generar access_token
 * 8. Audit event
 */
export async function tryFinalize(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<TryFinalizeResult> {
  // 1. Leer sesión actual
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select(
      `
      id,
      tenant_id,
      status,
      signature_path,
      pdf_original_path,
      pdf_final_path,
      finalizing_at,
      doc_num,
      tenant:tenant_id ( name ),
      tenant_client:tenant_client_id (
        client_global:client_global_id ( full_name, email_norm )
      )
    `,
    )
    .eq('id', sessionId)
    .single();

  if (fetchError || !session) {
    return { finalized: false, reason: 'session_not_found' };
  }

  // Ya finalizado → idempotente, retornar ok
  if (session.status === 'FINALIZED' || session.pdf_final_path) {
    return { finalized: true, reason: 'already_finalized' };
  }

  // No listo → faltan artefactos
  if (!session.signature_path || !session.pdf_original_path) {
    return { finalized: false, reason: 'missing_artifacts' };
  }

  // Estados terminales que no deben procesarse
  if (['CLOSED', 'EXPIRED'].includes(session.status)) {
    return { finalized: false, reason: 'session_terminal' };
  }

  // 2. Adquirir lock (compare-and-set en finalizing_at)
  const now = new Date().toISOString();
  const { data: locked, error: lockError } = await supabase
    .from('sessions')
    .update({ finalizing_at: now })
    .eq('id', sessionId)
    .is('finalizing_at', null)
    .select('id')
    .single();

  if (lockError || !locked) {
    // Otro proceso ya está finalizando
    return { finalized: false, reason: 'lock_held' };
  }

  try {
    // 3. Descargar artefactos de Storage
    const { data: sigData, error: sigError } = await supabase.storage
      .from('signatures')
      .download(session.signature_path);

    if (sigError || !sigData) {
      throw new Error(`Failed to download signature: ${sigError?.message}`);
    }

    const { data: pdfData, error: pdfError } = await supabase.storage
      .from('docs-original')
      .download(session.pdf_original_path);

    if (pdfError || !pdfData) {
      throw new Error(`Failed to download PDF: ${pdfError?.message}`);
    }

    // 4. Componer PDF final
    const signatureBytes = new Uint8Array(await sigData.arrayBuffer());
    const originalPdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    const isJpg = session.signature_path.endsWith('.jpg');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = session.tenant as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tc = session.tenant_client as any;

    const { finalPdfBytes, originalHash } = await composeSignedDocument({
      originalPdfBytes,
      signatureImageBytes: signatureBytes,
      signatureImageType: isJpg ? 'jpg' : 'png',
      sessionId: session.id,
      docNum: session.doc_num,
      tenantName: tenant?.name || '',
      clientName: tc?.client_global?.full_name || '',
      signedAt: new Date(),
    });

    // 5. Subir PDF final a Storage
    const finalPath = `${session.tenant_id}/${sessionId}/final.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('docs-final')
      .upload(finalPath, finalPdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload final PDF: ${uploadError.message}`);
    }

    // 6. Actualizar sesión
    await supabase
      .from('sessions')
      .update({
        pdf_final_path: finalPath,
        pdf_original_hash: originalHash,
        status: 'FINALIZED',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // 7. Registrar documento final
    await supabase.from('documents').insert({
      session_id: sessionId,
      tenant_id: session.tenant_id,
      type: 'final',
      storage_path: finalPath,
      file_size: finalPdfBytes.length,
      mime_type: 'application/pdf',
      hash_sha256: originalHash,
    });

    // Generar access_token para QR (24h)
    await supabase.from('access_tokens').insert({
      session_id: sessionId,
      tenant_id: session.tenant_id,
      type: 'qr',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // Generar access_token para email (7 días) + enviar email
    const clientEmail = tc?.client_global?.email_norm;
    if (clientEmail) {
      const { data: emailToken } = await supabase
        .from('access_tokens')
        .insert({
          session_id: sessionId,
          tenant_id: session.tenant_id,
          type: 'email',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('token')
        .single();

      if (emailToken) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : 'http://localhost:3000';

        await sendDeliveryEmail({
          to: clientEmail,
          clientName: tc?.client_global?.full_name || '',
          tenantName: tenant?.name || '',
          docNum: session.doc_num,
          downloadUrl: `${baseUrl}/d/${emailToken.token}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // 8. Audit
    await supabase.from('audit_events').insert({
      tenant_id: session.tenant_id,
      session_id: sessionId,
      event_type: 'finalized',
      actor_type: 'system',
      metadata: {
        original_hash: originalHash,
        final_size: finalPdfBytes.length,
      },
    });

    return { finalized: true, reason: 'success' };
  } catch (err) {
    // Liberar lock en caso de error para permitir reintento
    await supabase
      .from('sessions')
      .update({ finalizing_at: null })
      .eq('id', sessionId);

    // Audit del fallo
    await supabase.from('audit_events').insert({
      tenant_id: session.tenant_id,
      session_id: sessionId,
      event_type: 'finalize_error',
      actor_type: 'system',
      metadata: {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });

    return {
      finalized: false,
      reason: err instanceof Error ? err.message : 'unknown_error',
    };
  }
}
