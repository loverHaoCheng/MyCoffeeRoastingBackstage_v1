import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import Button from 'antd/es/button';
import Segmented from 'antd/es/segmented';
import Spin from 'antd/es/spin';

import type { RoastCurveRecord } from '@/modules/roast/types/roastCurve';

import { RoastCurveChart, type RoastCurveRorMode } from './RoastCurveChart';
import { RoastCurveDataSummary } from './RoastCurveDataSummary';
import styles from './RoastCurvePanel.module.css';

interface RoastCurveAttachmentPanelProps {
  actionIcon: ReactNode;
  actionLabel: string;
  curve: RoastCurveRecord | null;
  disabled?: boolean;
  emptyText: string;
  isBusy?: boolean;
  isLoading?: boolean;
  onFileSelected: (file: File) => void;
  onRemoveCurve?: () => void;
  removeLabel?: string;
  sourceText: string;
}

const rorModeOptions: { label: string; value: RoastCurveRorMode }[] = [
  { label: '灵敏', value: 'sensitive' },
  { label: '适中', value: 'balanced' },
  { label: '舒缓', value: 'gentle' },
];

export function RoastCurveAttachmentPanel({
  actionIcon,
  actionLabel,
  curve,
  disabled = false,
  emptyText,
  isBusy = false,
  isLoading = false,
  onFileSelected,
  onRemoveCurve,
  removeLabel = '移除曲线 JSON',
  sourceText,
}: RoastCurveAttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rorMode, setRorMode] = useState<RoastCurveRorMode>('balanced');
  const isActionDisabled = disabled || isBusy;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h4>曲线</h4>
          <p>{sourceText}</p>
        </div>
        <div className={styles.actionRow}>
          <Button
            aria-label={actionLabel}
            disabled={isActionDisabled}
            icon={actionIcon}
            onClick={() => fileInputRef.current?.click()}
          >
            {actionLabel}
          </Button>
          {onRemoveCurve ? (
            <Button
              aria-label={removeLabel}
              disabled={isActionDisabled}
              icon={<DeleteOutlined />}
              onClick={onRemoveCurve}
            />
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          accept="application/json,.json"
          className={styles.fileInput}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onFileSelected(file);
            }

            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
        />
      </div>

      {isLoading && !curve ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : null}

      {curve ? (
        <div className={styles.curveContent}>
          <div className={styles.rorToolbar}>
            <span>RoR</span>
            <Segmented
              block
              options={rorModeOptions}
              size="small"
              value={rorMode}
              onChange={(value) => {
                setRorMode(value);
              }}
            />
          </div>
          <RoastCurveChart
            events={curve.eventList}
            phaseList={curve.phaseList}
            points={curve.curveData}
            rorMode={rorMode}
            temperatureUnit={curve.temperatureUnit}
          />
          <RoastCurveDataSummary curve={curve} />
        </div>
      ) : (
        <p className={styles.emptyText}>{emptyText}</p>
      )}
    </div>
  );
}
