import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]',
  {
    defaultVariants: {
      size: 'default',
      variant: 'secondary',
    },
    variants: {
      size: {
        default: 'h-11 px-4',
        icon: 'h-10 w-10',
        sm: 'h-9 px-3 text-xs',
      },
      variant: {
        ghost:
          'border border-transparent bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-hover-surface)] hover:text-[var(--app-text)]',
        primary:
          'border border-[var(--app-emphasis-border-strong)] bg-[var(--app-text)] px-4 text-[var(--app-bg)] shadow-[0_14px_32px_rgba(15,23,42,0.12)] hover:bg-[color-mix(in_srgb,var(--app-text)_92%,white)]',
        secondary:
          'border border-[var(--app-emphasis-border-soft)] bg-[color-mix(in_srgb,var(--app-bg-elevated)_94%,transparent)] text-[var(--app-text)] shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:border-[var(--app-emphasis-border-medium)] hover:bg-[color-mix(in_srgb,var(--app-bg-elevated)_98%,white_12%)]',
      },
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, type = 'button', variant, ...props }, ref) => {
    return <button className={cn(buttonVariants({ size, variant }), className)} ref={ref} type={type} {...props} />;
  },
);

Button.displayName = 'Button';
