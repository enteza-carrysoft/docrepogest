'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface DocInfo {
  doc_num: string | null;
  tenant_name: string;
  client_name: string;
  finalized_at: string;
  expires_at: string;
}

type PageState =
  | { type: 'loading' }
  | { type: 'ready'; info: DocInfo }
  | { type: 'error'; code: string; message: string };

export default function DownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ type: 'loading' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchInfo() {
      const res = await fetch(`/api/download/${token}/info`);
      if (res.ok) {
        const info: DocInfo = await res.json();
        setState({ type: 'ready', info });
      } else {
        const data = await res.json();
        setState({
          type: 'error',
          code: data.code || 'UNKNOWN',
          message: data.error || 'Error desconocido',
        });
      }
    }
    fetchInfo();
  }, [token]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/download/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setState({
          type: 'error',
          code: 'DOWNLOAD_ERROR',
          message: data.error || 'Error al descargar',
        });
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'documento.pdf';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (state.type === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 text-4xl">
            {state.code === 'EXPIRED' ? '⏰' : state.code === 'REVOKED' ? '🚫' : '❌'}
          </div>
          <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {state.code === 'EXPIRED'
              ? 'Enlace expirado'
              : state.code === 'REVOKED'
                ? 'Enlace revocado'
                : 'Enlace no valido'}
          </h1>
          <p className="text-sm text-zinc-500">
            {state.code === 'EXPIRED'
              ? 'Este enlace de descarga ha expirado. Contacte con la empresa para obtener uno nuevo.'
              : state.code === 'REVOKED'
                ? 'Este enlace ha sido revocado. Contacte con la empresa para mas informacion.'
                : state.message}
          </p>
        </div>
      </div>
    );
  }

  const { info } = state;
  const expiresDate = new Date(info.expires_at);
  const finalizedDate = new Date(info.finalized_at);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">📄</div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Documento disponible
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Su documento firmado esta listo para descargar
          </p>
        </div>

        {/* Info */}
        <div className="mb-6 space-y-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
          <InfoRow label="Empresa" value={info.tenant_name} />
          <InfoRow label="Cliente" value={info.client_name} />
          {info.doc_num && <InfoRow label="Documento" value={info.doc_num} />}
          <InfoRow
            label="Firmado"
            value={finalizedDate.toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {downloading ? 'Descargando...' : 'Descargar PDF firmado'}
        </button>

        {/* Expiry notice */}
        <p className="mt-4 text-center text-xs text-zinc-400">
          Este enlace expira el{' '}
          {expiresDate.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
