import { useEffect, useState } from 'react';

import { useBeans } from '@/modules/bean/hooks/useBeans';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';

import styles from './AppStartupSplash.module.css';

type SplashState = 'loading' | 'splitting' | 'done';

export function AppStartupSplash() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const status = useAuthStore((state) => state.status);
  const beansQuery = useBeans({ enabled: hasHydrated && status === 'authenticated' });
  const [state, setState] = useState<SplashState>('loading');

  const isReady = hasHydrated && status !== 'hydrating' &&
    (status !== 'authenticated' || (beansQuery.isFetched && !beansQuery.isFetching) || beansQuery.isError);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setState('splitting');
    const timer = window.setTimeout(() => {
      setState('done');
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isReady]);

  if (state === 'done') return null;
  const isSplitting = state === 'splitting';
  const transitionClass = isSplitting ? styles.splitting ?? '' : '';
  const trailTopClass = [styles.trail ?? '', styles.top ?? '', transitionClass].filter(Boolean).join(' ');
  const trailBottomClass = [styles.trail ?? '', styles.bottom ?? '', transitionClass].filter(Boolean).join(' ');
  const curtainTopClass = [styles.curtain ?? '', styles.top ?? '', transitionClass].filter(Boolean).join(' ');
  const curtainBottomClass = [styles.curtain ?? '', styles.bottom ?? '', transitionClass].filter(Boolean).join(' ');

  return (
    <div aria-label="正在进入 EasyBake" aria-live="polite" className={styles.splash} data-state={state}>
      <div className={trailTopClass} />
      <div className={trailBottomClass} />
      <div className={curtainTopClass} />
      <div className={curtainBottomClass} />
      <div className={styles.wordmark} data-state={state} aria-hidden="true">
        {'EasyBake'.split('').map((character, index) => (
          <span className={styles.letter} key={`${character}-${String(index)}`} style={{ animationDelay: `${String(index * 0.08)}s` }}>
            {character}
          </span>
        ))}
      </div>
    </div>
  );
}
