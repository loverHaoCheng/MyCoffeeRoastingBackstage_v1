import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { Button, Tooltip } from 'antd';

import styles from '../RoastAssistantPage.module.css';

interface ContextActionsProps {
  onOpenHistory: () => void;
  onStartNew: () => void;
}

export function ContextActions({ onOpenHistory, onStartNew }: ContextActionsProps) {
  return (
    <div className={styles.contextActions}>
      <Tooltip title="新建对话">
        <Button
          aria-label="新建对话"
          className={styles.contextButton}
          icon={<PlusOutlined />}
          onClick={onStartNew}
          type="text"
        />
      </Tooltip>
      <Tooltip title="历史对话">
        <Button
          aria-label="历史对话"
          className={styles.contextButton}
          icon={<HistoryOutlined />}
          onClick={onOpenHistory}
          type="text"
        />
      </Tooltip>
    </div>
  );
}
