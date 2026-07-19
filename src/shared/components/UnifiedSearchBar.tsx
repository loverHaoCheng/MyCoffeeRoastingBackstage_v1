import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Input from '@/shared/components/ui/input';
import type { ChangeEvent, ReactNode } from 'react';

import styles from './UnifiedSearchBar.module.css';

interface UnifiedSearchBarProps {
  className?: string;
  inputAriaLabel: string;
  placeholder: string;
  sectionAriaLabel: string;
  trailingAction?: ReactNode;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const joinClassNames = (...classNames: (string | undefined)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

export function UnifiedSearchBar({
  className,
  inputAriaLabel,
  placeholder,
  sectionAriaLabel,
  trailingAction,
  value,
  onChange,
}: UnifiedSearchBarProps) {
  return (
    <section className={joinClassNames(styles.container, className)} aria-label={sectionAriaLabel}>
      <div className={styles.field}>
        <Input
          allowClear
          aria-label={inputAriaLabel}
          onChange={onChange}
          placeholder={placeholder}
          prefix={<SearchOutlined />}
          value={value}
        />
      </div>
      {trailingAction ? <div className={styles.trailingAction}>{trailingAction}</div> : null}
    </section>
  );
}
