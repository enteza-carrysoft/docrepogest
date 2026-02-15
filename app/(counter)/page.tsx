import Link from 'next/link';

export default function CounterPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-semibold">Entregas Firmadas</h1>
          <span className="text-sm text-zinc-500">Mostrador</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Sesiones de entrega</h2>
          <Link
            href="/counter/nueva"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Nueva entrega
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          Crea una nueva sesión de entrega para capturar la firma del cliente.
        </p>
      </main>
    </div>
  );
}
