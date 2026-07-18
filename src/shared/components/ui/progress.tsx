import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/shared/utils/cn';

interface ProgressContextValue {
  value: number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children?: ReactNode;
  indicatorClassName?: string;
  trackClassName?: string;
  value?: number | null;
}

const clampProgressValue = (value?: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
};

const useProgressContext = (): ProgressContextValue => {
  const context = useContext(ProgressContext);

  if (context == null) {
    throw new Error('ProgressLabel and ProgressValue must be used within Progress.');
  }

  return context;
};

export function Progress({
  children,
  className,
  indicatorClassName,
  trackClassName,
  value,
  ...props
}: ProgressProps) {
  const normalizedValue = clampProgressValue(value);
  const ariaLabel = props['aria-label'];

  return (
    <ProgressContext.Provider value={{ value: normalizedValue }}>
      <div className={cn('grid gap-1.5', className)} {...props}>
        {children ? <div className="flex items-center justify-between gap-3">{children}</div> : null}
        <div
          aria-label={ariaLabel}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(normalizedValue)}
          className={cn(
            'relative h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-text-tertiary)_14%,white)]',
            trackClassName,
          )}
          role="progressbar"
        >
          <div
            className={cn(
              'h-full w-full rounded-full bg-[color-mix(in_srgb,var(--app-text-secondary)_70%,white)] transition-transform duration-300 ease-out',
              indicatorClassName,
            )}
            style={{ transform: `translateX(-${String(100 - normalizedValue)}%)` }}
          />
        </div>
      </div>
    </ProgressContext.Provider>
  );
}

export function ProgressLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('text-[11px] font-medium leading-4 text-[var(--app-text-tertiary)]', className)}
      {...props}
    />
  );
}

export function ProgressValue({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  const { value } = useProgressContext();

  return (
    <span
      className={cn('shrink-0 text-[11px] font-semibold leading-4 text-[var(--app-text-secondary)]', className)}
      {...props}
    >
      {children ?? `${String(Math.round(value))}%`}
    </span>
  );
}
