import type { ReactNode } from 'react';
import styles from '@/modules/finance/components/FinanceEntryForm.module.css';

interface FormFieldProps {
  children: ReactNode;
  error?: string;
  helpText?: string;
  label: string;
  wide?: boolean;
}

const joinClassNames = (...classNames: (false | null | string | undefined)[]): string => {
  return classNames.filter((className): className is string => Boolean(className)).join(' ');
};

export function FormField({ children, error, helpText, label, wide }: FormFieldProps) {
  const showHelp = Boolean(error ?? helpText);

  return (
    <label className={joinClassNames(styles.field, wide && styles.fieldWide)}>
      <span>{label}</span>
      {children}
      {showHelp ? (
        <span className={joinClassNames(styles.helpText, error && styles.errorText)}>
          {error ?? helpText}
        </span>
      ) : null}
    </label>
  );
}
