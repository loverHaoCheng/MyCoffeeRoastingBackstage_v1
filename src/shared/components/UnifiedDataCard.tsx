import { DeleteOutlined, DownOutlined, EyeOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import styles from './UnifiedDataCard.module.css';

export interface UnifiedDataCardMetaItem {
  key: string;
  label: string;
  value: ReactNode;
  multiline?: boolean;
  onEdit?: () => void;
  editLabel?: string;
}

interface UnifiedDataCardProps {
  title: string;
  subtitle?: ReactNode;
  metaItems: UnifiedDataCardMetaItem[];
  previewMetaItems?: UnifiedDataCardMetaItem[];
  onView?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}

const joinClassNames = (...classNames: (false | null | undefined | string)[]): string => {
  return classNames.filter(Boolean).join(' ');
};

export function UnifiedDataCard({
  title,
  subtitle,
  metaItems,
  previewMetaItems,
  onView,
  onDelete,
  deleteLabel,
}: UnifiedDataCardProps) {
  const [expandedLevel, setExpandedLevel] = useState<0 | 1 | 2>(0);
  const previewItems = useMemo(() => {
    if (previewMetaItems) {
      return previewMetaItems;
    }

    return metaItems.slice(0, Math.min(metaItems.length, 2));
  }, [metaItems, previewMetaItems]);
  const previewKeySet = useMemo(() => new Set(previewItems.map((item) => item.key)), [previewItems]);
  const extraItems = useMemo(
    () => metaItems.filter((item) => !previewKeySet.has(item.key)),
    [metaItems, previewKeySet],
  );
  const isExpandable = extraItems.length > 0;
  const firstExpansionLimit = Math.max(0, 8 - previewItems.length);
  const firstExpansionItems = useMemo(() => {
    return extraItems.slice(0, firstExpansionLimit);
  }, [extraItems, firstExpansionLimit]);
  const secondExpansionItems = useMemo(() => {
    return extraItems.slice(firstExpansionLimit);
  }, [extraItems, firstExpansionLimit]);
  const hasSecondExpansion = secondExpansionItems.length > 0;

  useEffect(() => {
    if (!isExpandable && expandedLevel !== 0) {
      setExpandedLevel(0);
    }
  }, [expandedLevel, isExpandable]);

  const renderMetaRow = (item: UnifiedDataCardMetaItem) => {
    const canEdit = typeof item.onEdit === 'function';
    const handleEdit = () => {
      item.onEdit?.();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (!canEdit) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleEdit();
      }
    };

    return (
      <div
        aria-label={item.editLabel ?? `修改 ${item.label}`}
        className={joinClassNames(styles.row, canEdit ? styles.rowClickable : undefined)}
        key={item.key}
        onClick={canEdit ? handleEdit : undefined}
        onKeyDown={canEdit ? handleKeyDown : undefined}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
      >
        <span className={styles.rowLabel}>{item.label}</span>
        <div className={styles.rowValueArea}>
          <span className={joinClassNames(styles.rowValue, item.multiline ? styles.rowValueMultiline : undefined)}>
            {item.value}
          </span>
          {canEdit ? (
            <span aria-hidden="true" className={styles.rowEditIcon}>
              <RightOutlined />
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </div>

        <div className={styles.headerActions}>
          {onView ? (
            <Button
              aria-label={`查看 ${title}`}
              className={joinClassNames(styles.headerActionBtn, styles.viewBtn)}
              icon={<EyeOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                onView();
              }}
              shape="circle"
              size="small"
              type="text"
            />
          ) : null}

          {onDelete ? (
            <Button
              aria-label={deleteLabel ?? `删除 ${title}`}
              className={joinClassNames(styles.headerActionBtn, styles.deleteBtn)}
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              shape="circle"
              size="small"
              type="text"
            />
          ) : null}
        </div>
      </div>

      <div className={styles.body}>
        {previewItems.length > 0 || isExpandable ? (
          <div className={styles.rowList}>
            {previewItems.map(renderMetaRow)}

            {firstExpansionItems.length > 0 ? (
              <div className={styles.expandRegion} data-expanded={expandedLevel >= 1}>
                <div className={styles.expandRegionInner}>{firstExpansionItems.map(renderMetaRow)}</div>
              </div>
            ) : null}

            {secondExpansionItems.length > 0 ? (
              <div className={styles.expandRegion} data-expanded={expandedLevel >= 2}>
                <div className={styles.expandRegionInner}>{secondExpansionItems.map(renderMetaRow)}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isExpandable ? (
        <div className={styles.footer}>
          <Button
            aria-expanded={expandedLevel > 0}
            className={styles.expandButton}
            data-expanded-level={String(expandedLevel)}
            icon={
              <span aria-hidden="true" className={styles.expandIcon}>
                <DownOutlined />
              </span>
            }
            onClick={(event) => {
              event.stopPropagation();
              setExpandedLevel((current) => {
                if (current === 0) {
                  return 1;
                }

                if (current === 1 && hasSecondExpansion) {
                  return 2;
                }

                return 0;
              });
            }}
            type="text"
          >
            {expandedLevel === 0 ? '展开' : expandedLevel === 1 && hasSecondExpansion ? '展开全部' : '收起'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
