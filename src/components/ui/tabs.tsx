import { createContext, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

interface TabsContextValue {
  onValueChange: (value: string) => void;
  value: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  children: ReactNode;
  className?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
}

export function Tabs({ children, className, defaultValue = '', onValueChange, value }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const changeValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  return <TabsContext.Provider value={{ onValueChange: changeValue, value: selectedValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('inline-flex min-h-11 items-center gap-1 rounded-lg bg-[var(--app-bg-soft)] p-1', className)} role="tablist">{children}</div>;
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ children, className, value, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const isActive = context?.value === value;

  return <button {...props} aria-selected={isActive} className={cn('min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--app-text-secondary)] transition-colors', isActive && 'bg-[var(--app-bg-elevated)] text-[var(--app-text)] shadow-sm', className)} onClick={() => { context?.onValueChange(value); }} role="tab" type="button">{children}</button>;
}
