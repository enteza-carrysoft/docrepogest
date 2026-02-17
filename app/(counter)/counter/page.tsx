'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

interface SessionListItem {
    id: string;
    doc_num: string | null;
    status: string;
    created_at: string;
    client_name: string;
    client_email: string | null;
}

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Esperando firma y PDF',
    SIGNED: 'Firmado',
    PDF_UPLOADED: 'PDF subido',
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

export default function CounterDashboardPage() {
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPairing, setShowPairing] = useState(false);
    const [terminalToken, setTerminalToken] = useState<string | null>(null);
    const [loadingToken, setLoadingToken] = useState(false);

    useEffect(() => {
        async function fetchSessions() {
            try {
                const res = await fetch('/api/sessions?limit=20');
                if (!res.ok) {
                    setError('Error al cargar las sesiones');
                    return;
                }
                const data = await res.json();
                setSessions(data.sessions || []);
            } catch {
                setError('Error de conexión');
            } finally {
                setLoading(false);
            }
        }

        fetchSessions();
    }, []);

    async function handlePairingOpen() {
        setShowPairing(true);
        if (!terminalToken) {
            setLoadingToken(true);
            try {
                const res = await fetch('/api/sessions/terminal/token');
                if (res.ok) {
                    const data = await res.json();
                    setTerminalToken(data.token);
                }
            } catch (err) {
                console.error('Error fetching token:', err);
            } finally {
                setLoadingToken(false);
            }
        }
    }

    const terminalUrl = terminalToken
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/firmar/terminal?token=${terminalToken}`
        : '';

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <h1 className="text-xl font-semibold">Entregas Firmadas</h1>
                    <span className="text-sm text-zinc-500">Mostrador</span>
                </div>
            </header>

            <main className="mx-auto max-w-4xl p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-medium">Sesiones recientes</h2>
                    <Link
                        href="/counter/nueva"
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        Nueva entrega
                    </Link>
                    <button
                        onClick={handlePairingOpen}
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        Vincular mostrador
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
                    </div>
                ) : error ? (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
                        <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            No hay sesiones aún
                        </p>
                        <p className="text-sm text-zinc-500">
                            Crea una nueva sesión de entrega para empezar
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map((session) => (
                            <Link
                                key={session.id}
                                href={`/counter/sesion/${session.id}`}
                                className="block rounded-lg border bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                                {session.client_name}
                                            </p>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[session.status] || ''}`}
                                            >
                                                {STATUS_LABELS[session.status] || session.status}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                                            {session.doc_num && (
                                                <>
                                                    <span>Doc: {session.doc_num}</span>
                                                    <span>·</span>
                                                </>
                                            )}
                                            {session.client_email && (
                                                <>
                                                    <span>{session.client_email}</span>
                                                    <span>·</span>
                                                </>
                                            )}
                                            <span>
                                                {new Date(session.created_at).toLocaleDateString('es-ES', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <svg
                                        className="h-5 w-5 flex-shrink-0 text-zinc-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal de Vinculación */}
            {showPairing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Vincular Mostrador</h3>
                            <button
                                onClick={() => setShowPairing(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                                ✕
                            </button>
                        </div>

                        {loadingToken ? (
                            <div className="flex justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="mb-4 text-sm text-zinc-500">
                                    Escanee este QR con la tablet del mostrador para vincularla a su usuario.
                                </p>
                                <div className="mb-4 flex justify-center rounded-lg bg-white p-4">
                                    <QRCodeSVG value={terminalUrl} size={200} level="M" />
                                </div>
                                <div className="rounded-lg bg-zinc-100 p-3 text-left dark:bg-zinc-800">
                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        URL del Terminal
                                    </p>
                                    <p className="break-all text-[10px] font-mono text-zinc-500">
                                        {terminalUrl}
                                    </p>
                                </div>
                                <p className="mt-4 text-[10px] text-zinc-400">
                                    Esta vinculación es persistente. Sólo tendrá que hacerlo una vez por dispositivo.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
