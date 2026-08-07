import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

interface PaginationProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

interface PaginationLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

export function Pagination({ children, className, ...props }: PaginationProps) {
  return <nav aria-label="分页" className={cn('mx-auto flex w-full justify-center', className)} {...props}>{children}</nav>;
}

export function PaginationContent({ children, className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('flex items-center gap-1', className)} {...props}>{children}</ul>;
}

export function PaginationItem({ children, className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={className} {...props}>{children}</li>;
}

export function PaginationLink({ className, isActive = false, style, ...props }: PaginationLinkProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors',
        isActive
          ? 'border-[var(--app-text)] bg-[var(--app-text)] text-white'
          : 'border-[var(--app-border)] bg-[var(--app-bg-soft)] text-[var(--app-text)] hover:bg-[var(--app-hover-surface)]',
        className,
      )}
      style={{
        ...(isActive ? { color: '#ffffff' } : {}),
        ...style,
      }}
      type="button"
      {...props}
    />
  );
}

export function PaginationPrevious({ children = '上一页', ...props }: PaginationLinkProps) {
  return <PaginationLink {...props}><ChevronLeft size={16} />{children}</PaginationLink>;
}

export function PaginationNext({ children = '下一页', ...props }: PaginationLinkProps) {
  return <PaginationLink {...props}>{children}<ChevronRight size={16} /></PaginationLink>;
}

export function PaginationEllipsis() {
  return <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center text-[var(--app-text-secondary)]"><Ellipsis size={16} /></span>;
}
