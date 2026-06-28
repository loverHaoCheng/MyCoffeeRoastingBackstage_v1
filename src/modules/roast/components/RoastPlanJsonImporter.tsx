import { ImportOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Input, Space } from 'antd';
import { useState } from 'react';

import { AppError } from '@/shared/errors/AppError';

import { sampleRoastPlanJson } from '../services/roastPlanJson.service';

import styles from './RoastPlanJsonImporter.module.css';

const { TextArea } = Input;

interface RoastPlanJsonImporterProps {
  onImport: (jsonText: string) => void;
}

export function RoastPlanJsonImporter({ onImport }: RoastPlanJsonImporterProps) {
  const [jsonText, setJsonText] = useState(sampleRoastPlanJson);
  const { message } = App.useApp();

  const handleImport = () => {
    try {
      onImport(jsonText);
      void message.success('已根据 JSON 创建烘焙计划');
    } catch (error) {
      const errorMessage = error instanceof AppError ? error.message : '导入失败，请检查 JSON 内容。';
      void message.error(errorMessage);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>根据 JSON 快速创建</h2>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setJsonText(sampleRoastPlanJson);
          }}
        >
          示例
        </Button>
      </div>
      <Alert
        message="支持 name、beanName、batchWeightGrams、roastLevel、steps 字段，steps 会生成时间/事件/操作/炉温/火力表。"
        showIcon
        type="info"
      />
      <TextArea
        aria-label="烘焙计划 JSON"
        autoSize={{ minRows: 8, maxRows: 18 }}
        className={styles.editor}
        onChange={(event) => {
          setJsonText(event.target.value);
        }}
        spellCheck={false}
        value={jsonText}
      />
      <Space className={styles.actions} wrap>
        <Button icon={<ImportOutlined />} onClick={handleImport} type="primary">
          创建烘焙计划
        </Button>
      </Space>
    </section>
  );
}
