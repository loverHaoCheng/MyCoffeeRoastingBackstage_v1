import { createContext } from 'react';
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

interface HeaderActionRegistrationContextValue {
  enabled: boolean;
  register: (configs: ViewportFloatingActionButtonProps[]) => () => void;
}

export const FloatingActionRegistrationContext =
  createContext<FloatingActionRegistrationContextValue | null>(null);

export const HeaderActionRegistrationContext =
  createContext<HeaderActionRegistrationContextValue | null>(null);
