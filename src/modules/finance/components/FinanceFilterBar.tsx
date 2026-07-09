import { useLayoutEffect, useRef, useState } from 'react';

import type { FinanceRangePreset } from '@/modules/finance/types';

import styles from './FinanceFilterBar.module.css';

interface FinanceFilterBarProps {
  onPresetChange: (preset: FinanceRangePreset) => void;
  preset: FinanceRangePreset;
}

const presetOptions: { label: string; value: FinanceRangePreset }[] = [
  { label: '全部', value: 'all' },
  { label: '本年', value: 'year' },
  { label: '本月', value: 'month' },
  { label: '本周', value: 'week' },
  { label: '今日', value: 'today' },
];

export function FinanceFilterBar({
  onPresetChange,
  preset,
}: FinanceFilterBarProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<FinanceRangePreset, HTMLButtonElement | null>>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; x: number } | null>(null);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeButton = buttonRefs.current[preset];

      if (!activeButton) {
        setIndicatorStyle(null);
        return;
      }

      setIndicatorStyle({
        width: activeButton.offsetWidth,
        x: activeButton.offsetLeft,
      });
    };

    updateIndicator();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateIndicator();
          });

    const groupElement = groupRef.current;
    const activeButton = buttonRefs.current[preset];

    if (groupElement && resizeObserver) {
      resizeObserver.observe(groupElement);
    }

    if (activeButton && resizeObserver) {
      resizeObserver.observe(activeButton);
    }

    window.addEventListener('resize', updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [preset]);

  return (
    <section aria-label="财务时间筛选" className={styles.bar}>
      <div className={styles.presetGroup} ref={groupRef}>
        {presetOptions.map((option) => (
          <button
            aria-pressed={option.value === preset}
            className={styles.presetButton}
            data-active={String(option.value === preset)}
            key={option.value}
            onClick={() => {
              onPresetChange(option.value);
            }}
            ref={(element) => {
              buttonRefs.current[option.value] = element;
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
        {indicatorStyle ? (
          <span
            aria-hidden="true"
            className={styles.activeIndicator}
            style={{
              transform: `translateX(${String(indicatorStyle.x)}px)`,
              width: `${String(indicatorStyle.width)}px`,
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
