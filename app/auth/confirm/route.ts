import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /auth/confirm - Email verification callback from Supabase
// Handles both PKCE (token_hash+type) and redirect (code) flows
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');

  const loginUrl = new URL('/portal/login', request.url);
  const supabase = await createClient();

  // Flow 1: PKCE - token_hash + type (email confirmation)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email',
    });

    if (error) {
      console.error('[auth/confirm] verifyOtp error:', error.message);
      loginUrl.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(loginUrl);
    }

    loginUrl.searchParams.set('verified', 'true');
    return NextResponse.redirect(loginUrl);
  }

  // Flow 2: Auth code exchange (OAuth / magic link / some Supabase flows)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/confirm] exchangeCode error:', error.message);
      loginUrl.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(loginUrl);
    }

    loginUrl.searchParams.set('verified', 'true');
    return NextResponse.redirect(loginUrl);
  }

  // Flow 3: Supabase already verified on its server and redirected here
  // without params. The email should already be confirmed.
  loginUrl.searchParams.set('verified', 'true');
  return NextResponse.redirect(loginUrl);
}
