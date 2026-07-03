import { ImportOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Input } from 'antd';
import { useState } from 'react';

import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import { sampleRoastPlanJson } from '../services/roastPlanJson.service';

import styles from './RoastPlanJsonImporter.module.css';

const { TextArea } = Input;

interface RoastPlanJsonImporterProps {
  onCancel?: () => void;
  onImport: (jsonText: string) => Promise<void> | void;
}

export function RoastPlanJsonImporter({ onCancel, onImport }: RoastPlanJsonImporterProps) {
  const [jsonText, setJsonText] = useState('');

  const handleImport = () => {
    void onImport(jsonText);
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
          填入模板
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
        placeholder="可直接粘贴烘焙计划 JSON，或点击右上角填入模板"
        spellCheck={false}
        value={jsonText}
      />
      <DrawerActionBar>
        {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
        <Button icon={<ImportOutlined />} onClick={handleImport} type="primary">
          创建烘焙计划
        </Button>
      </DrawerActionBar>
    </section>
  );
}
