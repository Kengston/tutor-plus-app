/**
 * Auth shell (ADR-0005 §2: auth is mandatory at entry).
 *
 * Phase 0 is a DEV STUB — `signIn()` just flips an in-memory session so the
 * gate and navigation can be exercised. Real Supabase GoTrue (email/phone OTP
 * + Apple + Google, Sign in with Apple on iOS) lands in Phase 4.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AuthMethod = 'apple' | 'google' | 'email' | 'phone';

interface AuthContextValue {
  /** Phase 0: boolean session. Becomes a real user/session object in Phase 4. */
  session: boolean;
  signIn: (method?: AuthMethod) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: () => setSession(true),
      signOut: () => setSession(false),
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
