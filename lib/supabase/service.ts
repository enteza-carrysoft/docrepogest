import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con service_role key.
 * Bypassa RLS - usar SOLO en API routes server-side
 * donde la autorización se maneja a nivel de código.
 *
 * Casos de uso:
 * - Ruta de firma (sin autenticación del firmante)
 * - Ruta pública de sesión
 * - tryFinalize (operaciones del sistema)
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local from Dashboard → Settings → API.',
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
