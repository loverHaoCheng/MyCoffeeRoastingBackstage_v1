import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/shared/utils/cn';

type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  decorative?: boolean;
  orientation?: SeparatorOrientation;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  (
    {
      className,
      decorative = true,
      orientation = 'horizontal',
      ...props
    },
    ref,
  ) => {
    return (
      <div
        aria-hidden={decorative ? 'true' : undefined}
        className={cn(
          'shrink-0 bg-[var(--app-emphasis-border-soft)]',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className,
        )}
        ref={ref}
        role={decorative ? 'presentation' : 'separator'}
        {...props}
      />
    );
  },
);

Separator.displayName = 'Separator';
