'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

interface SessionData {
  id: string;
  doc_num: string | null;
  status: string;
  signature_path: string | null;
  pdf_original_path: string | null;
  pdf_final_path: string | null;
  pdf_original_hash_md5: string | null;
  pending_terminal_at: string | null;
  created_at: string;
  tenant_client: {
    id: string;
    internal_ref: string | null;
    client_global: {
      id: string;
      full_name: string;
      email_norm: string | null;
    };
  };
  access_token: {
    token: string;
    expires_at: string;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Esperando firma y PDF',
  SIGNED: 'Firmado - Esperando PDF',
  PDF_UPLOADED: 'PDF subido - Esperando firma',
  FINALIZED: 'Completado',
  CLOSED: 'Cerrado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PDF_UPLOADED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function SesionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ matches: boolean; hash: string } | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data);
    } else {
      setError('No se pudo cargar la sesión');
    }
  }, [id]);

  // Polling cada 2s mientras no esté FINALIZED/CLOSED/EXPIRED
  useEffect(() => {
    fetchSession();

    const interval = setInterval(() => {
      if (
        session?.status &&
        !['FINALIZED', 'CLOSED', 'EXPIRED'].includes(session.status)
      ) {
        fetchSession();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchSession, session?.status]);

  // Subida de PDF por drag & drop
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF');
      return;
    }

    await uploadPdf(file);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPdf(file);
  }

  async function uploadPdf(file: File) {
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/sessions/${id}/pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al subir PDF');
    } else {
      await fetchSession();
    }

    setUploading(false);
  }

  async function downloadPdf(type: 'original' | 'final') {
    try {
      const res = await fetch(`/api/sessions/${id}/pdf/download?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        const link = document.createElement('a');
        link.href = data.url;
        link.download = type === 'original' ? 'original.pdf' : 'firmado.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Error al descargar el archivo');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  }

  async function activateTerminal() {
    setTerminalLoading(true);
    setError('');
    const res = await fetch(`/api/sessions/${id}/terminal`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al activar terminal');
    } else {
      await fetchSession();
    }
    setTerminalLoading(false);
  }

  async function cancelTerminal() {
    setTerminalLoading(true);
    setError('');
    const res = await fetch(`/api/sessions/${id}/terminal`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al cancelar terminal');
    } else {
      await fetchSession();
    }
    setTerminalLoading(false);
  }

  async function verifyLocalFile(file: File) {
    setVerifying(true);
    setVerifyResult(null);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/utils/hash', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Error al procesar archivo');

      const { hash } = await res.json();
      const matches = hash === session?.pdf_original_hash_md5;
      setVerifyResult({ matches, hash });
    } catch (_err) {
      setError('Error al verificar el archivo local');
    } finally {
      setVerifying(false);
    }
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  const signUrl = `/firmar/${session.id}`;
  const isActive = !['FINALIZED', 'CLOSED', 'EXPIRED'].includes(session.status);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/counter"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Volver
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[session.status] || ''}`}
          >
            {STATUS_LABELS[session.status] || session.status}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6 space-y-6">
        {/* Info sesión */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Cliente</p>
              <p className="font-medium">
                {session.tenant_client?.client_global?.full_name}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Documento</p>
              <p className="font-medium">{session.doc_num || 'Sin número'}</p>
            </div>
            <div>
              <p className="text-zinc-500">Creado</p>
              <p className="font-medium">
                {new Date(session.created_at).toLocaleString('es-ES')}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Email cliente</p>
              <p className="font-medium">
                {session.tenant_client?.client_global?.email_norm || 'No proporcionado'}
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores de progreso */}
        <div className="grid grid-cols-3 gap-3">
          <StepIndicator
            label="Firma"
            done={!!session.signature_path}
            active={isActive && !session.signature_path}
          />
          <StepIndicator
            label="PDF Original"
            done={!!session.pdf_original_path}
            active={isActive && !session.pdf_original_path}
          />
          <StepIndicator
            label="PDF Final"
            done={!!session.pdf_final_path}
            active={false}
          />
        </div>

        {/* QR / Link para firmante + Terminal fijo */}
        {isActive && !session.signature_path && (
          <div className="rounded-lg border bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            {session.pending_terminal_at ? (
              /* Estado: esperando firma en terminal */
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
                </div>
                <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Esperando firma en terminal fijo...
                </p>
                <p className="mb-4 text-xs text-zinc-500">
                  El cliente puede firmar en el dispositivo del mostrador
                </p>
                <button
                  onClick={cancelTerminal}
                  disabled={terminalLoading}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {terminalLoading ? 'Cancelando...' : 'Cancelar terminal'}
                </button>
              </div>
            ) : (
              /* Estado normal: QR + boton terminal */
              <>
                <p className="mb-4 text-center text-sm font-medium">
                  Escanee el QR para firmar
                </p>
                <div className="mb-4 flex justify-center">
                  <QRCodeSVG
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}${signUrl}`
                        : signUrl
                    }
                    size={200}
                    level="M"
                  />
                </div>
                <div className="mb-3 flex items-center justify-center rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <a
                    href={typeof window !== 'undefined' ? `${window.location.origin}${signUrl}` : signUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs font-mono text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}${signUrl}`
                      : signUrl}
                  </a>
                </div>
                <p className="mb-4 text-center text-xs text-zinc-500">
                  El cliente debe escanear este QR con su movil para firmar.
                </p>

                {/* Separador */}
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-xs text-zinc-400">o</span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                </div>

                {/* Boton terminal fijo */}
                <div className="text-center">
                  <button
                    onClick={activateTerminal}
                    disabled={terminalLoading}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {terminalLoading ? 'Activando...' : 'Firmar en terminal fijo'}
                  </button>
                  <p className="mt-2 text-xs text-zinc-400">
                    Usa el dispositivo de firma del mostrador
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Dropzone PDF */}
        {isActive && !session.pdf_original_path && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${dragging
              ? 'border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800'
              : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'
              }`}
          >
            <p className="mb-2 text-sm font-medium">
              {uploading ? 'Subiendo...' : 'Arrastra el PDF aquí'}
            </p>
            <p className="mb-4 text-xs text-zinc-500">
              PDF generado por tu ERP (albarán, factura, etc.)
            </p>
            <label className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
              Seleccionar archivo
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Estado FINALIZED + QR descarga */}
        {session.status === 'FINALIZED' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-900/20">
            <div className="text-center">
              <p className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
                Entrega completada
              </p>
              <p className="mb-4 text-sm text-green-700 dark:text-green-500">
                El PDF firmado ha sido generado correctamente.
              </p>
            </div>

            {session.access_token && (
              <div className="mt-4 rounded-lg bg-white p-6 text-center dark:bg-zinc-900">
                <p className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  QR de descarga para el cliente
                </p>
                <div className="mb-4 flex justify-center">
                  <QRCodeSVG
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/d/${session.access_token.token}`
                        : `/d/${session.access_token.token}`
                    }
                    size={200}
                    level="M"
                  />
                </div>
                <div className="mb-3 flex items-center justify-center rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <a
                    href={typeof window !== 'undefined' ? `${window.location.origin}/d/${session.access_token.token}` : `/d/${session.access_token.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs font-mono text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/d/${session.access_token.token}`
                      : `/d/${session.access_token.token}`}
                  </a>
                </div>
                <p className="text-xs text-zinc-400">
                  Expira:{' '}
                  {new Date(session.access_token.expires_at).toLocaleString('es-ES')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sección de Integridad */}
        {session.pdf_original_path && (
          <div className="rounded-lg border bg-zinc-100 p-6 dark:border-zinc-800 dark:bg-zinc-800/50">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Integridad y Auditoría
            </h3>
            <p className="mb-4 text-xs text-zinc-500">
              Cualquier cambio en el documento original invalidará la firma. Puedes verificar la integridad comparando este código con el archivo PDF original.
            </p>

            <div className="space-y-4">
              <div className="rounded-lg bg-white p-3 border dark:bg-zinc-900 dark:border-zinc-700">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Hash MD5 original (almacenado)
                </p>
                <code className="break-all text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
                  {session.pdf_original_hash_md5 || 'Calculando...'}
                </code>
              </div>

              <div className="rounded-lg bg-zinc-50 p-3 border dark:bg-zinc-900/50 dark:border-zinc-800 text-[11px] text-zinc-500">
                <p className="mb-2 font-semibold">¿Cómo verificarlo tú mismo?</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Descarga el PDF original del ERP.</li>
                  <li>En Windows, abre PowerShell y ejecuta:</li>
                </ol>
                <pre className="mt-2 rounded bg-zinc-200 p-2 dark:bg-zinc-800 overflow-x-auto text-[10px]">
                  certutil -hashfile archivo.pdf MD5
                </pre>

                {/* Herramienta de Verificación en Vivo */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f && f.type === 'application/pdf') verifyLocalFile(f);
                  }}
                  className="mt-6 rounded-xl border-2 border-dashed border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 hover:border-zinc-400 transition-all cursor-default"
                >
                  <p className="mb-3 text-[11px] font-bold text-zinc-400 uppercase tracking-widest text-center">
                    Verificador Rápido
                  </p>

                  {!verifyResult ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-xs text-zinc-500 text-center">
                        Suelta aquí el PDF para validar su integridad al instante.
                      </p>
                      <label className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition-colors">
                        {verifying ? 'Calculando...' : 'Seleccionar Archivo'}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) verifyLocalFile(f);
                          }}
                          disabled={verifying}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                      <div className={`mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full ${verifyResult.matches ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {verifyResult.matches ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                      </div>
                      <p className={`text-sm font-bold ${verifyResult.matches ? 'text-green-700' : 'text-red-700'}`}>
                        {verifyResult.matches ? 'DOCUMENTO AUTÉNTICO' : 'HASH NO COINCIDE'}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-400 truncate px-4">
                        Local: {verifyResult.hash}
                      </p>
                      <button
                        onClick={() => setVerifyResult(null)}
                        className="mt-3 text-[10px] font-bold text-zinc-500 underline hover:text-zinc-800"
                      >
                        Probar otro archivo
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">Descarga de auditoría:</p>
                  <div className="flex flex-wrap gap-2">
                    {session.pdf_original_path && (
                      <button
                        onClick={() => downloadPdf('original')}
                        className="flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF Original
                      </button>
                    )}
                    {session.pdf_final_path && (
                      <button
                        onClick={() => downloadPdf('final')}
                        className="flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF Firmado
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2">
                  El resultado debe coincidir exactamente con el código de arriba y con el que aparece en el PDF firmado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

function StepIndicator({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center text-sm ${done
        ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400'
        : active
          ? 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400'
          : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800'
        }`}
    >
      <p className="font-medium">{done ? '✓' : active ? '...' : '—'}</p>
      <p className="mt-1 text-xs">{label}</p>
    </div>
  );
}
