import { ChevronDown, CalendarDays } from 'lucide-react';
import Button from 'antd/es/button';
import DatePicker from 'antd/es/date-picker';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { Select } from '@/components/ui/select';
import { cn } from '@/shared/utils/cn';

import { AppDrawer } from './AppDrawer';
import { DrawerActionBar } from './DrawerActionBar';
import styles from './AdaptiveDateTimeField.module.css';
import {
  createAdaptiveDateTimeYearOptions,
  createDefaultAdaptiveDateTimeParts,
  formatAdaptiveDateTimeDisplayValue,
  normalizeAdaptiveDateTimeParts,
  parseAdaptiveDateTimeValue,
  serializeAdaptiveDateTimeValue,
  type AdaptiveDateTimeMode,
  type AdaptiveDateTimeParts,
} from './adaptiveDateTimeField.utils';

const resolveCoarsePointerMatch = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(pointer: coarse)').matches;
};

const createPickerValue = (
  parts: AdaptiveDateTimeParts | null,
  mode: AdaptiveDateTimeMode,
) => {
  if (!parts) {
    return null;
  }

  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    mode === 'datetime' ? parts.hour : 12,
    mode === 'datetime' ? parts.minute : 0,
    0,
    0,
  );

  return dayjs(date);
};

interface AdaptiveDateTimeFieldProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  mode: AdaptiveDateTimeMode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function AdaptiveDateTimeField({
  ariaLabel,
  className,
  disabled = false,
  mode,
  onChange,
  placeholder,
  value,
}: AdaptiveDateTimeFieldProps) {
  const [isCoarsePointer, setIsCoarsePointer] = useState(resolveCoarsePointerMatch);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const parsedValue = useMemo(() => parseAdaptiveDateTimeValue(value, mode), [mode, value]);
  const [draftValue, setDraftValue] = useState<AdaptiveDateTimeParts>(
    () => parsedValue ?? normalizeAdaptiveDateTimeParts(createDefaultAdaptiveDateTimeParts(), mode),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const sync = () => {
      setIsCoarsePointer(mediaQuery.matches);
    };

    sync();
    mediaQuery.addEventListener('change', sync);

    return () => {
      mediaQuery.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    setDraftValue(parsedValue ?? normalizeAdaptiveDateTimeParts(createDefaultAdaptiveDateTimeParts(), mode));
  }, [drawerOpen, mode, parsedValue]);

  const yearOptions = useMemo(() => {
    return createAdaptiveDateTimeYearOptions(draftValue.year).map((year) => ({
      label: `${String(year)}年`,
      value: year,
    }));
  }, [draftValue.year]);
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => ({
      label: `${String(index + 1)}月`,
      value: index + 1,
    }));
  }, []);
  const dayOptions = useMemo(() => {
    const daysInMonth = new Date(draftValue.year, draftValue.month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => ({
      label: `${String(index + 1)}日`,
      value: index + 1,
    }));
  }, [draftValue.month, draftValue.year]);
  const hourOptions = useMemo(() => {
    return Array.from({ length: 24 }, (_, index) => ({
      label: `${String(index).padStart(2, '0')}时`,
      value: index,
    }));
  }, []);
  const minuteOptions = useMemo(() => {
    return Array.from({ length: 60 }, (_, index) => ({
      label: `${String(index).padStart(2, '0')}分`,
      value: index,
    }));
  }, []);

  const displayValue = parsedValue ? formatAdaptiveDateTimeDisplayValue(parsedValue, mode) : placeholder;
  const previewValue = formatAdaptiveDateTimeDisplayValue(draftValue, mode);

  const updateDraftValue = (patch: Partial<AdaptiveDateTimeParts>) => {
    setDraftValue((current) => normalizeAdaptiveDateTimeParts({ ...current, ...patch }, mode));
  };

  if (!isCoarsePointer) {
    return (
      <DatePicker
        allowClear={false}
        aria-label={ariaLabel}
        className={className}
        format={mode === 'datetime' ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'}
        inputReadOnly
        placeholder={placeholder}
        showTime={mode === 'datetime' ? { format: 'HH:mm' } : false}
        style={{ width: '100%' }}
        value={createPickerValue(parsedValue, mode)}
        onChange={(nextValue) => {
          if (!nextValue) {
            onChange('');
            return;
          }

          onChange(
            mode === 'datetime'
              ? nextValue.second(0).millisecond(0).toISOString()
              : nextValue.format('YYYY-MM-DD'),
          );
        }}
      />
    );
  }

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={cn(styles.trigger, disabled && styles.triggerDisabled, className)}
        disabled={disabled}
        onClick={() => {
          setDrawerOpen(true);
        }}
        type="button"
      >
        <CalendarDays aria-hidden="true" className={styles.triggerIcon} size={16} />
        <span className={cn(styles.triggerValue, !parsedValue && styles.triggerPlaceholder)}>
          {displayValue}
        </span>
        <ChevronDown aria-hidden="true" className={styles.triggerChevron} size={16} />
      </button>

      <AppDrawer
        destroyOnHidden
        onClose={() => {
          setDrawerOpen(false);
        }}
        open={drawerOpen}
        placement="bottom"
        title={ariaLabel}
      >
        <div className={styles.drawerBody}>
          <header className={styles.drawerHeader}>
            <h3>{ariaLabel}</h3>
            <p>{mode === 'datetime' ? '在底部抽屉中选择日期与时间' : '在底部抽屉中选择日期'}</p>
          </header>

          <section className={styles.preview}>
            <span className={styles.previewLabel}>当前选择</span>
            <strong className={styles.previewValue}>{previewValue}</strong>
          </section>

          <div className={styles.selectorGrid} data-mode={mode}>
            <label className={styles.selectorField}>
              <span>年份</span>
              <Select
                aria-label={`${ariaLabel}年份`}
                options={yearOptions}
                showSearch={false}
                value={draftValue.year}
                onChange={(nextValue) => {
                  if (nextValue == null) {
                    return;
                  }

                  updateDraftValue({ year: Number(nextValue) });
                }}
              />
            </label>

            <label className={styles.selectorField}>
              <span>月份</span>
              <Select
                aria-label={`${ariaLabel}月份`}
                options={monthOptions}
                showSearch={false}
                value={draftValue.month}
                onChange={(nextValue) => {
                  if (nextValue == null) {
                    return;
                  }

                  updateDraftValue({ month: Number(nextValue) });
                }}
              />
            </label>

            <label className={styles.selectorField}>
              <span>日期</span>
              <Select
                aria-label={`${ariaLabel}日期`}
                options={dayOptions}
                showSearch={false}
                value={draftValue.day}
                onChange={(nextValue) => {
                  if (nextValue == null) {
                    return;
                  }

                  updateDraftValue({ day: Number(nextValue) });
                }}
              />
            </label>

            {mode === 'datetime' ? (
              <label className={styles.selectorField}>
                <span>小时</span>
                <Select
                  aria-label={`${ariaLabel}小时`}
                  options={hourOptions}
                  showSearch={false}
                  value={draftValue.hour}
                  onChange={(nextValue) => {
                    if (nextValue == null) {
                      return;
                    }

                    updateDraftValue({ hour: Number(nextValue) });
                  }}
                />
              </label>
            ) : null}

            {mode === 'datetime' ? (
              <label className={styles.selectorField}>
                <span>分钟</span>
                <Select
                  aria-label={`${ariaLabel}分钟`}
                  options={minuteOptions}
                  showSearch={false}
                  value={draftValue.minute}
                  onChange={(nextValue) => {
                    if (nextValue == null) {
                      return;
                    }

                    updateDraftValue({ minute: Number(nextValue) });
                  }}
                />
              </label>
            ) : null}
          </div>

          <DrawerActionBar compact>
            <Button
              block
              onClick={() => {
                setDrawerOpen(false);
              }}
              type="default"
            >
              取消
            </Button>
            <Button
              block
              onClick={() => {
                onChange(serializeAdaptiveDateTimeValue(draftValue, mode));
                setDrawerOpen(false);
              }}
              type="primary"
            >
              确定
            </Button>
          </DrawerActionBar>
        </div>
      </AppDrawer>
    </>
  );
}
