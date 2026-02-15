'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface SessionItem {
  id: string;
  doc_num: string | null;
  status: string;
  created_at: string;
  finalized_at: string | null;
  tenant_name: string;
  client_name: string;
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

export default function PortalPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/portal/login');
        return;
      }

      setUserName(user.email || '');

      const res = await fetch('/api/portal/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else if (res.status === 401) {
        router.push('/portal/login');
        return;
      } else {
        setError('Error al cargar entregas');
      }

      setLoading(false);
    }
    init();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/portal/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Mis Entregas</h1>
            <p className="text-xs text-zinc-500">{userName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-500">No tiene entregas registradas.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Las entregas apareceran aqui cuando firme documentos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/portal/sesion/${s.id}`}
                className="block rounded-lg border bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {s.tenant_name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {s.doc_num || 'Sin numero de documento'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(s.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[s.status] || 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
