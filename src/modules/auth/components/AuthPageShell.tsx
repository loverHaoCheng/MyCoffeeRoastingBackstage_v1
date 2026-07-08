import type { ReactNode } from 'react';

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
  return (
    <main className={styles.page}>
      <section className={joinClassNames(styles.shell, shellClassName)}>
        {brandTitle ? <div className={styles.brandTitle}>{brandTitle}</div> : null}

        {!heroHidden ? (
          <header className={styles.hero}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </header>
        ) : null}

        <div className={styles.card}>{children}</div>

        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </section>
    </main>
  );
}
