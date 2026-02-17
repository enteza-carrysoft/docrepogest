'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SignatureCanvas } from '@/components/signature-canvas';

interface TerminalSession {
  id: string;
  doc_num: string | null;
  status: string;
  client_name: string;
  pending_terminal_at: string;
}

type TerminalState = 'loading' | 'waiting' | 'signing' | 'submitting' | 'done' | 'auth_required';

export default function TerminalFijoPage() {
  const [terminalState, setTerminalState] = useState<TerminalState>('loading');
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [error, setError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollForSession = useCallback(async () => {
    try {
      // Intentar obtener token de la URL o localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      if (urlToken) {
        localStorage.setItem('terminal_token', urlToken);
        // Limpiar URL para que no se comparta el token por error
        window.history.replaceState({}, '', window.location.pathname);
      }

      const terminalToken = localStorage.getItem('terminal_token');
      const fetchUrl = terminalToken
        ? `/api/sessions/terminal/active?terminalToken=${terminalToken}`
        : '/api/sessions/terminal/active';

      const res = await fetch(fetchUrl);

      if (res.status === 401) {
        setTerminalState('auth_required');
        return;
      }

      if (!res.ok) return;

      const data = await res.json();

      if (data.session) {
        setSession(data.session);
        setTerminalState('signing');
      } else {
        // Si estabamos firmando y ya no hay sesion, significa que se cancelo
        if (session) {
          setSession(null);
        }
        setTerminalState('waiting');
      }
    } catch {
      // Error de red, seguir esperando
    }
  }, [session]);

  // Polling continuo
  useEffect(() => {
    Promise.resolve().then(() => pollForSession());

    pollingRef.current = setInterval(pollForSession, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollForSession]);

  // Pausar polling mientras firma
  useEffect(() => {
    if (terminalState === 'submitting' || terminalState === 'done') {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [terminalState]);

  async function handleSignature(blob: Blob) {
    if (!session) return;

    setTerminalState('submitting');
    setError('');

    const formData = new FormData();
    formData.append('signature', blob, 'signature.png');

    try {
      const res = await fetch(`/api/sessions/${session.id}/signature`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al enviar firma');
        setTerminalState('signing');
        return;
      }

      // Firma exitosa - mostrar confirmacion breve y volver a esperar
      setTerminalState('done');
      setTimeout(() => {
        setSession(null);
        setTerminalState('waiting');
        // Reanudar polling
        pollingRef.current = setInterval(pollForSession, 2000);
      }, 3000);
    } catch {
      setError('Error de conexion');
      setTerminalState('signing');
    }
  }

  // Auth requerida
  if (terminalState === 'auth_required') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Terminal de firma
          </p>
          <p className="mb-6 text-zinc-500">
            Inicia sesion como empleado para activar este terminal.
          </p>
          <a
            href={`/auth/login?redirect=/firmar/terminal`}
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Iniciar sesion
          </a>
        </div>
      </div>
    );
  }

  // Loading
  if (terminalState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Conectando terminal...</p>
      </div>
    );
  }

  // Esperando sesion
  if (terminalState === 'waiting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="mb-8 h-16 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Esperando inicio de firma...
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          El empleado activara la firma desde su pantalla
        </p>
      </div>
    );
  }

  // Firma completada (transicion breve)
  if (terminalState === 'done') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-green-50 dark:bg-green-950">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <span className="text-4xl">&#10003;</span>
        </div>
        <p className="text-2xl font-semibold text-green-800 dark:text-green-400">
          Firma registrada
        </p>
        <p className="mt-2 text-sm text-green-600 dark:text-green-500">
          Volviendo a pantalla de espera...
        </p>
      </div>
    );
  }

  // Firmando (submitting muestra spinner dentro del canvas)
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b px-4 py-4">
        <div className="mx-auto max-w-lg">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Firma de entrega
          </p>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
            <span>{session?.client_name}</span>
            {session?.doc_num && (
              <>
                <span>·</span>
                <span>Doc: {session.doc_num}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4">
        <p className="mb-4 text-center text-sm font-medium">
          Firme en el recuadro
        </p>

        {terminalState === 'submitting' ? (
          <div className="flex flex-col items-center py-12">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
            <p className="text-sm text-zinc-500">Enviando firma...</p>
          </div>
        ) : (
          <SignatureCanvas
            onSignature={handleSignature}
            disabled={false}
          />
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t px-4 py-3">
        <p className="mx-auto max-w-lg text-center text-xs text-zinc-400">
          Al firmar, confirma la recepcion del material descrito en el documento.
        </p>
      </footer>
    </div>
  );
}
