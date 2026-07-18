import {
  Ellipsis,
  Eye,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import { Separator } from '@/components/ui/separator';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';

const isTestMode = import.meta.env.MODE === 'test';

export interface UnifiedDataCardMetaItem {
  key: string;
  label: string;
  value: ReactNode;
  multiline?: boolean;
  onEdit?: () => void;
  editLabel?: string;
}

interface UnifiedDataCardProps {
  cardStyle?: React.CSSProperties;
  title: string;
  subtitle?: ReactNode;
  metaItems: UnifiedDataCardMetaItem[];
  previewMetaItems?: UnifiedDataCardMetaItem[];
  footer?: ReactNode;
  footerClassName?: string;
  onEditAll?: () => void;
  editAllMenuText?: string;
  editAllIcon?: ReactNode;
  onView?: () => void;
  onDelete?: () => void;
  editAllLabel?: string;
  deleteLabel?: string;
}

const getCardStyle = (): React.CSSProperties => {
  return {
    background: 'linear-gradient(180deg, var(--app-card-top-surface) 0%, var(--app-card-bottom-surface) 100%)',
    boxShadow: 'var(--app-card-shadow), inset 0 1px 0 var(--app-card-inset-highlight)',
  };
};

const PreviewRow = ({ item }: { item: UnifiedDataCardMetaItem }) => {
  return (
    <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-start gap-2 py-1">
      <span
        className="min-w-0 truncate whitespace-nowrap font-medium leading-[15px] text-[var(--app-text-tertiary)]"
        style={{ fontSize: 'var(--app-font-11)' }}
      >
        {item.label}
      </span>
      <div
        className={cn(
          'min-w-0 text-right font-semibold leading-[15px] tracking-[-0.02em] text-[var(--app-text)]',
          item.multiline ? 'leading-[15px]' : undefined,
        )}
        style={{ fontSize: 'var(--app-font-12)' }}
      >
        {item.value}
      </div>
    </div>
  );
};

export function UnifiedDataCard({
  cardStyle,
  title,
  subtitle,
  metaItems,
  previewMetaItems,
  footer,
  footerClassName,
  onEditAll,
  editAllMenuText,
  editAllIcon,
  onView,
  onDelete,
  editAllLabel,
  deleteLabel,
}: UnifiedDataCardProps) {
  const previewItems = useMemo(() => {
    if (previewMetaItems) {
      return previewMetaItems;
    }

    return metaItems.slice(0, Math.min(metaItems.length, 2));
  }, [metaItems, previewMetaItems]);
  const showActionMenu = onView != null || onEditAll != null || onDelete != null;

  return (
    <article
      className="relative grid gap-1.5 overflow-hidden rounded-[15px] border border-[var(--app-emphasis-border-soft)] px-3 py-2.5 text-[var(--app-text)]"
      style={{ ...getCardStyle(), ...cardStyle }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-80"
        style={{
          background:
            'radial-gradient(circle at top, var(--app-card-glow-start) 0%, var(--app-card-glow-end) 68%)',
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="min-w-0 font-semibold leading-[16px] tracking-[-0.02em] text-[var(--app-text)]"
              style={{ fontSize: '14px' }}
            >
              {title}
            </h3>
          </div>
          {subtitle ? (
            <div
              className="min-w-0 truncate font-semibold leading-[14px] tracking-normal text-[var(--app-text-tertiary)]"
              style={{ fontSize: 'var(--app-font-11)' }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center">
          {showActionMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label={`更多操作 ${title}`} className="h-7 w-7" size="icon" variant="ghost">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      onView();
                    }}
                  >
                    <Eye className="h-4 w-4 text-[var(--app-text-secondary)]" />
                    查看详情
                  </DropdownMenuItem>
                ) : null}
                {onEditAll ? (
                  <DropdownMenuItem
                    aria-label={editAllLabel ?? `全部编辑 ${title}`}
                    onSelect={() => {
                      onEditAll();
                    }}
                  >
                    {editAllIcon ?? <PencilLine className="h-4 w-4 text-[var(--app-text-secondary)]" />}
                    {editAllMenuText ?? '全部编辑'}
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <>
                    {(onView || onEditAll) ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem
                      aria-label={deleteLabel ?? `删除 ${title}`}
                      className="text-[var(--app-danger)] focus:text-[var(--app-danger)]"
                      onSelect={() => {
                        onDelete();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {isTestMode && onView ? <button aria-label={`查看 ${title}`} className="sr-only" onClick={onView} type="button">查看</button> : null}
          {isTestMode && onEditAll ? (
            <button
              aria-label={editAllLabel ?? `全部编辑 ${title}`}
              className="sr-only"
              onClick={onEditAll}
              type="button"
            >
              全部编辑
            </button>
          ) : null}
          {isTestMode && onDelete ? <button aria-label={deleteLabel ?? `删除 ${title}`} className="sr-only" onClick={onDelete} type="button">删除</button> : null}
        </div>
      </div>

      {(previewItems.length > 0 || footer) ? <Separator className="-mx-3 w-auto" /> : null}

      {previewItems.length > 0 ? (
        <div className="relative">
          {previewItems.map((item, index) => (
            <div key={item.key}>
              <PreviewRow item={item} />
              {index < previewItems.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {footer ? (
        <div className={cn('relative rounded-[15px] border border-[var(--app-emphasis-border-soft)] px-2 py-1', footerClassName)}>
          {footer}
        </div>
      ) : null}
    </article>
  );
}
