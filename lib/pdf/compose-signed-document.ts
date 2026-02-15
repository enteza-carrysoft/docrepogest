import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createHash } from 'crypto';

interface ComposeInput {
  originalPdfBytes: Uint8Array;
  signatureImageBytes: Uint8Array;
  signatureImageType: 'png' | 'jpg';
  sessionId: string;
  docNum: string | null;
  tenantName: string;
  clientName: string;
  signedAt: Date;
}

interface ComposeResult {
  finalPdfBytes: Uint8Array;
  originalHash: string;
}

/**
 * Motor PDF - Genera el PDF final firmado
 *
 * Pipeline:
 * 1. Calcular SHA-256 del PDF original
 * 2. Cargar PDF original
 * 3. Generar página de certificación con firma embebida
 * 4. Merge: original + página certificación
 * 5. Retornar bytes del PDF final + hash
 *
 * Anti-error #4: Página certificado extra (NO insertar en el original)
 * Anti-error #5: No rasterizar PDF (original intacto)
 */
export async function composeSignedDocument(
  input: ComposeInput,
): Promise<ComposeResult> {
  const {
    originalPdfBytes,
    signatureImageBytes,
    signatureImageType,
    sessionId,
    docNum,
    tenantName,
    clientName,
    signedAt,
  } = input;

  // 1. Hash SHA-256 del original
  const originalHash = createHash('sha256')
    .update(originalPdfBytes)
    .digest('hex');

  // 2. Cargar PDF original
  const originalDoc = await PDFDocument.load(originalPdfBytes);

  // 3. Crear documento para la página de certificación
  const certDoc = await PDFDocument.create();
  const page = certDoc.addPage([595.28, 841.89]); // A4
  const font = await certDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await certDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // --- Header ---
  page.drawText('CERTIFICADO DE ENTREGA FIRMADA', {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 35;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 30;

  // --- Datos de la entrega ---
  const fields = [
    ['Empresa', tenantName],
    ['Documento', docNum || 'Sin número'],
    ['Cliente', clientName],
    ['Fecha de firma', formatDate(signedAt)],
    ['ID Sesión', sessionId],
  ];

  for (const [label, value] of fields) {
    page.drawText(`${label}:`, {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(value, {
      x: margin + 120,
      y,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 20;
  }

  y -= 15;

  // --- Firma ---
  page.drawText('Firma del receptor:', {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  // Embeber imagen de firma
  const signatureImage =
    signatureImageType === 'jpg'
      ? await certDoc.embedJpg(signatureImageBytes)
      : await certDoc.embedPng(signatureImageBytes);

  // Escalar firma manteniendo proporción, max 300x120
  const sigDims = signatureImage.scale(1);
  const maxW = 300;
  const maxH = 120;
  const scale = Math.min(maxW / sigDims.width, maxH / sigDims.height, 1);
  const sigW = sigDims.width * scale;
  const sigH = sigDims.height * scale;

  // Borde alrededor de la firma
  page.drawRectangle({
    x: margin,
    y: y - sigH - 10,
    width: sigW + 20,
    height: sigH + 20,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  page.drawImage(signatureImage, {
    x: margin + 10,
    y: y - sigH,
    width: sigW,
    height: sigH,
  });

  y -= sigH + 40;

  // --- Hash del documento original ---
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 20;

  page.drawText('Verificación de integridad del documento original:', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 15;

  page.drawText(`SHA-256: ${originalHash}`, {
    x: margin,
    y,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 25;

  // --- Disclaimer ---
  page.drawText(
    'Este documento certifica que el receptor ha firmado la recepción del material',
    {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    },
  );
  y -= 12;
  page.drawText(
    'descrito en las páginas anteriores. La firma fue capturada electrónicamente.',
    {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    },
  );
  y -= 20;

  page.drawText(`Generado por Entregas Firmadas — ${formatDate(signedAt)}`, {
    x: margin,
    y,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  // 4. Merge: original + página certificación
  const finalDoc = await PDFDocument.create();

  // Copiar todas las páginas del original
  const originalPages = await finalDoc.copyPages(
    originalDoc,
    originalDoc.getPageIndices(),
  );
  for (const p of originalPages) {
    finalDoc.addPage(p);
  }

  // Copiar la página de certificación
  const [certPage] = await finalDoc.copyPages(certDoc, [0]);
  finalDoc.addPage(certPage);

  // 5. Serializar
  const finalPdfBytes = await finalDoc.save();

  return {
    finalPdfBytes: new Uint8Array(finalPdfBytes),
    originalHash,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}
