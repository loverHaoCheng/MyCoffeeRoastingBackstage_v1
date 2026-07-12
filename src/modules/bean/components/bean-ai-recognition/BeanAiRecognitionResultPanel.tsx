import CheckOutlined from '@ant-design/icons/CheckOutlined';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Spin from 'antd/es/spin';

import type { BeanImageRecognitionResult } from '@/modules/bean/types';

import type { RecognitionField } from './beanAiRecognitionPlaceholder.utils';
import styles from '../BeanAiRecognitionPlaceholder.module.css';

interface BeanAiRecognitionResultPanelProps {
  isRecognizing: boolean;
  onApplyRecognition: () => void;
  recognition: BeanImageRecognitionResult | null;
  recognitionFields: RecognitionField[];
}

export function BeanAiRecognitionResultPanel({
  isRecognizing,
  onApplyRecognition,
  recognition,
  recognitionFields,
}: BeanAiRecognitionResultPanelProps) {
  return (
    <section className={styles.resultPanel} aria-label="识别结果">
      <header className={styles.resultHeader}>
        <h3>识别结果</h3>
        <Button
          disabled={!recognition}
          icon={<CheckOutlined />}
          onClick={onApplyRecognition}
          type="primary"
        >
          回填表单
        </Button>
      </header>

      {isRecognizing ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : recognitionFields.length > 0 ? (
        <dl className={styles.resultGrid}>
          {recognitionFields.map((field) => (
            <div className={styles.resultItem} key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Empty className={styles.emptyResult} description="暂无识别结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </section>
  );
}
