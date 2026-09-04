import type { ReactNode } from 'react';

import { LegalFooter } from '@/modules/legal/components';
import { usePageGuide } from '@/shared/guides/usePageGuide';
import { useLocation } from 'react-router-dom';

import styles from '../pages/AuthPage.module.css';

interface AuthPageShellProps {
  actions?: ReactNode;
  brandTitle?: string;
  children: ReactNode;
  description: string;
  eyebrow: string;
  heroHidden?: boolean;
  shellClassName?: string;
  title: string;
}

const joinClassNames = (...classNames: (string | false | null | undefined)[]) => {
  return classNames.filter(Boolean).join(' ');
};

export function AuthPageShell({
  actions,
  brandTitle,
  children,
  description,
  eyebrow,
  heroHidden = false,
  shellClassName,
  title,
}: AuthPageShellProps) {
  const { pathname } = useLocation();
  const pageGuide = usePageGuide(pathname);
  return (
    <main className={styles.page}>
      {pageGuide.action ? <button aria-label={pageGuide.action.ariaLabel} className={styles.pageGuideButton} onClick={pageGuide.action.onClick} type="button">{pageGuide.action.icon}</button> : null}
      <section className={joinClassNames(styles.shell, shellClassName)}>
        {brandTitle ? <div className={styles.brandTitle}>{brandTitle}</div> : null}

        {heroHidden ? <h1 className="sr-only">{title}</h1> : null}

        {!heroHidden ? (
          <header className={styles.hero}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </header>
        ) : null}

        <div className={styles.card}>{children}</div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}

        <LegalFooter />
      </section>
    </main>
  );
}
