import {
  Children,
  type CSSProperties,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './ResponsiveMasonry.module.css';

interface MasonryMeasurements {
  containerWidth: number;
  itemHeights: number[];
}

interface MasonryItemPosition {
  left: number;
  top: number;
}

interface MasonryContainerStyle extends CSSProperties {
  '--masonry-gap': string;
  '--masonry-min-column-width': string;
}

interface ResponsiveMasonryProps {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  gap?: number;
  minColumnWidth?: number;
}

const DEFAULT_GAP = 12;
const DEFAULT_MIN_COLUMN_WIDTH = 320;

const joinClassNames = (...classNames: (false | null | undefined | string)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

const hasSameMeasurements = (left: MasonryMeasurements, right: MasonryMeasurements): boolean => {
  if (left.containerWidth !== right.containerWidth || left.itemHeights.length !== right.itemHeights.length) {
    return false;
  }

  return left.itemHeights.every((height, index) => height === right.itemHeights[index]);
};

export function ResponsiveMasonry({
  ariaLabel,
  children,
  className,
  gap = DEFAULT_GAP,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
}: ResponsiveMasonryProps) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const containerRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [measurements, setMeasurements] = useState<MasonryMeasurements>({
    containerWidth: 0,
    itemHeights: [],
  });
  const [isInitialLayoutComplete, setIsInitialLayoutComplete] = useState(false);

  const updateMeasurements = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const nextMeasurements: MasonryMeasurements = {
      containerWidth: Math.round(container.getBoundingClientRect().width),
      itemHeights: items.map((_, index) => Math.round(itemRefs.current[index]?.getBoundingClientRect().height ?? 0)),
    };

    setMeasurements((current) => {
      return hasSameMeasurements(current, nextMeasurements) ? current : nextMeasurements;
    });
  }, [items]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    itemRefs.current = itemRefs.current.slice(0, items.length);
    updateMeasurements();
    window.addEventListener('resize', updateMeasurements);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateMeasurements);
      };
    }

    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(container);
    itemRefs.current.forEach((item) => {
      if (item) {
        resizeObserver.observe(item);
      }
    });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateMeasurements);
    };
  }, [items.length, updateMeasurements]);

  const isReady =
    measurements.containerWidth > 0 &&
    measurements.itemHeights.length === items.length &&
    measurements.itemHeights.every((height) => height > 0);

  useEffect(() => {
    if (!isReady) {
      setIsInitialLayoutComplete(false);
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setIsInitialLayoutComplete(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isReady]);

  const columnCount = isReady
    ? Math.max(1, Math.floor((measurements.containerWidth + gap) / (minColumnWidth + gap)))
    : 1;
  const columnWidth = isReady
    ? (measurements.containerWidth - gap * (columnCount - 1)) / columnCount
    : 0;
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const positions: MasonryItemPosition[] = [];

  if (isReady) {
    measurements.itemHeights.forEach((itemHeight) => {
      let targetColumn = 0;

      for (let index = 1; index < columnHeights.length; index += 1) {
        if ((columnHeights[index] ?? 0) < (columnHeights[targetColumn] ?? 0)) {
          targetColumn = index;
        }
      }

      const top = columnHeights[targetColumn] ?? 0;

      positions.push({
        left: targetColumn * (columnWidth + gap),
        top,
      });
      columnHeights[targetColumn] = top + itemHeight + gap;
    });
  }

  const contentHeight = isReady ? Math.max(0, ...columnHeights.map((height) => height - gap)) : undefined;
  const containerStyle: MasonryContainerStyle = {
    '--masonry-gap': `${String(gap)}px`,
    '--masonry-min-column-width': `${String(minColumnWidth)}px`,
    ...(contentHeight == null ? {} : { height: `${String(contentHeight)}px` }),
  };

  return (
    <section
      aria-label={ariaLabel}
      className={joinClassNames(styles.masonry, className)}
      data-animated={isInitialLayoutComplete}
      data-ready={isReady}
      ref={containerRef}
      style={containerStyle}
    >
      {items.map((item, index) => {
        const position = positions[index];
        const itemKey = isValidElement(item) && item.key != null ? item.key : `masonry-item-${String(index)}`;
        const itemStyle: CSSProperties = position
          ? {
              transform: `translate3d(${String(position.left)}px, ${String(position.top)}px, 0)`,
              width: `${String(columnWidth)}px`,
            }
          : {};

        return (
          <div
            className={styles.item}
            data-masonry-item="true"
            key={itemKey}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            style={itemStyle}
          >
            {item}
          </div>
        );
      })}
    </section>
  );
}
