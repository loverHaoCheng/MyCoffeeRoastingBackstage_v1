import { Segmented } from 'antd';
import { Select } from '@/shared/components/ui/select';
import type { RoastConversationMode } from '../../services/roastConversation.service';
import type { Bean } from '@/types/domain';
import type { RoastBatchRecord } from '../../types/roastBatch';

import styles from '../RoastAssistantPage.module.css';

interface WorkspaceBarProps {
  activeBeanId?: string;
  disabled: boolean;
  isDiscoveringHistory: boolean;
  isGeneralMode: boolean;
  isNewConversation: boolean;
  mode: RoastConversationMode;
  onSelectBean: (value: string | undefined) => void;
  onSelectMode: (mode: RoastConversationMode) => void;
  onSelectRoastBatch: (value: string | undefined) => void;
  roastBatchId?: string;
  selectableBatches: RoastBatchRecord[];
  selectableBeans: Bean[];
  usageDisplay: string;
  usageLabel: string;
}

export function WorkspaceBar({
  activeBeanId,
  disabled,
  isDiscoveringHistory,
  isGeneralMode,
  isNewConversation,
  mode,
  onSelectBean,
  onSelectMode,
  onSelectRoastBatch,
  roastBatchId,
  selectableBatches,
  selectableBeans,
  usageDisplay,
  usageLabel,
}: WorkspaceBarProps) {
  const isBeanPlanMode = mode === 'bean_plan_recommendation';
  const selectDisabled = disabled || (isNewConversation && isDiscoveringHistory);
  const selectPlaceholder = isNewConversation && isDiscoveringHistory ? '正在读取已有对话...' : undefined;

  return (
    <div className={styles.workspaceBar}>
      {!isGeneralMode ? (
        <>
          <Segmented
            aria-label="选择对话模式"
            block
            className={styles.workspaceMode}
            disabled={disabled}
            onChange={(value) => {
              onSelectMode(value as RoastConversationMode);
            }}
            options={[
              {
                label: (
                  <>
                    <span className={styles.modeLabelFull}>烘焙计划分析</span>
                    <span className={styles.modeLabelShort}>复盘</span>
                  </>
                ),
                value: 'batch_analysis',
              },
              {
                label: (
                  <>
                    <span className={styles.modeLabelFull}>生豆烘焙计划推荐</span>
                    <span className={styles.modeLabelShort}>计划</span>
                  </>
                ),
                value: 'bean_plan_recommendation',
              },
            ]}
            value={mode}
          />
          {isBeanPlanMode ? (
            <Select
              allowClear
              aria-label="规划生豆"
              className={styles.workspaceSelect}
              disabled={selectDisabled}
              onChange={onSelectBean}
              options={selectableBeans.map((bean) => ({ label: bean.name, value: String(bean.id) }))}
              placeholder={selectPlaceholder ?? '选择生豆'}
              value={activeBeanId}
            />
          ) : (
            <Select
              allowClear
              aria-label="关联烘焙历史"
              className={styles.workspaceSelect}
              disabled={selectDisabled}
              onChange={onSelectRoastBatch}
              options={selectableBatches.map((batch) => ({
                label: `${batch.greenBeanName} · ${batch.roastDate}`,
                value: batch.id,
              }))}
              placeholder={selectPlaceholder ?? '选择烘焙历史'}
              value={roastBatchId}
            />
          )}
        </>
      ) : null}
      <span aria-label={usageLabel} className={styles.usageBadge}>
        {usageDisplay}
      </span>
    </div>
  );
}
