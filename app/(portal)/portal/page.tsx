'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface SessionItem {
  id: string;
  doc_num: string | null;
  status: string;
  created_at: string;
  finalized_at: string | null;
  tenant_id: string;
  tenant_name: string;
  client_name: string;
  company_name: string | null;
  employee_name: string;
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

  // Filters
  const [filterCompany, setFilterCompany] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

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

      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const res = await fetch(`/api/portal/sessions?${params}`);
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
  }, [router, filterFrom, filterTo]);

  // Get unique company/tenant names for filter dropdown
  const companyOptions = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach((s) => {
      const label = s.company_name
        ? `${s.tenant_name} - ${s.company_name}`
        : s.tenant_name;
      names.add(label);
    });
    return Array.from(names).sort();
  }, [sessions]);

  // Group sessions by tenant (and company if present)
  const grouped = useMemo(() => {
    let filtered = sessions;

    if (filterCompany) {
      filtered = filtered.filter((s) => {
        const label = s.company_name
          ? `${s.tenant_name} - ${s.company_name}`
          : s.tenant_name;
        return label === filterCompany;
      });
    }

    const groups: Record<string, SessionItem[]> = {};
    for (const s of filtered) {
      const key = s.company_name
        ? `${s.tenant_name} - ${s.company_name}`
        : s.tenant_name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [sessions, filterCompany]);

  function clearFilters() {
    setFilterCompany('');
    setFilterFrom('');
    setFilterTo('');
  }

  const hasFilters = filterCompany || filterFrom || filterTo;

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

        {/* Filters */}
        <div className="mb-4 rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="mb-1 block text-xs text-zinc-500">Empresa</label>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              >
                <option value="">Todas</option>
                {companyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Desde</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Hasta</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="rounded px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-500">No tiene entregas registradas.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Las entregas apareceran aqui cuando firme documentos.
            </p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-500">No hay entregas que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName}>
                <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {groupName}
                </h2>
                <div className="space-y-2">
                  {items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/portal/sesion/${s.id}`}
                      className="block rounded-lg border bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {s.doc_num || 'Sin numero de documento'}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {new Date(s.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {s.employee_name && (
                              <span className="ml-2">
                                Atendido por: {s.employee_name}
                              </span>
                            )}
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
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
