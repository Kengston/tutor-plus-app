/**
 * Global snackbar controller (UI-v2 S1) — the app-side counterpart of the prototype's
 * `window.__snack` event bus, as React context. Screens call `useSnack().show(...)`
 * after a domain mutation; the single `<SnackHost/>` (root layout, inside the WebFrame
 * column) renders the current snack and auto-dismisses it. A new `show` replaces the
 * current snack and restarts the timer — mirroring the prototype's SnackHost.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Snackbar } from '@/ui/Snackbar';

export interface SnackOptions {
  /** Accent action button («Вернуть» / «Отменить»). Pressing it dismisses the snack. */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay, ms (prototype default 3500). */
  duration?: number;
  /** Рукописная галочка перед текстом — подтверждение создания (слайс #75). */
  mark?: 'check';
}

interface SnackState extends SnackOptions {
  /** Monotonic key — re-mounts the bar (and its entrance animation) per `show`. */
  key: number;
  message: string;
}

interface SnackController {
  show: (message: string, options?: SnackOptions) => void;
}

const SnackContext = createContext<SnackController | null>(null);
const SnackStateContext = createContext<{ snack: SnackState | null; dismiss: () => void } | null>(null);

export function SnackProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<SnackState | null>(null);
  const keyRef = useRef(0);

  const show = useCallback((message: string, options?: SnackOptions) => {
    keyRef.current += 1;
    setSnack({ key: keyRef.current, message, ...options });
  }, []);

  const dismiss = useCallback(() => setSnack(null), []);

  const controller = useMemo<SnackController>(() => ({ show }), [show]);
  const state = useMemo(() => ({ snack, dismiss }), [snack, dismiss]);

  return (
    <SnackContext.Provider value={controller}>
      <SnackStateContext.Provider value={state}>{children}</SnackStateContext.Provider>
    </SnackContext.Provider>
  );
}

/** `const snack = useSnack(); snack.show(t('snack.lessonDone'), { actionLabel: t('action.undo'), onAction })` */
export function useSnack(): SnackController {
  const ctx = useContext(SnackContext);
  if (!ctx) throw new Error('useSnack must be used within <SnackProvider>');
  return ctx;
}

/** Renders the active snack — mount ONCE, inside the WebFrame column so the bar
 *  stays within the ~430px app width (ADR-0010). */
export function SnackHost() {
  const ctx = useContext(SnackStateContext);
  const snack = ctx?.snack ?? null;
  const dismiss = ctx?.dismiss;

  // Auto-dismiss — keyed by snack.key so a replacing `show` restarts the timer.
  // (Hooks run unconditionally; the provider guard throws only after them.)
  useEffect(() => {
    if (!snack || !dismiss) return;
    const timer = setTimeout(dismiss, snack.duration ?? 3500);
    return () => clearTimeout(timer);
  }, [snack, dismiss]);

  if (!ctx || !dismiss) throw new Error('SnackHost must be used within <SnackProvider>');
  if (!snack) return null;
  return (
    <Snackbar
      key={snack.key}
      message={snack.message}
      mark={snack.mark}
      actionLabel={snack.actionLabel}
      onAction={() => {
        snack.onAction?.();
        dismiss();
      }}
    />
  );
}
