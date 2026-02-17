'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <p className="text-zinc-500">Cargando...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.resolve().then(() => {
      if (searchParams.get('verified') === 'true') {
        setSuccess('Email verificado correctamente. Ya puede iniciar sesion.');
        setMode('login');
      }
      if (searchParams.get('error') === 'verification_failed') {
        setError(
          'No se pudo verificar el email. El enlace puede haber expirado. Intente registrarse de nuevo.',
        );
      }
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const supabase = createClient();

    if (mode === 'signup') {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/confirm`
          : '/auth/confirm';

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess(
        'Le hemos enviado un email de verificacion. Revise su bandeja de entrada (y spam) y haga click en el enlace para activar su cuenta.',
      );
      setMode('login');
      setPassword('');
      setLoading(false);
      return;
    }

    // Login
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      const msg = loginError.message.toLowerCase();

      if (
        msg.includes('email not confirmed') ||
        msg.includes('email_not_confirmed') ||
        msg.includes('not confirmed')
      ) {
        setError(
          'Su email aun no ha sido verificado. Revise su bandeja de entrada y haga click en el enlace de verificacion.',
        );
      } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        // Supabase returns this generic error for both wrong password AND unconfirmed email
        setError(
          'No se pudo iniciar sesion. Verifique su email y contrasena. Si acaba de registrarse, compruebe que ha confirmado su email haciendo click en el enlace que le enviamos.',
        );
      } else {
        setError(`Error al iniciar sesion: ${loginError.message}`);
      }
      setLoading(false);
      return;
    }

    // Auto-link client_global by email
    const linkRes = await fetch('/api/portal/link', { method: 'POST' });
    const linkData = await linkRes.json();

    if (!linkData.linked) {
      setError(linkData.error || 'No se encontraron entregas para este email');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push('/portal');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Portal Cliente</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Acceda a sus documentos firmados
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === 'login'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
          >
            Iniciar sesion
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === 'signup'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              {success}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="El email usado en sus entregas"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Contrasena
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading
              ? 'Cargando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          Use el email que le proporcionaron al firmar su entrega.
        </p>
      </div>
    </div>
  );
}
