import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Input from "antd/es/input";
import type { ChangeEvent } from 'react';

import styles from './UnifiedSearchBar.module.css';

interface UnifiedSearchBarProps {
  className?: string;
  inputAriaLabel: string;
  placeholder: string;
  sectionAriaLabel: string;
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
    </section>
  );
}
