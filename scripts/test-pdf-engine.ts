/**
 * Test script para el motor PDF
 * Ejecutar con: npx tsx scripts/test-pdf-engine.ts
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { composeSignedDocument } from '../lib/pdf/compose-signed-document';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';

function createValidPng(width: number, height: number): Uint8Array {
  // Generar PNG válido con fondo blanco y una "firma" simulada (línea negra)
  const rowSize = width * 3; // RGB
  const rawData = Buffer.alloc((rowSize + 1) * height); // +1 filter byte per row

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // filter: None

    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 3;

      // Fondo blanco
      rawData[px] = 255;
      rawData[px + 1] = 255;
      rawData[px + 2] = 255;

      // Dibujar una curva simulando firma (sinusoidal)
      const centerY = height / 2;
      const sigY = centerY + Math.sin((x / width) * Math.PI * 3) * (height * 0.3);

      if (Math.abs(y - sigY) < 3) {
        rawData[px] = 10;
        rawData[px + 1] = 10;
        rawData[px + 2] = 60;
      }
    }
  }

  const compressed = deflateSync(rawData);

  // Construir PNG manualmente
  const chunks: Buffer[] = [];

  // PNG Signature
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(pngChunk('IHDR', ihdr));

  // IDAT
  chunks.push(pngChunk('IDAT', compressed));

  // IEND
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));

  return new Uint8Array(Buffer.concat(chunks));
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([len, typeBuffer, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

async function createTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont('Helvetica');
  const fontBold = await doc.embedFont('Helvetica-Bold');

  page.drawText('ALBARAN DE ENTREGA', {
    x: 50, y: 780, size: 20, font: fontBold, color: rgb(0, 0, 0),
  });

  page.drawText('N.o: ALB-2026-001', { x: 50, y: 750, size: 12, font });
  page.drawText('Cliente: Juan Garcia Lopez', { x: 50, y: 720, size: 12, font });
  page.drawText('Fecha: 15/02/2026', { x: 50, y: 690, size: 12, font });

  page.drawLine({
    start: { x: 50, y: 670 }, end: { x: 545, y: 670 },
    thickness: 1, color: rgb(0.5, 0.5, 0.5),
  });

  const items = [
    ['Tubo PVC 110mm x 3m', '5 uds', '12.50', '62.50'],
    ['Codo PVC 110mm 90', '10 uds', '2.30', '23.00'],
    ['Pegamento PVC 500ml', '2 uds', '8.90', '17.80'],
    ['Cinta teflon 12mm', '6 uds', '1.20', '7.20'],
  ];

  let y = 650;
  for (const [desc, qty, price, total] of items) {
    page.drawText(desc, { x: 50, y, size: 10, font });
    page.drawText(qty, { x: 300, y, size: 10, font });
    page.drawText(`${price} EUR`, { x: 380, y, size: 10, font });
    page.drawText(`${total} EUR`, { x: 470, y, size: 10, font });
    y -= 20;
  }

  page.drawLine({
    start: { x: 50, y: y - 5 }, end: { x: 545, y: y - 5 },
    thickness: 1, color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('TOTAL: 110.50 EUR', {
    x: 400, y: y - 25, size: 14, font: fontBold,
  });

  return new Uint8Array(await doc.save());
}

async function main() {
  console.log('=== Test Motor PDF - Entregas Firmadas ===\n');

  // 1. Crear PDF de prueba
  console.log('1. Generando PDF de prueba (albaran simulado)...');
  const originalPdf = await createTestPdf();
  console.log(`   OK - ${originalPdf.length} bytes`);

  // 2. Crear firma PNG válida
  console.log('2. Generando firma PNG (800x300, curva simulada)...');
  const signaturePng = createValidPng(800, 300);
  console.log(`   OK - ${signaturePng.length} bytes`);

  // 3. Componer documento final
  console.log('3. Ejecutando composeSignedDocument()...');

  const start = Date.now();
  const { finalPdfBytes, originalHash } = await composeSignedDocument({
    originalPdfBytes: originalPdf,
    signatureImageBytes: signaturePng,
    signatureImageType: 'png',
    sessionId: 'test-session-001',
    docNum: 'ALB-2026-001',
    tenantName: 'Fontaneria Garcia S.L.',
    clientName: 'Juan Garcia Lopez',
    signedAt: new Date(),
  });
  const elapsed = Date.now() - start;

  console.log(`   OK - ${finalPdfBytes.length} bytes (${elapsed}ms)`);
  console.log(`   SHA-256 original: ${originalHash.substring(0, 16)}...`);

  // 4. Verificar estructura
  const finalDoc = await PDFDocument.load(finalPdfBytes);
  const originalDoc = await PDFDocument.load(originalPdf);
  const pagesOrig = originalDoc.getPageCount();
  const pagesFinal = finalDoc.getPageCount();

  console.log(`\n4. Verificacion:`);
  console.log(`   Paginas original: ${pagesOrig}`);
  console.log(`   Paginas final:    ${pagesFinal}`);
  console.log(`   Pagina extra:     ${pagesFinal === pagesOrig + 1 ? 'SI' : 'ERROR'}`);

  if (pagesFinal !== pagesOrig + 1) {
    console.error('\n   FALLO: El PDF final deberia tener exactamente 1 pagina mas');
    process.exit(1);
  }

  // 5. Guardar en disco
  const outDir = join(process.cwd(), 'scripts', 'test-output');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'original.pdf'), originalPdf);
  writeFileSync(join(outDir, 'final.pdf'), finalPdfBytes);
  writeFileSync(join(outDir, 'signature.png'), signaturePng);

  console.log(`\n5. Archivos guardados en scripts/test-output/`);
  console.log('   - original.pdf  (albaran simulado)');
  console.log('   - final.pdf     (con pagina certificacion + firma)');
  console.log('   - signature.png (firma simulada)');

  console.log('\n=== TODOS LOS TESTS PASARON ===');
  console.log('\n>> Abre scripts/test-output/final.pdf para inspeccionar visualmente.');
}

main().catch((err) => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
