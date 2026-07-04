import { DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';

import styles from './UnifiedDataCard.module.css';

export interface UnifiedDataCardMetaItem {
  key: string;
  label: string;
  value: ReactNode;
  multiline?: boolean;
}

export interface UnifiedDataCardAction {
  key: string;
  label: string;
  icon?: ReactNode;
  ariaLabel?: string;
  onClick: () => void;
}

interface UnifiedDataCardProps {
  title: string;
  description?: ReactNode;
  headerAside?: ReactNode;
  metaItems: UnifiedDataCardMetaItem[];
  actions: UnifiedDataCardAction[];
  bodyFooter?: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function UnifiedDataCard({
  title,
  description,
  headerAside,
  metaItems,
  actions,
  bodyFooter,
  onDelete,
  deleteLabel,
}: UnifiedDataCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>

        {(headerAside || onDelete) ? (
          <div className={styles.headerAside}>
            {headerAside}
            {onDelete ? (
              <Button
                aria-label={deleteLabel ?? `删除 ${title}`}
                className={styles.deleteBtn}
                icon={<DeleteOutlined />}
                shape="circle"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.body}>
        {description ? <p className={styles.description}>{description}</p> : null}

        {metaItems.length > 0 ? (
          <dl className={styles.metaGrid}>
            {metaItems.map((item) => (
              <div className={styles.metaCell} key={item.key}>
                <dt>{item.label}</dt>
                <dd className={item.multiline ? styles.metaValueMultiline : styles.metaValue}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {bodyFooter ? <div className={styles.bodyFooter}>{bodyFooter}</div> : null}
      </div>

      <div className={styles.footer}>
        {actions.map((action) => (
          <Button
            key={action.key}
            aria-label={action.ariaLabel ?? action.label}
            className={styles.actionBtn}
            icon={action.icon}
            size="small"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  );
}
