import Button from 'antd/es/button';
import DownOutlined from '@ant-design/icons/DownOutlined';
import OpenAIOutlined from '@ant-design/icons/OpenAIOutlined';

import type { RoastConversationLegacyContent, RoastConversationMessage } from '../services/roastConversation.service';
import type { RoastPlanJsonStep } from '../types';

import styles from './RoastAssistantMessage.module.css';

interface RoastAssistantMessageProps {
  message: RoastConversationMessage;
  onCreatePlan: (message: RoastConversationMessage) => void;
}

const getPlanStepTitle = (
  step: RoastPlanJsonStep,
  index: number,
): string => {
  const title = [step.time, step.event].filter(Boolean).join(' · ');

  return title ? title : `节点 ${String(index + 1)}`;
};

const getOptionalText = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
};

const getLegacyPointLabel = (type: RoastConversationLegacyContent['type']): string => {
  return type === 'curve_review' ? '下一炉调整' : '关键建议';
};

export function RoastAssistantMessage({ message, onCreatePlan }: RoastAssistantMessageProps) {
  const isAssistant = message.role === 'assistant';
  const planSteps = message.planDraft?.steps ?? [];
  const legacyPoints = message.legacy?.points ?? [];
  const [primaryLegacyPoint, ...additionalLegacyPoints] = legacyPoints;
  const planTitle = getOptionalText(message.planDraft?.name);
  const planMeta = message.planDraft
    ? [message.planDraft.roastLevel, message.planDraft.batchWeightGrams ? `${String(message.planDraft.batchWeightGrams)} g` : '']
      .filter(Boolean)
      .join(' · ')
    : '';

  return (
    <article className={styles.message} data-role={message.role}>
      {isAssistant ? <span aria-hidden="true" className={styles.assistantAvatar}><OpenAIOutlined /></span> : null}
      <div className={styles.messageContent}>
        {message.legacy ? (
          <details className={styles.legacyContent} data-type={message.legacy.type}>
            <summary>
              <strong>{message.legacy.title}</strong>
              <DownOutlined aria-hidden="true" />
            </summary>
            <div className={styles.legacyBody}>
              <p>{message.legacy.summary}</p>
            </div>
          </details>
        ) : <p>{message.content}</p>}
        {message.legacy && primaryLegacyPoint ? (
          <section className={styles.legacyPoints} aria-label={getLegacyPointLabel(message.legacy.type)}>
            <span className={styles.legacyPointLabel}>{getLegacyPointLabel(message.legacy.type)}</span>
            <p>{primaryLegacyPoint}</p>
            {additionalLegacyPoints.length > 0 ? (
              <details className={styles.legacyAdditionalPoints}>
                <summary>
                  查看其余 {String(additionalLegacyPoints.length)} 条建议
                  <DownOutlined aria-hidden="true" />
                </summary>
                <div>
                  {additionalLegacyPoints.map((point, index) => <p key={`${point}-${String(index)}`}>{point}</p>)}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}
        {isAssistant && message.planDraft ? (
          <section className={styles.planDraftAction}>
            <div className={styles.planDraftHeader}>
              <span className={styles.planDraftLabel}>推荐烘焙计划</span>
              <strong>{planTitle ?? '已生成烘焙计划草稿'}</strong>
              <p>
                {planMeta ? planMeta : '确认并补充参数后即可创建为独立计划。'}
              </p>
            </div>
            {planSteps.length > 0 ? (
              <details className={styles.planDetails}>
                <summary>
                  <span>查看具体计划</span>
                  <span>{String(planSteps.length)} 个节点</span>
                  <DownOutlined aria-hidden="true" />
                </summary>
                <ol className={styles.planStepList} aria-label="烘焙计划节点">
                  {planSteps.map((step, index) => (
                    <li key={`${step.time}-${step.event}-${String(index)}`}>
                      <strong>{getPlanStepTitle(step, index)}</strong>
                      <span>{[step.temperature, step.operation, step.firePower].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            <Button onClick={() => { onCreatePlan(message); }} type="primary">
              创建此计划
            </Button>
          </section>
        ) : null}
      </div>
    </article>
  );
}
