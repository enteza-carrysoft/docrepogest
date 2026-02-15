import { Resend } from 'resend';

interface DeliveryEmailParams {
  to: string;
  clientName: string;
  tenantName: string;
  docNum: string | null;
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * Envía email de notificación al cliente con el link de descarga.
 * No lanza error si falla (best-effort) para no bloquear tryFinalize.
 */
export async function sendDeliveryEmail(params: DeliveryEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return false;
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'entregas@resend.dev';

  const expiresFormatted = params.expiresAt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  try {
    await resend.emails.send({
      from: `${params.tenantName} <${fromAddress}>`,
      to: params.to,
      subject: `Su documento firmado esta listo${params.docNum ? ` - ${params.docNum}` : ''}`,
      html: buildEmailHtml(params, expiresFormatted),
    });

    return true;
  } catch (err) {
    console.error('[email] Failed to send delivery email:', err);
    return false;
  }
}

function buildEmailHtml(params: DeliveryEmailParams, expiresFormatted: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">

    <div style="padding:32px 24px;text-align:center;border-bottom:1px solid #e4e4e7;">
      <h1 style="margin:0;font-size:20px;color:#18181b;">Documento firmado disponible</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#71717a;">${params.tenantName}</p>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">
        Hola <strong>${params.clientName}</strong>,
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">
        Su documento${params.docNum ? ` <strong>${params.docNum}</strong>` : ''} ha sido firmado y procesado correctamente. Puede descargarlo usando el boton de abajo.
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${params.downloadUrl}"
           style="display:inline-block;padding:12px 32px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
          Descargar PDF firmado
        </a>
      </div>

      <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">
        Este enlace expira el ${expiresFormatted}
      </p>
    </div>

    <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">
        Si no reconoce esta entrega, puede ignorar este email.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
