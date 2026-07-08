import { Tag } from 'antd';

import { normalizeFlavorTags } from '@/modules/bean/utils/flavorTags';

import styles from './FlavorTagChips.module.css';

interface FlavorTagChipsProps {
  align?: 'end' | 'start';
  emptyText?: string;
  maxVisible?: number;
  tags?: string[];
}

export function FlavorTagChips({
  align = 'end',
  emptyText = '待补充',
  maxVisible,
  tags,
}: FlavorTagChipsProps) {
  const normalizedTags = normalizeFlavorTags(tags);

  if (normalizedTags.length === 0) {
    return <>{emptyText}</>;
  }

  const visibleTags = maxVisible != null ? normalizedTags.slice(0, maxVisible) : normalizedTags;
  const hiddenTagCount = normalizedTags.length - visibleTags.length;

  return (
    <span className={styles.list} data-align={align}>
      {visibleTags.map((tag) => (
        <span className={styles.tag} key={tag}>
          <Tag bordered={false}>{tag}</Tag>
        </span>
      ))}
      {hiddenTagCount > 0 ? (
        <span className={styles.tag}>
          <Tag bordered={false}>+{String(hiddenTagCount)}</Tag>
        </span>
      ) : null}
    </span>
  );
}
