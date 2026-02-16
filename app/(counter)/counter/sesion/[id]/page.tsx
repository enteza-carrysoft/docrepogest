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

        {/* QR / Link para firmante */}
        {isActive && !session.signature_path && (
          <div className="rounded-lg border bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-4 text-sm font-medium">
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
            <p className="text-xs text-zinc-500">
              El cliente debe escanear este QR con su movil para firmar.
            </p>
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
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragging
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
      className={`rounded-lg border p-3 text-center text-sm ${
        done
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
