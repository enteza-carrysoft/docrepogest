'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface SessionDetail {
  id: string;
  doc_num: string | null;
  status: string;
  created_at: string;
  finalized_at: string | null;
  tenant_name: string;
  client_name: string;
  download_token: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  SIGNED: 'En proceso',
  PDF_UPLOADED: 'En proceso',
  FINALIZED: 'Completado',
  CLOSED: 'Cerrado',
};

const STATUS_COLORS: Record<string, string> = {
  SIGNED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PDF_UPLOADED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export default function PortalSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      const res = await fetch(`/api/portal/sessions/${id}`);
      if (res.ok) {
        setSession(await res.json());
      } else if (res.status === 401) {
        router.push('/portal/login');
        return;
      } else {
        setError('Entrega no encontrada');
      }
      setLoading(false);
    }
    fetchSession();
  }, [id, router]);

  async function handleDownload() {
    if (!session?.download_token) return;
    setDownloading(true);

    try {
      const res = await fetch(`/api/download/${session.download_token}`);
      if (!res.ok) {
        setError('Error al descargar el documento');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match ? match[1] : 'documento.pdf';

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error || 'No encontrado'}</p>
          <Link
            href="/portal"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Volver a mis entregas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/portal"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Mis Entregas
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              STATUS_COLORS[session.status] || ''
            }`}
          >
            {STATUS_LABELS[session.status] || session.status}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6 space-y-6">
        {/* Session info */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Empresa</p>
              <p className="font-medium">{session.tenant_name}</p>
            </div>
            <div>
              <p className="text-zinc-500">Documento</p>
              <p className="font-medium">{session.doc_num || 'Sin numero'}</p>
            </div>
            <div>
              <p className="text-zinc-500">Fecha</p>
              <p className="font-medium">
                {new Date(session.created_at).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {session.finalized_at && (
              <div>
                <p className="text-zinc-500">Finalizado</p>
                <p className="font-medium">
                  {new Date(session.finalized_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Download section */}
        {session.status === 'FINALIZED' && session.download_token && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-900/20">
            <p className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
              Documento firmado disponible
            </p>
            <p className="mb-4 text-sm text-green-700 dark:text-green-500">
              Su documento ha sido firmado y procesado correctamente.
            </p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-lg bg-green-700 px-6 py-3 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
            >
              {downloading ? 'Descargando...' : 'Descargar PDF firmado'}
            </button>
          </div>
        )}

        {session.status === 'FINALIZED' && !session.download_token && (
          <div className="rounded-lg border bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              El enlace de descarga ha expirado. Contacte con {session.tenant_name} para obtener uno nuevo.
            </p>
          </div>
        )}

        {['SIGNED', 'PDF_UPLOADED'].includes(session.status) && (
          <div className="rounded-lg border bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              Su entrega esta siendo procesada. El documento estara disponible cuando se complete.
            </p>
          </div>
        )}

        {session.status === 'CLOSED' && (
          <div className="rounded-lg border bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              Esta entrega ha sido cerrada.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
