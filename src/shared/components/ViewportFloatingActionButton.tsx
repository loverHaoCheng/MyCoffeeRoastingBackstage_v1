import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ViewportFloatingActionButtonProps {
  ariaLabel: string;
  icon: ReactNode;
  onClick: () => void;
}

interface FloatingActionRegistrationContextValue {
  enabled: boolean;
  register: (config: ViewportFloatingActionButtonProps) => () => void;
}

export const FloatingActionRegistrationContext =
  createContext<FloatingActionRegistrationContextValue | null>(null);

export function ViewportFloatingActionButton({
  ariaLabel,
  icon,
  onClick,
}: ViewportFloatingActionButtonProps) {
  const registrationContext = useContext(FloatingActionRegistrationContext);
  const latestOnClickRef = useRef(onClick);
  const stableConfigRef = useRef<ViewportFloatingActionButtonProps | null>(null);

  latestOnClickRef.current = onClick;

  if (!stableConfigRef.current || stableConfigRef.current.ariaLabel !== ariaLabel) {
    stableConfigRef.current = {
      ariaLabel,
      icon,
      onClick: () => {
        latestOnClickRef.current();
      },
    };
  }

  useEffect(() => {
    if (!registrationContext || !registrationContext.enabled) {
      return;
    }

    const stableConfig = stableConfigRef.current;

    if (!stableConfig) {
      return;
    }

    return registrationContext.register(stableConfig);
  }, [ariaLabel, registrationContext]);

  return null;
}
