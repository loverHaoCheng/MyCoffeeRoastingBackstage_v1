import { forwardRef, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

type InputStatus = 'error' | 'warning';

export interface InputNumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix' | 'size' | 'value'> {
  onChange?: (value: null | number) => void;
  precision?: number;
  prefix?: ReactNode;
  status?: InputStatus;
  suffix?: ReactNode;
  value?: null | number;
}

const frameClassName = (status?: InputStatus, disabled?: boolean): string => {
  return cn(
    'flex min-h-11 w-full items-center gap-3 rounded-2xl border bg-[var(--app-bg-elevated)] px-4 text-[var(--app-text)] shadow-[inset_0_1px_0_var(--app-card-inset-highlight)] transition-colors duration-200',
    status === 'error'
      ? 'border-[color-mix(in_srgb,var(--ant-color-error,#dc2626)_70%,var(--app-border-soft))]'
      : 'border-[var(--app-border-soft)]',
    disabled && 'cursor-not-allowed opacity-60',
    !disabled && 'focus-within:border-[var(--app-emphasis-border-medium)] focus-within:ring-2 focus-within:ring-[var(--app-focus-ring)]/25',
  );
};

const formatNumber = (value: null | number | undefined, precision?: number): string => {
  if (value == null || Number.isNaN(value)) {
    return '';
  }

  if (typeof precision === 'number') {
    return value.toFixed(precision);
  }

  return String(value);
};

const normalizeNumber = (value: number, min?: number, max?: number, precision?: number): number => {
  let nextValue = value;

  if (typeof min === 'number') {
    nextValue = Math.max(nextValue, min);
  }

  if (typeof max === 'number') {
    nextValue = Math.min(nextValue, max);
  }

  if (typeof precision === 'number') {
    const factor = 10 ** precision;
    nextValue = Math.round(nextValue * factor) / factor;
  }

  return nextValue;
};

const isIntermediateValue = (value: string): boolean => {
  return value === '' || value === '-' || value === '.' || value === '-.';
};

const parseNumber = (value: string): null | number => {
  if (isIntermediateValue(value)) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const resolveNumericProp = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
};

const inputClassName = cn(
  'h-11 w-full min-w-0 border-0 bg-transparent px-0 text-[14px] leading-5 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-tertiary)] disabled:cursor-not-allowed',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
);

const affixClassName = 'shrink-0 text-[var(--app-text-tertiary)]';

const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(
  ({ className, disabled, max, min, onBlur, onChange, onFocus, precision, prefix, status, step, suffix, value = null, ...props }, ref) => {
    const [draftValue, setDraftValue] = useState<string>(() => formatNumber(value, precision));
    const [isFocused, setIsFocused] = useState(false);
    const lastCommittedValueRef = useRef<null | number>(value);
    const resolvedMin = resolveNumericProp(min);
    const resolvedMax = resolveNumericProp(max);

    useEffect(() => {
      if (value != null) {
        lastCommittedValueRef.current = value;
      }

      if (!isFocused) {
        setDraftValue(formatNumber(value, precision));
      }
    }, [isFocused, precision, value]);

    const resolvedStep = useMemo(() => {
      if (typeof step === 'number' || typeof step === 'string') {
        return step;
      }

      if (typeof precision === 'number' && precision > 0) {
        return 1 / (10 ** precision);
      }

      return 1;
    }, [precision, step]);

    return (
      <div className={cn(frameClassName(status, disabled), className)}>
        {prefix ? <span className={affixClassName}>{prefix}</span> : null}
        <input
          {...props}
          className={inputClassName}
          disabled={disabled}
          inputMode={typeof precision === 'number' && precision > 0 ? 'decimal' : 'numeric'}
          onBlur={(event) => {
            setIsFocused(false);

            const parsedValue = parseNumber(event.target.value);

            if (parsedValue == null) {
              const fallbackValue = lastCommittedValueRef.current;

              onChange?.(fallbackValue);
              setDraftValue(formatNumber(fallbackValue, precision));
            } else {
              const normalizedValue = normalizeNumber(parsedValue, resolvedMin, resolvedMax, precision);

              lastCommittedValueRef.current = normalizedValue;
              onChange?.(normalizedValue);
              setDraftValue(formatNumber(normalizedValue, precision));
            }

            onBlur?.(event);
          }}
          onChange={(event) => {
            const nextDraftValue = event.target.value;

            setDraftValue(nextDraftValue);

            const parsedValue = parseNumber(nextDraftValue);

            onChange?.(parsedValue);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          ref={ref}
          role="spinbutton"
          step={resolvedStep}
          type="text"
          value={draftValue}
        />
        {suffix ? <span className={affixClassName}>{suffix}</span> : null}
      </div>
    );
  },
);

InputNumber.displayName = 'InputNumber';

export default InputNumber;
