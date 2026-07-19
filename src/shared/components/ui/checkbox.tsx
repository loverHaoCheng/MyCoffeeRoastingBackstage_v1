import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/shared/utils/cn';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      {...props}
      className={cn(
        'mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border border-[var(--app-border-soft)] bg-[var(--app-bg)] text-[var(--app-text)] accent-[var(--app-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      type="checkbox"
    />
  );
});

Checkbox.displayName = 'Checkbox';
