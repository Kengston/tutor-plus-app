/**
 * Dual-mode runtime — the binary `clientType` lexicon axis (ADR-0006).
 *
 * `useT()`    → bound translator `(key) => string` for the active mode.
 * `useMode()` → current mode/clientType + setters (drives the dev toggle).
 *
 * `clientType` (Ученик|Клиент) is the SOLE lexicon axis. `activity` is a
 * non-lexical profile attribute; it only presets the default `clientType`.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { plural } from './plural';
import { messages, t as translate, type Mode, type StringKey } from './strings';

export type ClientType = 'Ученик' | 'Клиент';

/** Professional vertical — NON-lexical (ADR-0006). Presets default clientType only. */
export type Activity = 'teacher' | 'psychologist' | 'coach' | 'mentor' | 'trainer';

export const clientTypeToMode = (c: ClientType): Mode => (c === 'Клиент' ? 'client' : 'tutor');
export const modeToClientType = (m: Mode): ClientType => (m === 'client' ? 'Клиент' : 'Ученик');

/** Default clientType per activity (passport classification, freely overridable). */
export const activityDefaultClientType: Record<Activity, ClientType> = {
  teacher: 'Ученик',
  psychologist: 'Клиент',
  coach: 'Клиент',
  mentor: 'Клиент',
  trainer: 'Клиент',
};

interface DualModeContextValue {
  clientType: ClientType;
  mode: Mode;
  setClientType: (c: ClientType) => void;
  toggle: () => void;
}

const DualModeContext = createContext<DualModeContextValue | null>(null);

export function DualModeProvider({
  children,
  initial = 'Ученик',
}: {
  children: ReactNode;
  initial?: ClientType;
}) {
  const [clientType, setClientType] = useState<ClientType>(initial);

  const value = useMemo<DualModeContextValue>(
    () => ({
      clientType,
      mode: clientTypeToMode(clientType),
      setClientType,
      toggle: () => setClientType((c) => (c === 'Ученик' ? 'Клиент' : 'Ученик')),
    }),
    [clientType],
  );

  return <DualModeContext.Provider value={value}>{children}</DualModeContext.Provider>;
}

function useDualModeContext(): DualModeContextValue {
  const ctx = useContext(DualModeContext);
  if (!ctx) throw new Error('useMode/useT must be used within <DualModeProvider>');
  return ctx;
}

/** Current dual-mode state + controls. */
export function useMode(): DualModeContextValue {
  return useDualModeContext();
}

/** Translator bound to the active mode: `const t = useT(); t('nav.students')`. */
export function useT(): (key: StringKey) => string {
  const { mode } = useDualModeContext();
  return useMemo(() => (key: StringKey) => translate(key, mode), [mode]);
}

export { messages, plural, translate as t };
export type { Mode, StringKey };
