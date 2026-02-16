'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FuzzySearch } from '@/components/fuzzy-search';

interface CompanyResult {
  id: string;
  name: string;
  cif_nif: string | null;
}

interface ClientResult {
  id: string;
  internal_ref: string | null;
  client_global: {
    id: string;
    full_name: string;
    email_norm: string | null;
    phone_norm: string | null;
  };
}

export default function NuevaEntregaPage() {
  const router = useRouter();
  const [docNum, setDocNum] = useState('');

  // Company state
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', cif_nif: '', contact_email: '', phone: '' });

  // Person state
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: '', email: '', phone: '', dni: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search companies
  const searchCompanies = useCallback(async (q: string): Promise<CompanyResult[]> => {
    const res = await fetch(`/api/client-companies?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return res.json();
  }, []);

  // Search persons (filtered by company if selected)
  const searchClients = useCallback(async (q: string): Promise<ClientResult[]> => {
    const params = new URLSearchParams({ q });
    if (selectedCompany) params.set('company_id', selectedCompany.id);
    const res = await fetch(`/api/clients?${params}`);
    if (!res.ok) return [];
    return res.json();
  }, [selectedCompany]);

  async function handleCreateCompany() {
    if (!newCompany.name.trim()) {
      setError('El nombre de la empresa es obligatorio');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/client-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCompany),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear empresa');
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSelectedCompany({ id: data.id, name: data.name, cif_nif: data.cif_nif });
    setShowNewCompany(false);
    setNewCompany({ name: '', cif_nif: '', contact_email: '', phone: '' });
    setLoading(false);
  }

  async function handleCreateClient() {
    if (!newClient.full_name.trim()) {
      setError('El nombre de la persona es obligatorio');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newClient,
        client_company_id: selectedCompany?.id || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear persona');
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSelectedClient({
      id: data.tenant_client_id,
      internal_ref: null,
      client_global: {
        id: data.client_global_id,
        full_name: data.full_name,
        email_norm: newClient.email || null,
        phone_norm: newClient.phone || null,
      },
    });
    setShowNewClient(false);
    setNewClient({ full_name: '', email: '', phone: '', dni: '' });
    setLoading(false);
  }

  async function handleCreateSession() {
    if (!selectedClient) {
      setError('Selecciona una persona autorizada');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_num: docNum || null,
        tenant_client_id: selectedClient.id,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear sesion');
      setLoading(false);
      return;
    }

    const session = await res.json();
    router.push(`/counter/sesion/${session.id}`);
  }

  function resetCompany() {
    setSelectedCompany(null);
    setSelectedClient(null);
  }

  function resetClient() {
    setSelectedClient(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-xl font-semibold">Nueva entrega</h1>
          <Link
            href="/counter"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancelar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Paso 1: Numero de documento */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <label className="mb-1 block text-sm font-medium">
            N.o albaran / factura
          </label>
          <input
            type="text"
            value={docNum}
            onChange={(e) => setDocNum(e.target.value)}
            placeholder="Ej: ALB-2026-001"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <p className="mt-1 text-xs text-zinc-500">Opcional</p>
        </div>

        {/* Paso 2: Empresa */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <label className="mb-2 block text-sm font-medium">
            Empresa cliente
          </label>

          {selectedCompany ? (
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <div>
                <p className="text-sm font-medium">{selectedCompany.name}</p>
                {selectedCompany.cif_nif && (
                  <p className="text-xs text-zinc-500">{selectedCompany.cif_nif}</p>
                )}
              </div>
              <button
                type="button"
                onClick={resetCompany}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cambiar
              </button>
            </div>
          ) : showNewCompany ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                placeholder="Nombre de la empresa *"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="text"
                value={newCompany.cif_nif}
                onChange={(e) => setNewCompany({ ...newCompany, cif_nif: e.target.value })}
                placeholder="CIF / NIF"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="email"
                value={newCompany.contact_email}
                onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
                placeholder="Email de contacto"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="tel"
                value={newCompany.phone}
                onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                placeholder="Telefono"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateCompany}
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Guardar empresa
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCompany(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <FuzzySearch<CompanyResult>
                placeholder="Buscar empresa..."
                fetchResults={searchCompanies}
                renderItem={(c) => (
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.cif_nif && (
                      <span className="ml-2 text-xs text-zinc-500">{c.cif_nif}</span>
                    )}
                  </div>
                )}
                onSelect={setSelectedCompany}
              />
              <button
                type="button"
                onClick={() => setShowNewCompany(true)}
                className="mt-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                + Nueva empresa
              </button>
            </>
          )}
        </div>

        {/* Paso 3: Persona autorizada */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <label className="mb-2 block text-sm font-medium">
            Persona autorizada
          </label>

          {selectedClient ? (
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
              <div>
                <p className="text-sm font-medium">
                  {selectedClient.client_global.full_name}
                </p>
                {selectedClient.client_global.email_norm && (
                  <p className="text-xs text-zinc-500">
                    {selectedClient.client_global.email_norm}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetClient}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cambiar
              </button>
            </div>
          ) : showNewClient ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newClient.full_name}
                onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                placeholder="Nombre completo *"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="text"
                value={newClient.dni}
                onChange={(e) => setNewClient({ ...newClient, dni: e.target.value })}
                placeholder="DNI / NIF"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="Email (opcional)"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="Telefono (opcional)"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Guardar persona
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <FuzzySearch<ClientResult>
                placeholder="Buscar persona..."
                fetchResults={searchClients}
                renderItem={(c) => (
                  <div>
                    <span className="font-medium">{c.client_global.full_name}</span>
                    {c.client_global.email_norm && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {c.client_global.email_norm}
                      </span>
                    )}
                  </div>
                )}
                onSelect={setSelectedClient}
              />
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="mt-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                + Nueva persona
              </button>
            </>
          )}
        </div>

        {/* Resumen y boton crear */}
        <button
          type="button"
          onClick={handleCreateSession}
          disabled={loading || !selectedClient}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Creando...' : 'Crear sesion de entrega'}
        </button>
      </main>
    </div>
  );
}
