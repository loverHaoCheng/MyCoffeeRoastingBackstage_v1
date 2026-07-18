"use client";

import { ChevronDown } from 'lucide-react';
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/shared/utils/cn';

interface AccordionContextValue {
  onValueChange?: (value: string[]) => void;
  openValues: string[];
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

const useAccordionContext = () => {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error('Accordion components must be used within Accordion.');
  }

  return context;
};

interface AccordionItemContextValue {
  contentId: string;
  isOpen: boolean;
  triggerId: string;
  value: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

const useAccordionItemContext = () => {
  const context = useContext(AccordionItemContext);

  if (!context) {
    throw new Error('AccordionTrigger and AccordionContent must be used within AccordionItem.');
  }

  return context;
};

interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  type?: 'multiple' | 'single';
  value?: string[];
}

export function Accordion({
  children,
  className,
  defaultValue,
  onValueChange,
  type = 'multiple',
  value,
  ...props
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const openValues = value ?? internalValue;

  const contextValue = useMemo<AccordionContextValue>(() => ({
    onValueChange,
    openValues,
    toggleItem: (nextValue) => {
      const currentValues = value ?? internalValue;
      const isOpen = currentValues.includes(nextValue);
      const resolvedValue = isOpen
        ? currentValues.filter((item) => item !== nextValue)
        : type === 'single'
          ? [nextValue]
          : [...currentValues, nextValue];

      if (value == null) {
        setInternalValue(resolvedValue);
      }

      onValueChange?.(resolvedValue);
    },
  }), [internalValue, onValueChange, openValues, type, value]);

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={cn('grid', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  value: string;
}

export function AccordionItem({
  as: Component = 'div',
  children,
  className,
  value,
  ...props
}: AccordionItemProps) {
  const { openValues } = useAccordionContext();
  const contentId = useId();
  const triggerId = useId();
  const isOpen = openValues.includes(value);

  return (
    <AccordionItemContext.Provider value={{ contentId, isOpen, triggerId, value }}>
      <Component
        className={cn('grid', className)}
        data-collapsed={isOpen ? 'false' : 'true'}
        data-state={isOpen ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </Component>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  collapsedAriaLabel?: string;
  disabled?: boolean;
  expandedAriaLabel?: string;
}

export function AccordionTrigger({
  'aria-label': ariaLabel,
  collapsedAriaLabel,
  children,
  className,
  disabled = false,
  expandedAriaLabel,
  onClick,
  type,
  ...props
}: AccordionTriggerProps) {
  const { toggleItem } = useAccordionContext();
  const { contentId, isOpen, triggerId, value } = useAccordionItemContext();
  const resolvedAriaLabel = isOpen ? expandedAriaLabel : collapsedAriaLabel;

  return (
    <button
      aria-controls={contentId}
      aria-expanded={isOpen}
      aria-label={resolvedAriaLabel ?? ariaLabel}
      className={cn(
        'group flex w-full items-center justify-between gap-3 rounded-[20px] border-0 bg-transparent p-0 text-left text-[var(--app-text)] outline-none',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
      disabled={disabled}
      data-state={isOpen ? 'open' : 'closed'}
      id={triggerId}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        toggleItem(value);
      }}
      type={type ?? 'button'}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronDown
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[var(--app-text-tertiary)] transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
        data-slot="chevron"
      />
    </button>
  );
}

interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function AccordionContent({
  children,
  className,
  ...props
}: AccordionContentProps) {
  const { contentId, isOpen, triggerId } = useAccordionItemContext();

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        'grid transition-[grid-template-rows,opacity,padding-top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOpen ? 'grid-rows-[1fr] pt-4 opacity-100' : 'grid-rows-[0fr] pt-0 opacity-0',
      )}
      data-state={isOpen ? 'open' : 'closed'}
      id={contentId}
      role="region"
      {...props}
    >
      <div
        aria-labelledby={triggerId}
        className={cn('min-h-0 overflow-hidden', className)}
      >
        {children}
      </div>
    </div>
  );
}
