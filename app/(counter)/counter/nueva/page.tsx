'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ClientOption {
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
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: '',
    email: '',
    phone: '',
    dni: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const res = await fetch('/api/clients');
    if (res.ok) {
      const data = await res.json();
      setClients(data);
    }
  }

  async function handleCreateClient() {
    if (!newClient.full_name.trim()) {
      setError('El nombre del cliente es obligatorio');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear cliente');
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSelectedClientId(data.tenant_client_id);
    setShowNewClient(false);
    setNewClient({ full_name: '', email: '', phone: '', dni: '' });
    await fetchClients();
    setLoading(false);
  }

  async function handleCreateSession() {
    if (!selectedClientId) {
      setError('Selecciona un cliente');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_num: docNum || null,
        tenant_client_id: selectedClientId,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al crear sesión');
      setLoading(false);
      return;
    }

    const session = await res.json();
    router.push(`/counter/sesion/${session.id}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-semibold">Nueva entrega</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Número de documento */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">
            N.o albarán / factura
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

        {/* Selector de cliente */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">Cliente</label>

          {!showNewClient ? (
            <>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_global.full_name}
                    {c.client_global.email_norm
                      ? ` (${c.client_global.email_norm})`
                      : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="mt-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                + Nuevo cliente
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <input
                type="text"
                value={newClient.full_name}
                onChange={(e) =>
                  setNewClient({ ...newClient, full_name: e.target.value })
                }
                placeholder="Nombre completo *"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="text"
                value={newClient.dni}
                onChange={(e) =>
                  setNewClient({ ...newClient, dni: e.target.value })
                }
                placeholder="DNI / NIF"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="email"
                value={newClient.email}
                onChange={(e) =>
                  setNewClient({ ...newClient, email: e.target.value })
                }
                placeholder="Email (opcional)"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) =>
                  setNewClient({ ...newClient, phone: e.target.value })
                }
                placeholder="Teléfono (opcional)"
                className="w-full rounded border px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Guardar cliente
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
          )}
        </div>

        {/* Botón crear sesión */}
        <button
          type="button"
          onClick={handleCreateSession}
          disabled={loading || !selectedClientId}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Creando...' : 'Crear sesión de entrega'}
        </button>
      </main>
    </div>
  );
}
