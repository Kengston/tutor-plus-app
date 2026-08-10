/**
 * Auth shell (ADR-0005 §2: auth is mandatory at entry).
 *
 * Phase 0 is a DEV STUB — `signIn()` flips the session so the gate and navigation can be
 * exercised. Real Supabase GoTrue (email/phone OTP + Apple + Google, Sign in with Apple on
 * iOS) lands in Phase 4.
 *
 * The session is PERSISTED (TP-FIX-0719, п. 6). It used to live in component state only, so
 * a reload — or a direct link to an inner route — dropped the user back on `/sign-in`. It now
 * rides on the single `profiles` row (`signed_in`, schema v12): the same store that already
 * survives a reload, no extra dependency, same behaviour on web and native. `ProfileGate`
 * reads it BEFORE the tree mounts and feeds it in as `initialSession`, so the auth gate never
 * sees a false «signed out» frame and never redirects away from a deep link.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { ensureProfile, updateProfile } from '@/db/mutations';

export type AuthMethod = 'apple' | 'google' | 'email' | 'phone';

interface AuthContextValue {
  /** Phase 0: boolean session. Becomes a real user/session object in Phase 4. */
  session: boolean;
  signIn: (method?: AuthMethod) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Write the session flag through to the profile row. Fire-and-forget: navigation reacts to
 *  React state, the write only has to land before the next launch. */
async function persistSession(active: boolean): Promise<void> {
  const profile = await ensureProfile();
  await updateProfile(profile, { signedIn: active });
}

export function AuthProvider({ initialSession = false, children }: { initialSession?: boolean; children: ReactNode }) {
  const [session, setSession] = useState(initialSession);

  const apply = useCallback((active: boolean) => {
    setSession(active);
    void persistSession(active).catch((e) => console.error('[auth] persist failed', e));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: () => apply(true),
      signOut: () => apply(false),
    }),
    [session, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
