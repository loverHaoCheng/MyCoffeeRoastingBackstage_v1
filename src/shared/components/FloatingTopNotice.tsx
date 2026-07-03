import { type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

import styles from './FloatingTopNotice.module.css';

type FloatingTopNoticeSlot = 'primary' | 'secondary';

interface FloatingTopNoticeProps extends PropsWithChildren {
  className?: string;
  slot?: FloatingTopNoticeSlot;
}

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter(Boolean).join(' ');
};

export function FloatingTopNotice({
  children,
  className,
  slot = 'primary',
}: FloatingTopNoticeProps) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={styles.root} data-slot={slot}>
      <div className={joinClassNames(styles.content, className)}>{children}</div>
    </div>,
    document.body,
  );
}
