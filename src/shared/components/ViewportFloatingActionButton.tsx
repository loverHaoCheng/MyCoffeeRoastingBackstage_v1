import { useContext, useEffect, useRef } from 'react';

import {
  FloatingActionRegistrationContext,
  type ViewportFloatingActionButtonProps,
} from './ViewportFloatingActionButton.context';

export function ViewportFloatingActionButton({
  ariaLabel,
  icon,
  onClick,
}: ViewportFloatingActionButtonProps) {
  const registrationContext = useContext(FloatingActionRegistrationContext);
  const latestOnClickRef = useRef(onClick);
  const stableConfigRef = useRef<ViewportFloatingActionButtonProps | null>(null);

  latestOnClickRef.current = onClick;

  if (stableConfigRef.current?.ariaLabel !== ariaLabel) {
    stableConfigRef.current = {
      ariaLabel,
      icon,
      onClick: () => {
        latestOnClickRef.current();
      },
    };
  }

  useEffect(() => {
    if (!registrationContext?.enabled) {
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
