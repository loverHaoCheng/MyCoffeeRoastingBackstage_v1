import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { ChangeEvent } from 'react';

import styles from './UnifiedSearchBar.module.css';

interface UnifiedSearchBarProps {
  inputAriaLabel: string;
  placeholder: string;
  sectionAriaLabel: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function UnifiedSearchBar({
  inputAriaLabel,
  placeholder,
  sectionAriaLabel,
  value,
  onChange,
}: UnifiedSearchBarProps) {
  return (
    <section className={styles.container} aria-label={sectionAriaLabel}>
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
