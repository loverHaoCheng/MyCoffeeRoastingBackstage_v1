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
  const [expanded, setExpanded] = useState(false);
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

  useEffect(() => {
    if (!isExpandable && expanded) {
      setExpanded(false);
    }
  }, [expanded, isExpandable]);

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

            {isExpandable ? (
              <div className={styles.expandRegion} data-expanded={expanded}>
                <div className={styles.expandRegionInner}>{extraItems.map(renderMetaRow)}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isExpandable ? (
        <div className={styles.footer}>
          <Button
            aria-expanded={expanded}
            className={styles.expandButton}
            icon={
              <span aria-hidden="true" className={styles.expandIcon}>
                <DownOutlined />
              </span>
            }
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((current) => !current);
            }}
            type="text"
          >
            {expanded ? '收起' : '展开全部'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
