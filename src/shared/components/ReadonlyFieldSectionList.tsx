import type { ReactNode } from 'react';

import { Separator } from '@/components/ui/separator';
import { cn } from '@/shared/utils/cn';

export interface ReadonlyFieldItem {
  key: string;
  label: string;
  multiline?: boolean;
  value: ReactNode;
}

export interface ReadonlyFieldSection {
  key: string;
  items: ReadonlyFieldItem[];
  title?: string;
}

interface ReadonlyFieldSectionListProps {
  className?: string;
  sections: ReadonlyFieldSection[];
}

const getDetailSurfaceStyle = (): React.CSSProperties => {
  return {
    background: 'color-mix(in srgb, var(--app-bg-elevated) 92%, transparent)',
    boxShadow: 'inset 0 1px 0 var(--app-card-inset-highlight)',
  };
};

export function ReadonlyFieldSectionList({
  className,
  sections,
}: ReadonlyFieldSectionListProps) {
  const visibleSections = sections.filter((section) => section.items.length > 0);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid gap-3', className)}>
      {visibleSections.map((section) => (
        <section className="grid gap-2" key={section.key}>
          {section.title ? (
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">
              {section.title}
            </h3>
          ) : null}

          <div
            className="overflow-hidden rounded-[18px] border border-[var(--app-emphasis-border-soft)]"
            style={getDetailSurfaceStyle()}
          >
            {section.items.map((item, index) => (
              <div key={item.key}>
                {index > 0 ? <Separator /> : null}
                <div
                  className={cn(
                    'grid min-h-[38px] grid-cols-[minmax(72px,96px)_minmax(0,1fr)] items-center gap-3 px-3 py-2',
                  )}
                >
                  <span className="truncate whitespace-nowrap text-[11px] font-semibold text-[var(--app-text-secondary)]">
                    {item.label}
                  </span>
                  <div className="flex min-w-0 items-start justify-end text-right">
                    <span
                      className={cn(
                        'min-w-0 text-[12px] font-semibold text-[var(--app-text)]',
                        item.multiline
                          ? 'whitespace-normal break-words leading-[18px]'
                          : 'truncate',
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
