import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import AntdSelect from 'antd/es/select';

import { Button } from '@/shared/components/ui/button';

import styles from './MultiFilterSortBar.module.css';

export interface MultiFilterOption {
  label: string;
  value: string;
}

export interface MultiFilterDefinition {
  key: string;
  label: string;
  options: MultiFilterOption[];
}

interface MultiFilterSortBarProps {
  expanded: boolean;
  filters: MultiFilterDefinition[];
  onChange: (key: string, values: string[]) => void;
  onClear: () => void;
  onSortChange: (value: string) => void;
  sortOptions: MultiFilterOption[];
  sortValue: string;
  values: Record<string, string[]>;
}

interface FilterSortToggleProps {
  activeFilterCount: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function FilterSortToggle({ activeFilterCount, expanded, onExpandedChange }: FilterSortToggleProps) {
  const filterCountText = activeFilterCount > 0 ? `，已选 ${String(activeFilterCount)} 个筛选条件` : '';
  const actionLabel = `${expanded ? '收起' : '展开'}筛选与排序${filterCountText}`;

  return (
    <Button
      aria-expanded={expanded}
      aria-label={actionLabel}
      className={styles.toggleButton}
      onClick={() => {
        onExpandedChange(!expanded);
      }}
      size="icon"
      title={actionLabel}
      type="button"
      variant="secondary"
    >
      <SlidersHorizontal aria-hidden="true" size={16} />
      {activeFilterCount > 0 ? <span aria-hidden="true" className={styles.count}>{String(activeFilterCount)}</span> : null}
      <ChevronDown aria-hidden="true" className={styles.toggleChevron} size={14} />
    </Button>
  );
}

export function MultiFilterSortBar({
  expanded,
  filters,
  onChange,
  onClear,
  onSortChange,
  sortOptions,
  sortValue,
  values,
}: MultiFilterSortBarProps) {
  const hasActiveFilters = filters.some((filter) => (values[filter.key]?.length ?? 0) > 0);

  return (
    <section aria-label="筛选与排序" className={styles.toolbar} data-expanded={expanded}>
      {expanded ? (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>筛选</h2>
          <div className={styles.filterGrid}>
            {filters.map((filter) => (
              <label className={styles.field} data-filter-key={filter.key} key={filter.key}>
                <span className={styles.label}>{filter.label}</span>
                <AntdSelect
                  allowClear
                  aria-label={`筛选${filter.label}`}
                  maxTagCount="responsive"
                  mode="multiple"
                  onChange={(nextValues: string[]) => {
                    onChange(filter.key, nextValues);
                  }}
                  options={filter.options}
                  placeholder={`选择${filter.label}`}
                  showSearch={false}
                  value={values[filter.key] ?? []}
                />
              </label>
            ))}
          </div>

          <section className={styles.sortSection}>
            <h2 className={styles.sectionTitle}>排序</h2>
            <AntdSelect
              aria-label="排序"
              className={styles.sortSelect}
              onChange={onSortChange}
              options={sortOptions}
              showSearch={false}
              value={sortValue}
            />
          </section>

          <Button
            aria-label="清除筛选"
            className={styles.clearButton}
            disabled={!hasActiveFilters}
            onClick={onClear}
            size="default"
            title="清除筛选"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={16} />
            清除全部筛选
          </Button>
        </div>
      ) : null}
    </section>
  );
}
