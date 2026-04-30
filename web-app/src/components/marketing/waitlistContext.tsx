// waitlistContext.tsx — provides `open(source)` to the 3 marketing waitlist
// CTAs (banner / hero / final-cta) per ADR-019 §C.
//
// Single component export (`WaitlistProvider`) plus a single hook
// (`useWaitlist`). The HMR fast-refresh rule is satisfied by exporting
// only the component and the hook from this file.

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { WaitlistSource } from '../../services/waitlist';

interface WaitlistContextValue {
  open: (source: WaitlistSource) => void;
}

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useWaitlist(): WaitlistContextValue {
  const ctx = useContext(WaitlistContext);
  if (!ctx) return { open: () => {} };
  return ctx;
}

export interface WaitlistProviderProps {
  children: ReactNode;
  open: (source: WaitlistSource) => void;
}

export function WaitlistProvider({ children, open }: WaitlistProviderProps) {
  return (
    <WaitlistContext.Provider value={{ open }}>{children}</WaitlistContext.Provider>
  );
}
