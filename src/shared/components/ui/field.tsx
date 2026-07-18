import { forwardRef, type HTMLAttributes, type LabelHTMLAttributes } from 'react';

import { cn } from '@/shared/utils/cn';

export const FieldSet = forwardRef<HTMLFieldSetElement, HTMLAttributes<HTMLFieldSetElement>>(({ className, ...props }, ref) => {
  return <fieldset {...props} className={cn('grid gap-3 border-0 p-0 m-0 min-w-0', className)} ref={ref} />;
});

FieldSet.displayName = 'FieldSet';

export const FieldLegend = forwardRef<HTMLLegendElement, HTMLAttributes<HTMLLegendElement> & { variant?: 'default' | 'label' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <legend
        {...props}
        className={cn(
          'm-0 p-0 text-[var(--app-text)]',
          variant === 'label' ? 'text-sm font-semibold leading-5' : 'text-sm leading-5',
          className,
        )}
        ref={ref}
      />
    );
  },
);

FieldLegend.displayName = 'FieldLegend';

export const FieldDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => {
  return <p {...props} className={cn('m-0 text-[12px] leading-5 text-[var(--app-text-secondary)]', className)} ref={ref} />;
});

FieldDescription.displayName = 'FieldDescription';

export const FieldGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  return <div {...props} className={cn('grid gap-2', className)} ref={ref} />;
});

FieldGroup.displayName = 'FieldGroup';

export const Field = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }>(
  ({ className, orientation = 'vertical', ...props }, ref) => {
    return (
      <div
        {...props}
        className={cn(
          'grid min-w-0',
          orientation === 'horizontal' ? 'grid-cols-[auto_minmax(0,1fr)] items-start gap-3' : 'gap-2',
          className,
        )}
        ref={ref}
      />
    );
  },
);

Field.displayName = 'Field';

export const FieldLabel = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => {
  return <label {...props} className={cn('text-[13px] leading-5 text-[var(--app-text)]', className)} ref={ref} />;
});

FieldLabel.displayName = 'FieldLabel';
