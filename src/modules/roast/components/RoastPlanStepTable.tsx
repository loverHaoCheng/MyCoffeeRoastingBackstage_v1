import type { RoastPlanStep } from '@/types/domain';

import styles from './RoastPlanStepTable.module.css';

interface RoastPlanStepTableProps {
  steps: RoastPlanStep[];
}

export function RoastPlanStepTable({ steps }: RoastPlanStepTableProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.table} role="table" aria-label="烘焙计划节点">
        <div className={styles.row} role="row">
          <div role="columnheader">时间</div>
          <div role="columnheader">事件</div>
          <div role="columnheader">操作</div>
          <div role="columnheader">炉温</div>
          <div role="columnheader">火力</div>
        </div>
        {steps.map((step) => (
          <div className={styles.row} key={step.id} role="row">
            <div data-label="时间" role="cell">
              {step.timeLabel}
            </div>
            <div data-label="事件" role="cell">
              {step.eventName}
            </div>
            <div data-label="操作" role="cell">
              {step.operation}
            </div>
            <div data-label="炉温" role="cell">
              {step.drumTemperature}
            </div>
            <div data-label="火力" role="cell">
              {step.firePower}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
