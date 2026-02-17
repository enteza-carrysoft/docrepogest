'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SignatureCanvas } from '@/components/signature-canvas';

interface PublicSessionData {
  id: string;
  doc_num: string | null;
  status: string;
  has_signature: boolean;
  created_at: string;
  tenant_name: string;
  client_name: string;
}

type PageState = 'loading' | 'ready' | 'submitting' | 'done' | 'error';

export default function FirmarPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<PublicSessionData | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState('');

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/public`);
    if (!res.ok) {
      setError('Sesión no encontrada o expirada');
      setPageState('error');
      return;
    }
    const data = await res.json();
    setSession(data);

    if (data.has_signature || ['FINALIZED', 'CLOSED'].includes(data.status)) {
      setPageState('done');
    } else if (data.status === 'EXPIRED') {
      setError('Esta sesión ha expirado');
      setPageState('error');
    } else {
      setPageState('ready');
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.resolve().then(() => fetchSession());
  }, [fetchSession]);

  async function handleSignature(blob: Blob) {
    setPageState('submitting');
    setError('');

    const formData = new FormData();
    formData.append('signature', blob, 'signature.png');

    const res = await fetch(`/api/sessions/${sessionId}/signature`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al enviar firma');
      setPageState('ready');
      return;
    }

    // Mostrar confirmación por 3 segundos y luego resetear
    setPageState('done');
    await fetchSession();

    // Auto-reset después de 3 segundos para permitir nuevas firmas
    setTimeout(() => {
      setPageState('ready');
      setError('');
    }, 3000);
  }


  // Loading
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  // Error
  if (pageState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">{error}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Contacta al negocio para obtener un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header con info */}
      <header className="border-b px-4 py-4">
        <div className="mx-auto max-w-lg">
          <p className="text-lg font-semibold">
            {session?.tenant_name || 'Empresa'}
          </p>
          <p className="text-sm text-zinc-500">
            Documento: {session?.doc_num || 'Sin número'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4">
        {/* Datos del firmante */}
        <div className="mb-6 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Firmante</p>
          <p className="font-medium">{session?.client_name || ''}</p>
        </div>

        {/* Estado: firma pendiente */}
        {pageState === 'ready' && (
          <>
            <p className="mb-3 text-center text-sm font-medium">
              Firme en el recuadro
            </p>
            <SignatureCanvas
              onSignature={handleSignature}
              disabled={false}
            />
          </>
        )}

        {/* Estado: enviando */}
        {pageState === 'submitting' && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            <p className="text-sm text-zinc-500">Enviando firma...</p>
          </div>
        )}

        {/* Estado: completado */}
        {pageState === 'done' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-900/20">
            <p className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
              Firma registrada
            </p>
            <p className="text-sm text-green-700 dark:text-green-500">
              {session?.status === 'FINALIZED'
                ? 'El documento firmado está listo. Recibirás una copia en breve.'
                : 'Tu firma ha sido registrada. El documento se completará cuando el negocio suba el PDF.'}
            </p>
            <p className="mt-3 text-xs text-green-600 dark:text-green-600">
              Volviendo a la pantalla de espera...
            </p>
          </div>
        )}

        {/* Error inline */}
        {error && pageState === 'ready' && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </main>

      {/* Footer legal */}
      <footer className="mt-auto border-t px-4 py-3">
        <p className="mx-auto max-w-lg text-center text-xs text-zinc-400">
          Al firmar, confirma la recepción del material descrito en el documento.
        </p>
      </footer>
    </div>
  );
}
